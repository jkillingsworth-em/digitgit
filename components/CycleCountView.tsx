import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { CycleCountLine, CycleCountSession, InventoryItem, Location, Stock } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';
import { CheckIcon } from './icons/CheckIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

type Step = 'setup' | 'count' | 'review' | 'done';

export interface CycleCountPostPayload {
  locationId: string;
  startedAt: string;
  blindMode: boolean;
  note: string;
  lines: CycleCountLine[];
}

interface CycleCountViewProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  categories: string[];
  onBack: () => void;
  onPost: (payload: CycleCountPostPayload) => Promise<{ varianceCount: number; sessionId: string }>;
}

interface CountRow {
  itemId: string;
  description: string;
  color: string;
  bookQty: number;
  existingSubLocation: string;
}

interface EnteredCount {
  qty: number;
  subLocationDetail: string;
}

function bookQtyAtLocation(stock: Stock[], itemId: string, locationId: string): number {
  return stock
    .filter(s => s.itemId === itemId && s.locationId === locationId)
    .reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);
}

function existingSubLocation(stock: Stock[], itemId: string, locationId: string): string {
  const match = stock.find(s => s.itemId === itemId && s.locationId === locationId);
  return match?.subLocationDetail || '';
}

const CycleCountView: React.FC<CycleCountViewProps> = ({
  items,
  stock,
  locations,
  categories,
  onBack,
  onPost,
}) => {
  const [step, setStep] = useState<Step>('setup');
  const [locationId, setLocationId] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [setupSearch, setSetupSearch] = useState('');
  const [blindMode, setBlindMode] = useState(true);
  const [note, setNote] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [counts, setCounts] = useState<Record<string, EnteredCount>>({});
  const [jumpQuery, setJumpQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [lastResult, setLastResult] = useState<{ varianceCount: number; sessionId: string } | null>(null);
  const [recentSessions, setRecentSessions] = useState<CycleCountSession[]>([]);
  const [recentError, setRecentError] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const locationName = useMemo(
    () => locations.find(l => l.id === locationId)?.name || locationId,
    [locations, locationId],
  );

  const locationPrompt = useMemo(
    () => locations.find(l => l.id === locationId)?.subLocationPrompt || 'Sub-location',
    [locations, locationId],
  );

  const loadRecent = useCallback(async () => {
    try {
      setRecentError(null);
      const q = query(collection(db, 'cycleCounts'), orderBy('completedAt', 'desc'), limit(5));
      const snap = await getDocs(q);
      const rows: CycleCountSession[] = snap.docs.map(d => {
        const data = d.data() as Partial<CycleCountSession>;
        return {
          id: data.id || d.id,
          locationId: data.locationId || '',
          startedAt: data.startedAt || '',
          completedAt: data.completedAt || '',
          countedBy: data.countedBy || 'unknown',
          blindMode: Boolean(data.blindMode),
          note: data.note || '',
          lines: Array.isArray(data.lines) ? data.lines : [],
          posted: data.posted !== false,
        };
      });
      setRecentSessions(rows);
    } catch (err: any) {
      console.warn('Failed to load recent cycle counts', err);
      setRecentError(err?.message || 'Could not load recent cycle counts.');
      setRecentSessions([]);
    }
  }, []);

  useEffect(() => {
    if (step === 'setup') {
      void loadRecent();
    }
  }, [step, loadRecent]);

  const countRows: CountRow[] = useMemo(() => {
    if (!locationId) return [];

    const locId = locationId.toLowerCase().trim();
    const cat = categoryFilter.trim();
    const search = setupSearch.trim().toUpperCase();

    let candidates: InventoryItem[];

    if (cat) {
      candidates = items.filter(i => (i.category || '').trim() === cat);
    } else {
      const idsWithStock = new Set(
        stock.filter(s => s.locationId === locId && (Number(s.quantity) || 0) !== 0).map(s => s.itemId),
      );
      candidates = items.filter(i => idsWithStock.has(i.id));
    }

    if (search) {
      candidates = candidates.filter(i => {
        const hay = `${i.id} ${i.name || ''} ${i.description || ''} ${i.color || ''}`.toUpperCase();
        return hay.includes(search);
      });
    }

    return candidates
      .map(i => ({
        itemId: i.id,
        description: i.description || i.name || '',
        color: i.color || '',
        bookQty: bookQtyAtLocation(stock, i.id, locId),
        existingSubLocation: existingSubLocation(stock, i.id, locId),
      }))
      .sort((a, b) => a.itemId.localeCompare(b.itemId));
  }, [items, stock, locationId, categoryFilter, setupSearch]);

  const enteredItemIds = useMemo(
    () => Object.keys(counts).filter(id => counts[id] !== undefined),
    [counts],
  );

  const enteredCount = enteredItemIds.length;
  const totalRows = countRows.length;

  const reviewLines: Array<CountRow & { countedQty: number; variance: number; subLocationDetail: string }> = useMemo(() => {
    return enteredItemIds
      .map(itemId => {
        const row = countRows.find(r => r.itemId === itemId);
        if (!row) return null;
        const countedQty = Number(counts[itemId]?.qty);
        if (Number.isNaN(countedQty)) return null;
        const variance = countedQty - row.bookQty;
        return {
          ...row,
          countedQty,
          variance,
          subLocationDetail: (counts[itemId]?.subLocationDetail || '').trim(),
        };
      })
      .filter((r): r is CountRow & { countedQty: number; variance: number; subLocationDetail: string } => r !== null)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance) || a.itemId.localeCompare(b.itemId));
  }, [enteredItemIds, countRows, counts]);

  const varianceOnly = useMemo(
    () => reviewLines.filter(r => r.countedQty !== r.bookQty),
    [reviewLines],
  );

  const startCount = () => {
    if (!locationId) return;
    setStartedAt(new Date().toISOString());
    setCounts({});
    setJumpQuery('');
    setHighlightId(null);
    setLastResult(null);
    setStep('count');
  };

  const setQty = (itemId: string, raw: string) => {
    if (raw === '') {
      setCounts(prev => {
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
      return;
    }
    const qty = Math.max(0, Math.floor(Number(raw)));
    if (Number.isNaN(qty)) return;
    setCounts(prev => ({
      ...prev,
      [itemId]: {
        qty,
        subLocationDetail: prev[itemId]?.subLocationDetail ?? existingSubLocation(stock, itemId, locationId),
      },
    }));
  };

  const setSubLoc = (itemId: string, value: string) => {
    setCounts(prev => {
      if (!(itemId in prev)) {
        // Don't create an "entered" count from sub-location alone
        return prev;
      }
      return {
        ...prev,
        [itemId]: { ...prev[itemId], subLocationDetail: value },
      };
    });
  };

  const handleJump = (e: React.FormEvent) => {
    e.preventDefault();
    const q = jumpQuery.trim().toUpperCase();
    if (!q) return;
    const exact = countRows.find(r => r.itemId === q);
    const partial = exact || countRows.find(r => r.itemId.includes(q) || r.description.toUpperCase().includes(q));
    if (!partial) return;
    setHighlightId(partial.itemId);
    const el = rowRefs.current[partial.itemId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = el.querySelector<HTMLInputElement>('input[data-qty-input]');
      input?.focus();
      input?.select();
    }
    setJumpQuery('');
  };

  const handlePost = async () => {
    if (enteredCount === 0 || posting) return;
    setPosting(true);
    try {
      const lines: CycleCountLine[] = reviewLines.map(r => ({
        itemId: r.itemId,
        bookQty: r.bookQty,
        countedQty: r.countedQty,
        variance: r.variance,
        ...(r.subLocationDetail ? { subLocationDetail: r.subLocationDetail } : {}),
      }));
      const result = await onPost({
        locationId,
        startedAt: startedAt || new Date().toISOString(),
        blindMode,
        note: note.trim(),
        lines,
      });
      setLastResult(result);
      setStep('done');
    } catch (err) {
      // Parent shows toast; stay on review
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const resetForAnother = () => {
    setStep('setup');
    setCounts({});
    setJumpQuery('');
    setHighlightId(null);
    setStartedAt('');
    setLastResult(null);
    setNote('');
    // keep location / filters for convenience
  };

  const locLabel = (id: string) => locations.find(l => l.id === id)?.name || id;

  return (
    <div className="w-full mx-auto max-w-3xl px-2 sm:px-4 pb-28 space-y-6 animate-fade-in-down">
      <header className="space-y-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 'setup' || step === 'done') onBack();
              else if (step === 'review') setStep('count');
              else setStep('setup');
            }}
            className="text-sm font-black uppercase tracking-widest text-gray-500 hover:text-em-red"
          >
            ← {step === 'setup' || step === 'done' ? 'Back' : 'Back'}
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-em-red tracking-[0.2em]">
            <MapPinIcon className="w-4 h-4" /> Cycle Count
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">
          {step === 'setup' && 'Setup Count'}
          {step === 'count' && `Counting · ${locationName}`}
          {step === 'review' && 'Review Variances'}
          {step === 'done' && 'Count Posted'}
        </h1>
        <p className="text-sm text-gray-600 font-medium">
          {step === 'setup' && 'Pick a location, optional filters, then count on the floor. Blind mode hides book qty while counting.'}
          {step === 'count' && (blindMode ? 'Blind count — book quantities hidden.' : 'Open count — book quantities visible (supervisor).')}
          {step === 'review' && 'Confirm adjustments before writing floor stock and a cycle count session.'}
          {step === 'done' && 'Floor stock updated. Push to the EM sheet separately via Sync EM Sheet when ready.'}
        </p>
      </header>

      {/* SETUP */}
      {step === 'setup' && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <label className="block space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Location (required)</span>
              <select
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-bold text-gray-900 focus:border-em-red focus:ring-em-red"
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
              >
                <option value="">Select location…</option>
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Category (optional)</span>
              <select
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-900"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="">All with stock at location</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 font-medium">
                With a category, every SKU in that category is listed (including zero book) so you can record found stock.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Search filter (optional)</span>
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-medium"
                placeholder="Narrow SKUs before starting…"
                value={setupSearch}
                onChange={e => setSetupSearch(e.target.value)}
              />
            </label>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <div className="text-sm font-black uppercase tracking-wider text-gray-900">Blind count</div>
                <div className="text-xs text-gray-600 font-medium">Hide book qty on the floor (default on)</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={blindMode}
                onClick={() => setBlindMode(v => !v)}
                className={`relative h-8 w-14 rounded-full transition-colors ${blindMode ? 'bg-em-red' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${blindMode ? 'translate-x-6' : ''}`}
                />
              </button>
            </div>

            <label className="block space-y-2">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Note (optional)</span>
              <textarea
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium min-h-[72px]"
                placeholder="e.g. WH-J aisle A cycle — shift 1"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </label>

            {locationId && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm font-medium text-amber-900">
                Preview: <span className="font-black">{countRows.length}</span> SKU{countRows.length === 1 ? '' : 's'} ready to count
                {categoryFilter ? ` in ${categoryFilter}` : ' with stock'} at <span className="font-black">{locationName}</span>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-gray-500" />
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Recent cycle counts</h2>
            </div>
            {recentError && (
              <p className="text-xs text-amber-700 font-medium">{recentError}</p>
            )}
            {recentSessions.length === 0 && !recentError ? (
              <p className="text-sm text-gray-500 font-medium italic">No sessions yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {recentSessions.map(s => {
                  const varCount = (s.lines || []).filter(l => l.variance !== 0).length;
                  const when = s.completedAt ? new Date(s.completedAt).toLocaleString() : '—';
                  return (
                    <li key={s.id} className="py-3 flex justify-between gap-3 text-sm">
                      <div>
                        <div className="font-black text-gray-900 uppercase">{locLabel(s.locationId)}</div>
                        <div className="text-xs text-gray-500 font-medium">{when} · {s.countedBy}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-em-red">{varCount} var</div>
                        <div className="text-xs text-gray-500">{(s.lines || []).length} lines</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}

      {/* COUNT */}
      {step === 'count' && (
        <div className="space-y-4">
          <form onSubmit={handleJump} className="sticky top-[72px] z-30 rounded-2xl border border-gray-200 bg-white/95 backdrop-blur p-3 shadow-sm flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                className="w-full rounded-xl border border-gray-300 pl-10 pr-3 py-3 text-base font-bold uppercase tracking-wide"
                placeholder="Scan / paste SKU to jump…"
                value={jumpQuery}
                onChange={e => setJumpQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="rounded-xl bg-em-red text-white px-4 py-3 text-sm font-black uppercase tracking-wider shrink-0">
              Jump
            </button>
          </form>

          <div className="text-xs font-black uppercase tracking-widest text-gray-500 px-1">
            {enteredCount} of {totalRows} counted
            {blindMode ? ' · Blind' : ' · Open'}
          </div>

          {countRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm font-bold text-gray-500 uppercase tracking-widest">
              No SKUs match this setup
            </div>
          ) : (
            <div className="space-y-3">
              {countRows.map(row => {
                const entered = counts[row.itemId];
                const isHighlighted = highlightId === row.itemId;
                return (
                  <div
                    key={row.itemId}
                    ref={el => { rowRefs.current[row.itemId] = el; }}
                    className={`rounded-2xl border bg-white p-4 shadow-sm space-y-3 transition-colors ${
                      isHighlighted ? 'border-em-red ring-2 ring-em-red/30' : entered ? 'border-emerald-200' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-lg font-black text-gray-900 tracking-tight">{row.itemId}</div>
                        <div className="text-sm text-gray-600 font-medium truncate">{row.description || '—'}</div>
                        {row.color ? (
                          <div className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-700">
                            {row.color}
                          </div>
                        ) : null}
                      </div>
                      {!blindMode && (
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Book</div>
                          <div className="text-2xl font-black text-gray-900">{row.bookQty}</div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Counted qty</span>
                        <input
                          data-qty-input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          className="w-full rounded-xl border-2 border-gray-300 px-4 py-4 text-2xl font-black text-center focus:border-em-red focus:ring-em-red"
                          placeholder="—"
                          value={entered ? String(entered.qty) : ''}
                          onChange={e => setQty(row.itemId, e.target.value)}
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{locationPrompt}</span>
                        <input
                          type="text"
                          className="w-full rounded-xl border border-gray-300 px-4 py-4 text-base font-medium"
                          placeholder="Optional"
                          value={entered?.subLocationDetail ?? ''}
                          onChange={e => {
                            if (!(row.itemId in counts)) return;
                            setSubLoc(row.itemId, e.target.value);
                          }}
                          disabled={!(row.itemId in counts)}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REVIEW */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-amber-900">
              Showing <span className="font-black">{reviewLines.length}</span> entered line{reviewLines.length === 1 ? '' : 's'}
              {' '}(<span className="font-black">{varianceOnly.length}</span> with variance).
              Unentered SKUs are skipped — they are not treated as zero.
            </p>
          </div>

          {reviewLines.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm font-bold text-gray-500">
              No counts entered yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-[10px] font-black uppercase tracking-widest text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">Book</th>
                    <th className="px-4 py-3 text-right">Counted</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviewLines.map(r => (
                    <tr key={r.itemId} className={r.variance !== 0 ? 'bg-red-50/40' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-black text-gray-900">{r.itemId}</div>
                        <div className="text-xs text-gray-500 truncate max-w-[180px]">{r.description}</div>
                        {r.subLocationDetail ? (
                          <div className="text-[10px] font-bold uppercase text-gray-400 mt-0.5">{r.subLocationDetail}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">{r.bookQty}</td>
                      <td className="px-4 py-3 text-right font-black tabular-nums">{r.countedQty}</td>
                      <td className={`px-4 py-3 text-right font-black tabular-nums ${r.variance === 0 ? 'text-gray-400' : r.variance > 0 ? 'text-emerald-600' : 'text-em-red'}`}>
                        {r.variance > 0 ? `+${r.variance}` : r.variance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DONE */}
      {step === 'done' && lastResult && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <CheckIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-gray-900">Cycle count posted</h2>
          <p className="text-sm font-medium text-gray-700">
            <span className="font-black text-em-red">{lastResult.varianceCount}</span> variance
            {lastResult.varianceCount === 1 ? '' : 's'} applied at <span className="font-black">{locationName}</span>.
          </p>
          <p className="text-xs text-gray-500 font-mono">Session {lastResult.sessionId}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={resetForAnother}
              className="rounded-xl bg-em-red text-white px-6 py-3 text-sm font-black uppercase tracking-wider"
            >
              Count another location
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-black uppercase tracking-wider text-gray-800"
            >
              Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Sticky footer */}
      {step !== 'done' && (
        <div className="fixed bottom-0 inset-x-0 z-[55] border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          <div className="mx-auto max-w-3xl flex items-center gap-3">
            {step === 'setup' && (
              <>
                <div className="flex-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {locationId ? `${countRows.length} SKUs` : 'Choose location'}
                </div>
                <button
                  type="button"
                  disabled={!locationId || countRows.length === 0}
                  onClick={startCount}
                  className="rounded-xl bg-em-red text-white px-6 py-3 text-sm font-black uppercase tracking-wider disabled:opacity-40"
                >
                  Start count
                </button>
              </>
            )}
            {step === 'count' && (
              <>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full bg-em-red transition-all"
                      style={{ width: totalRows ? `${Math.min(100, (enteredCount / totalRows) * 100)}%` : '0%' }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {enteredCount} / {totalRows}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={enteredCount === 0}
                  onClick={() => setStep('review')}
                  className="rounded-xl bg-em-red text-white px-6 py-3 text-sm font-black uppercase tracking-wider disabled:opacity-40"
                >
                  Review
                </button>
              </>
            )}
            {step === 'review' && (
              <>
                <button
                  type="button"
                  onClick={() => setStep('count')}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-black uppercase tracking-wider text-gray-800"
                >
                  Edit
                </button>
                <div className="flex-1 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">
                  {varianceOnly.length} variance{varianceOnly.length === 1 ? '' : 's'}
                </div>
                <button
                  type="button"
                  disabled={enteredCount === 0 || posting}
                  onClick={() => void handlePost()}
                  className="rounded-xl bg-em-red text-white px-6 py-3 text-sm font-black uppercase tracking-wider disabled:opacity-40"
                >
                  {posting ? 'Posting…' : 'Post'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CycleCountView;
