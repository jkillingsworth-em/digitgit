import React, { useMemo, useRef, useState } from 'react';
import type { InventoryItem, Location, SageImportSettings, Stock } from '../types';
import {
  buildSageImportPlan,
  parseSageFile,
  summarizePrefixes,
  suggestPrefixChoice,
  type PrefixChoice,
  type SageImportPlan,
  type SageLine,
} from '../utils/sageImport';
import type { LocationSwitchPlan } from '../utils/locationSwitch';
import SageLocationSwitch from './SageLocationSwitch';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { CheckIcon } from './icons/CheckIcon';

export type SageIssue =
  | 'count_differs'
  | 'sage_negative'
  | 'not_in_sage'
  | 'negative_stock'
  | 'orphan_stock'
  | 'incomplete_item';

export interface SageCheckRow {
  key: string;
  issue: SageIssue;
  itemId: string;
  description: string;
  appQty: number;
  sageQty: number | null;
  sageOnPO: number | null;
  difference: number | null;
  where: string;
  sageBins: string[];
}

const ISSUES: { id: SageIssue; label: string; hint: string; chip: string }[] = [
  { id: 'count_differs', label: 'Count differs', hint: 'App on-hand and Sage on-hand don’t match.', chip: 'bg-amber-100 text-amber-900' },
  { id: 'sage_negative', label: 'Negative in Sage', hint: 'Sage shows less than zero on hand.', chip: 'bg-red-50 text-em-red' },
  { id: 'not_in_sage', label: 'Not in Sage yet', hint: 'The app has stock but no Sage file has listed this part.', chip: 'bg-neutral-100 text-neutral-700' },
  { id: 'negative_stock', label: 'Negative in app', hint: 'A location in the app shows less than zero.', chip: 'bg-red-50 text-em-red' },
  { id: 'orphan_stock', label: 'Stock with no product', hint: 'Stock is recorded for a part code with no product.', chip: 'bg-neutral-100 text-neutral-700' },
  { id: 'incomplete_item', label: 'Missing details', hint: 'The product has no description or category.', chip: 'bg-neutral-100 text-neutral-700' },
];
const ISSUE_BY_ID = new Map(ISSUES.map(issue => [issue.id, issue]));

const hasNumber = (value: unknown): value is number => value !== undefined && value !== null && Number.isFinite(Number(value));

/** Everything the Sage check page lists, worst first. App on-hand excludes stock that is still on order (PO). */
export function computeSageCheck(items: InventoryItem[], stock: Stock[], locations: Location[]): SageCheckRow[] {
  const locationName = new Map(locations.map(loc => [loc.id, loc.name]));
  const itemIds = new Set(items.map(item => item.id));
  const onHand = stock.filter(entry => entry.source !== 'PO');
  const byItem = new Map<string, Stock[]>();
  onHand.forEach(entry => byItem.set(entry.itemId, [...(byItem.get(entry.itemId) || []), entry]));
  const whereText = (entries: Stock[]) => entries
    .filter(entry => entry.quantity !== 0)
    .map(entry => `${locationName.get(entry.locationId) || entry.locationId}${entry.subLocationDetail ? ` ${entry.subLocationDetail}` : ''} ${entry.quantity.toLocaleString()}`)
    .join(' · ') || '—';

  const rows: SageCheckRow[] = [];
  items.forEach(item => {
    const entries = byItem.get(item.id) || [];
    const appQty = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const sageQty = hasNumber(item.sageQty) ? Number(item.sageQty) : null;
    const base = {
      itemId: item.id,
      description: item.description || item.name || '',
      appQty,
      sageQty,
      sageOnPO: hasNumber(item.sageOnPO) ? Number(item.sageOnPO) : null,
      where: whereText(entries),
      sageBins: item.sageBins || [],
    };
    if (sageQty !== null && sageQty < 0) rows.push({ ...base, key: `neg-sage:${item.id}`, issue: 'sage_negative', difference: appQty - sageQty });
    else if (sageQty !== null && sageQty !== appQty) rows.push({ ...base, key: `diff:${item.id}`, issue: 'count_differs', difference: appQty - sageQty });
    else if (sageQty === null && appQty > 0) rows.push({ ...base, key: `none:${item.id}`, issue: 'not_in_sage', difference: null });
    if (!item.description?.trim() || !item.category?.trim()) {
      rows.push({ ...base, key: `incomplete:${item.id}`, issue: 'incomplete_item', description: base.description || '(no description)', difference: null });
    }
  });
  onHand.forEach((entry, index) => {
    const key = entry.docId || `${entry.itemId}_${entry.locationId}_${index}`;
    const where = `${locationName.get(entry.locationId) || entry.locationId}${entry.subLocationDetail ? ` ${entry.subLocationDetail}` : ''} ${entry.quantity.toLocaleString()}`;
    const item = items.find(i => i.id === entry.itemId);
    if (entry.quantity < 0) {
      rows.push({ key: `neg-app:${key}`, issue: 'negative_stock', itemId: entry.itemId, description: item?.description || '(no product)', appQty: entry.quantity, sageQty: hasNumber(item?.sageQty) ? Number(item!.sageQty) : null, sageOnPO: null, difference: null, where, sageBins: item?.sageBins || [] });
    }
    if (!itemIds.has(entry.itemId)) {
      rows.push({ key: `orphan:${key}`, issue: 'orphan_stock', itemId: entry.itemId, description: '(no product)', appQty: entry.quantity, sageQty: null, sageOnPO: null, difference: null, where, sageBins: [] });
    }
  });

  const order = new Map(ISSUES.map((issue, index) => [issue.id, index]));
  return rows.sort((a, b) =>
    (order.get(a.issue)! - order.get(b.issue)!)
    || Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0)
    || a.itemId.localeCompare(b.itemId, undefined, { numeric: true }));
}

interface SageCheckProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  isAdmin: boolean;
  sageSettings: SageImportSettings;
  onImport: (args: { plan: SageImportPlan; fileName: string; asOf: string; setBins?: boolean }) => Promise<void>;
  onSwitchLocations: (plan: LocationSwitchPlan) => Promise<void>;
  onBack: () => void;
  onSelectItem?: (itemId: string) => void;
}

const todayIso = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const NEW_LOCATION = '__new__';
const SKIP = '__skip__';

const SageCheck: React.FC<SageCheckProps> = ({ items, stock, locations, isAdmin, sageSettings, onImport, onSwitchLocations, onBack, onSelectItem }) => {
  const rows = useMemo(() => computeSageCheck(items, stock, locations), [items, stock, locations]);
  const counts = useMemo(() => {
    const map = new Map<SageIssue, number>();
    rows.forEach(row => map.set(row.issue, (map.get(row.issue) || 0) + 1));
    return map;
  }, [rows]);
  const [activeIssue, setActiveIssue] = useState<SageIssue | 'all'>('all');
  const visibleRows = activeIssue === 'all' ? rows : rows.filter(row => row.issue === activeIssue);
  const [showNotInApp, setShowNotInApp] = useState(false);

  // Upload review state
  const fileInput = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<{ fileName: string; lines: SageLine[]; warnings: string[] } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [asOf, setAsOf] = useState(todayIso);
  const [choices, setChoices] = useState<Record<string, PrefixChoice | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [setBins, setSetBins] = useState(false);

  const prefixes = useMemo(() => (upload ? summarizePrefixes(upload.lines) : []), [upload]);
  const appItemIds = useMemo(() => new Set(items.map(item => item.id.toUpperCase())), [items]);
  const plan = useMemo(
    () => (upload ? buildSageImportPlan(upload.lines, locations, choices, appItemIds, stock) : null),
    [upload, locations, choices, appItemIds, stock],
  );

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    try {
      const parsed = parseSageFile(file.name, new Uint8Array(await file.arrayBuffer()));
      const initial: Record<string, PrefixChoice | undefined> = {};
      summarizePrefixes(parsed.lines).forEach(({ prefix }) => {
        initial[prefix] = suggestPrefixChoice(prefix, locations, sageSettings.prefixMap?.[prefix]);
      });
      setChoices(initial);
      setUpload({ fileName: file.name, ...parsed });
      setSetBins(false);
      setAsOf(todayIso());
    } catch (error) {
      setUpload(null);
      setUploadError(error instanceof Error ? error.message : 'Could not read that file.');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const setChoice = (prefix: string, value: string) => {
    setChoices(prev => ({
      ...prev,
      [prefix]: value === SKIP ? { kind: 'skip' }
        : value === NEW_LOCATION ? { kind: 'new', name: prev[prefix]?.kind === 'new' ? (prev[prefix] as { name: string }).name : '' }
        : value ? { kind: 'existing', locationId: value }
        : undefined,
    }));
  };

  const runImport = async () => {
    if (!upload || !plan || plan.unplacedPrefixes.length > 0) return;
    setSaving(true);
    setUploadError('');
    try {
      await onImport({ plan, fileName: upload.fileName, asOf, setBins });
      setUpload(null);
      setActiveIssue('all');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'The import did not finish. Nothing after the error was saved; try again.');
    } finally {
      setSaving(false);
    }
  };

  const last = sageSettings.lastImport;
  const binCount = plan?.addSubLocations.reduce((sum, entry) => sum + entry.names.length, 0) ?? 0;

  return (
    <div className="animate-fade-in-down space-y-5 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <button type="button" onClick={onBack} className="mb-1 text-[13px] text-neutral-500 hover:text-em-red">Operations</button>
          <h1 className="!mb-1 text-[28px] font-bold leading-9 text-em-ink">Sage check</h1>
          <p className="text-neutral-600">Compares the app’s on-hand count with your latest Sage export.</p>
        </div>
        <div className="text-sm text-neutral-600 md:text-right">
          {last ? (
            <>
              <div>Last Sage file: <b className="font-semibold text-em-ink">{last.fileName}</b></div>
              <div>As of {formatDate(last.asOf)} · {last.partCount.toLocaleString()} parts · uploaded {formatDate(last.importedAt)}</div>
            </>
          ) : (
            <div>No Sage file uploaded yet.</div>
          )}
        </div>
      </div>

      {isAdmin && !upload && <SageLocationSwitch locations={locations} stock={stock} onSwitch={onSwitchLocations} />}

      {/* Upload */}
      {isAdmin && !upload && (
        <div className="flex flex-col gap-4 rounded-lg border border-dashed border-neutral-300 bg-white p-5 sm:flex-row sm:items-center">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-50 text-em-red"><ArrowUpTrayIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-em-ink">Upload a Sage export</div>
            <p className="text-sm text-neutral-600">The inventory report with Item Code, Qty On Hand, Qty On PO and the bin columns, as .xlsx or .csv. You’ll review everything before it’s saved. App quantities are never changed.</p>
          </div>
          <input ref={fileInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={event => void handleFile(event.target.files?.[0])} />
          <button type="button" onClick={() => fileInput.current?.click()} className="h-11 shrink-0 rounded-md bg-em-red px-5 font-semibold text-white hover:bg-em-red-dark">Choose file</button>
        </div>
      )}
      {uploadError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-em-red-dark">{uploadError}</p>}

      {/* Review before import */}
      {isAdmin && upload && plan && (
        <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="!mb-0 text-lg font-bold text-em-ink">Review {upload.fileName}</h2>
              <p className="text-sm text-neutral-600">
                {upload.lines.length.toLocaleString()} parts in the file · {plan.itemUpdates.length.toLocaleString()} match products in the app
                {plan.notInApp.length > 0 && <> · <b className="font-semibold text-em-ink">{plan.notInApp.length.toLocaleString()} not in the app</b></>}
              </p>
            </div>
            <label className="!mb-0 flex items-center gap-2 text-sm text-neutral-600">
              Sage numbers as of
              <input type="date" value={asOf} onChange={event => setAsOf(event.target.value)} className="form-control !w-auto" />
            </label>
          </div>

          {upload.warnings.length > 0 && (
            <ul className="space-y-1 border-b border-neutral-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
              {upload.warnings.slice(0, 8).map(warning => <li key={warning}>{warning}</li>)}
              {upload.warnings.length > 8 && <li>…and {upload.warnings.length - 8} more.</li>}
            </ul>
          )}

          {/* Prefix → location */}
          <div className="px-5 py-4">
            <h3 className="!mb-1 text-base font-semibold text-em-ink">Where Sage bins go</h3>
            <p className="mb-3 text-sm text-neutral-600">The start of each Sage bin is the building: J-ROW-R → Warehouse J, bin ROW-R. Areas and rooms keep their code as the bin: B7-SH-A → Section B, bin B7-SH-A; R3-SH-H → Section A, bin R3-SH-H. “DEFAULT” means anywhere in that building or area; “OTHER” means anywhere in the facility. Your choices are remembered for next time.</p>
            <div className="overflow-x-auto rounded-md border border-neutral-200">
              <table className="min-w-full text-sm">
                <thead className="bg-em-page text-left text-xs font-semibold text-neutral-600">
                  <tr><th className="px-3 py-2">Sage prefix</th><th className="px-3 py-2">Bins in this file</th><th className="px-3 py-2 text-right">Parts</th><th className="px-3 py-2">App location</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-200">
                  {prefixes.map(({ prefix, codes, partCount }) => {
                    const choice = choices[prefix];
                    const value = !choice ? '' : choice.kind === 'skip' ? SKIP : choice.kind === 'new' ? NEW_LOCATION : choice.locationId;
                    return (
                      <tr key={prefix} className={!choice ? 'bg-amber-50' : undefined}>
                        <td className="px-3 py-2.5 font-mono font-semibold text-em-ink">{prefix}</td>
                        <td className="max-w-[340px] px-3 py-2.5 font-mono text-xs text-neutral-600">{codes.slice(0, 6).join(', ')}{codes.length > 6 ? ` +${codes.length - 6} more` : ''}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{partCount}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <select aria-label={`App location for Sage prefix ${prefix}`} value={value} onChange={event => setChoice(prefix, event.target.value)} className="form-control !w-auto min-w-[200px]">
                              <option value="">Choose…</option>
                              {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                              <option value={NEW_LOCATION}>New location…</option>
                              <option value={SKIP}>Leave these bins out</option>
                            </select>
                            {choice?.kind === 'new' && (
                              <input
                                aria-label={`Name for the new location for ${prefix}`}
                                value={choice.name}
                                onChange={event => setChoices(prev => ({ ...prev, [prefix]: { kind: 'new', name: event.target.value.toUpperCase() } }))}
                                placeholder="Location name"
                                className="form-control !w-56"
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* What will be added */}
          <div className="grid gap-4 border-t border-neutral-200 px-5 py-4 lg:grid-cols-2">
            <div>
              <h3 className="!mb-2 text-base font-semibold text-em-ink">Bins to add {binCount > 0 && <span className="font-normal text-neutral-500">({binCount})</span>}</h3>
              {plan.newLocations.length > 0 && (
                <p className="mb-2 text-sm text-neutral-700">New locations: {plan.newLocations.map(loc => <b key={loc.id} className="mr-2 font-semibold text-em-ink">{loc.name}</b>)}</p>
              )}
              {plan.addSubLocations.length === 0 ? (
                <p className="text-sm text-neutral-500">The app already has every bin in this file.</p>
              ) : (
                <ul className="space-y-2">
                  {plan.addSubLocations.map(entry => (
                    <li key={entry.locationId}>
                      <div className="text-sm font-semibold text-em-ink">{entry.locationName}</div>
                      <div className="mt-1 flex flex-wrap gap-1.5">{entry.names.map(name => <span key={name} className="rounded-full border border-neutral-300 px-2.5 py-0.5 font-mono text-xs text-em-ink">{name}</span>)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="!mb-2 text-base font-semibold text-em-ink">Not in the app {plan.notInApp.length > 0 && <span className="font-normal text-neutral-500">({plan.notInApp.length})</span>}</h3>
              {plan.notInApp.length === 0 ? (
                <p className="text-sm text-neutral-500">Every part in this file is already a product in the app.</p>
              ) : (
                <>
                  <p className="mb-2 text-sm text-neutral-600">These aren’t added automatically. Add them under Inventory management → Add new items if you need them.</p>
                  <ul className="max-h-48 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200 text-sm">
                    {plan.notInApp.map(line => (
                      <li key={line.itemId} className="flex gap-3 px-3 py-1.5"><span className="w-28 shrink-0 font-mono text-xs leading-5">{line.itemId}</span><span className="min-w-0 flex-1 truncate">{line.description}</span><span className="tabular-nums text-neutral-600">{line.qtyOnHand}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-neutral-200 px-5 py-4">
            <label className="!mb-0 flex items-start gap-3">
              <input type="checkbox" checked={setBins} disabled={plan.binUpdates.length === 0} onChange={event => setSetBins(event.target.checked)} className="mt-1 h-4 w-4 rounded border-neutral-300" />
              <span>
                <span className="block font-semibold text-em-ink">Also set each part’s bin from Sage {plan.binUpdates.length > 0 && <span className="font-normal text-neutral-500">({plan.binUpdates.length.toLocaleString()} {plan.binUpdates.length === 1 ? 'part' : 'parts'})</span>}</span>
                <span className="block text-sm text-neutral-600">
                  {plan.binUpdates.length === 0
                    ? 'Every part the app has in the same building as its Sage bin already uses that bin.'
                    : 'Uses Sage’s “Bin Location” column, only where the app already has that part in the same building. Quantities don’t change.'}
                </span>
                {setBins && (
                  <span className="mt-2 block max-h-40 overflow-y-auto rounded-md border border-neutral-200 text-xs">
                    {plan.binUpdates.slice(0, 200).map(update => (
                      <span key={update.docId} className="flex gap-3 border-b border-neutral-100 px-3 py-1 last:border-0">
                        <span className="w-28 shrink-0 font-mono">{update.itemId}</span>
                        <span className="text-neutral-500">{locations.find(loc => loc.id === update.locationId)?.name}</span>
                        <span className="ml-auto font-mono">{update.from || '(none)'} → <b className="font-semibold text-em-ink">{update.to}</b></span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-neutral-200 bg-em-page px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
            {plan.unplacedPrefixes.length > 0 && (
              <p className="text-sm font-semibold text-amber-900 sm:mr-auto">Choose an app location (or “Leave these bins out”) for: {plan.unplacedPrefixes.join(', ')}</p>
            )}
            <button type="button" disabled={saving} onClick={() => setUpload(null)} className="h-11 rounded-md border border-neutral-300 bg-white px-4 font-semibold text-em-ink hover:bg-neutral-50">Cancel</button>
            <button type="button" disabled={saving || plan.unplacedPrefixes.length > 0} onClick={() => void runImport()} className="h-11 rounded-md bg-em-red px-5 font-semibold text-white hover:bg-em-red-dark disabled:opacity-50">
              {saving ? 'Saving…' : `Save Sage numbers for ${plan.itemUpdates.length.toLocaleString()} parts`}
            </button>
          </div>
        </section>
      )}

      {/* Results */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setActiveIssue('all')} className={`h-9 rounded-full border px-3.5 text-sm font-semibold ${activeIssue === 'all' ? 'border-em-ink bg-em-ink text-white' : 'border-neutral-300 bg-white text-em-ink hover:bg-neutral-50'}`}>All <span className="tabular-nums opacity-70">{rows.length}</span></button>
        {ISSUES.map(issue => (
          <button key={issue.id} type="button" title={issue.hint} onClick={() => setActiveIssue(issue.id)} disabled={!counts.get(issue.id)} className={`h-9 rounded-full border px-3.5 text-sm font-semibold disabled:opacity-40 ${activeIssue === issue.id ? 'border-em-ink bg-em-ink text-white' : 'border-neutral-300 bg-white text-em-ink hover:bg-neutral-50'}`}>
            {issue.label} <span className="tabular-nums opacity-70">{counts.get(issue.id) || 0}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-5 py-4 text-green-900">
          <CheckIcon className="h-5 w-5" />
          {last ? 'Everything matches the last Sage file.' : 'Nothing to check yet. Upload a Sage export to compare.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-em-page text-left text-xs font-semibold text-neutral-600">
              <tr>
                <th className="px-4 py-3">Item code</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">App on hand</th>
                <th className="px-4 py-3 text-right">Sage on hand</th>
                <th className="px-4 py-3 text-right">Difference</th>
                <th className="px-4 py-3 text-right">Sage on PO</th>
                <th className="px-4 py-3">Issue</th>
                <th className="px-4 py-3">Where (app)</th>
                <th className="px-4 py-3">Sage bins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {visibleRows.map(row => {
                const issue = ISSUE_BY_ID.get(row.issue)!;
                const clickable = Boolean(onSelectItem) && row.issue !== 'orphan_stock';
                return (
                  <tr key={row.key} onClick={clickable ? () => onSelectItem!(row.itemId) : undefined} className={clickable ? 'cursor-pointer hover:bg-neutral-50' : undefined}>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-em-ink">{row.itemId}</td>
                    <td className="max-w-[280px] px-4 py-3 font-semibold text-em-ink">{row.description}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.appQty.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${row.sageQty !== null && row.sageQty < 0 ? 'font-semibold text-em-red' : ''}`}>{row.sageQty === null ? '—' : row.sageQty.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${row.difference && row.difference > 0 ? 'text-green-800' : row.difference && row.difference < 0 ? 'text-em-red' : ''}`}>
                      {row.difference === null ? '—' : `${row.difference > 0 ? '+' : ''}${row.difference.toLocaleString()}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{row.sageOnPO === null ? '—' : row.sageOnPO.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${issue.chip}`}>{issue.label}</span></td>
                    <td className="max-w-[240px] px-4 py-3 text-xs text-neutral-600">{row.where}</td>
                    <td className="max-w-[200px] px-4 py-3 font-mono text-xs text-neutral-600">{row.sageBins.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-neutral-200 px-4 py-2.5 text-xs text-neutral-500">Difference = app minus Sage. App on hand leaves out stock that’s still on order.</p>
        </div>
      )}

      {last && last.notInApp.length > 0 && (
        <section className="rounded-lg border border-neutral-200 bg-white">
          <button type="button" onClick={() => setShowNotInApp(open => !open)} className="flex w-full items-center justify-between px-5 py-3 text-left">
            <span className="font-semibold text-em-ink">In the last Sage file but not in the app <span className="font-normal text-neutral-500">({last.notInApp.length})</span></span>
            <span className="text-sm font-semibold text-em-red">{showNotInApp ? 'Hide' : 'Show'}</span>
          </button>
          {showNotInApp && (
            <ul className="divide-y divide-neutral-100 border-t border-neutral-200 text-sm">
              {last.notInApp.map(line => (
                <li key={line.itemId} className="flex gap-4 px-5 py-2"><span className="w-32 shrink-0 font-mono text-[13px]">{line.itemId}</span><span className="min-w-0 flex-1">{line.description}</span><span className="tabular-nums text-neutral-600">{line.qtyOnHand.toLocaleString()} in Sage</span></li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default SageCheck;
