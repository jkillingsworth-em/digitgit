import React, { useEffect, useMemo, useState } from 'react';
import type { Location, Stock } from '../types';
import { SAGE_MAIN_LOCATIONS } from '../utils/sageImport';
import { buildLocationSwitchPlan, suggestSwitchTarget, type LocationSwitchPlan, type SwitchChoices } from '../utils/locationSwitch';

interface Props {
  locations: Location[];
  stock: Stock[];
  onSwitch: (plan: LocationSwitchPlan) => Promise<void>;
}

const SAGE_NAMES = SAGE_MAIN_LOCATIONS.map(loc => loc.name);
const KEEP = 'keep';

/** One-time step: turn the Google Sheet-era locations into Sage's sections and warehouses. */
const SageLocationSwitch: React.FC<Props> = ({ locations, stock, onSwitch }) => {
  const oldLocations = useMemo(() => locations.filter(loc => !SAGE_NAMES.includes(loc.name.trim().toUpperCase())), [locations]);
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<SwitchChoices>(() =>
    Object.fromEntries(oldLocations.map(loc => [loc.id, suggestSwitchTarget(loc) || ''])),
  );
  // Locations load after the page opens; give late arrivals their suggestion too.
  useEffect(() => {
    setChoices(prev => {
      const missing = oldLocations.filter(loc => !(loc.id in prev));
      return missing.length ? { ...prev, ...Object.fromEntries(missing.map(loc => [loc.id, suggestSwitchTarget(loc) || ''])) } : prev;
    });
  }, [oldLocations]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const usage = useMemo(() => {
    const map = new Map<string, { parts: Set<string>; units: number }>();
    stock.forEach(s => {
      const entry = map.get(s.locationId) || { parts: new Set<string>(), units: 0 };
      entry.parts.add(s.itemId);
      entry.units += s.quantity;
      map.set(s.locationId, entry);
    });
    return map;
  }, [stock]);

  const unchosen = oldLocations.filter(loc => !choices[loc.id]);
  const plan = useMemo(() => buildLocationSwitchPlan(locations, stock, choices), [locations, stock, choices]);

  // Done once every Sage location exists; anything left over was kept on purpose.
  const allSageExist = SAGE_NAMES.every(name => locations.some(loc => loc.name.trim().toUpperCase() === name));
  if (oldLocations.length === 0 || allSageExist) return null;

  const run = async () => {
    if (unchosen.length > 0) return;
    const summary = [
      plan.rename.length ? `rename ${plan.rename.length}` : '',
      plan.merge.length ? `merge ${plan.merge.length} (moving ${plan.unitsMoved.toLocaleString()} units)` : '',
      plan.create.length ? `add ${plan.create.length}` : '',
    ].filter(Boolean).join(', ');
    if (!window.confirm(`Switch locations to Sage: ${summary}. Quantities are kept; only where they're filed changes. Continue?`)) return;
    setSaving(true);
    setError('');
    try {
      await onSwitch(plan);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The switch did not finish. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-lg border border-amber-300 bg-white">
      <div className="flex flex-col gap-3 bg-amber-50 px-5 py-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-em-ink">Switch the app’s main locations to Sage’s</div>
          <p className="text-sm text-neutral-700">
            {oldLocations.length} {oldLocations.length === 1 ? 'location is' : 'locations are'} still from the Google Sheet ({oldLocations.map(loc => loc.name).join(', ')}).
            Do this once, before your first Sage upload, so Sage bins land in the right place.
          </p>
        </div>
        {!open && <button type="button" onClick={() => setOpen(true)} className="h-11 shrink-0 rounded-md bg-em-ink px-5 font-semibold text-white">Review the switch</button>}
      </div>

      {open && (
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-neutral-600">
            Sage’s main locations: {SAGE_NAMES.join(', ')}. For each current location, pick the Sage location it becomes.
            If it’s the first one picked for that Sage location, it’s simply renamed. Otherwise its stock moves in and it’s removed. Quantities never change.
          </p>
          <div className="overflow-x-auto rounded-md border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-em-page text-left text-xs font-semibold text-neutral-600">
                <tr><th className="px-3 py-2">Current location</th><th className="px-3 py-2 text-right">Parts</th><th className="px-3 py-2 text-right">Units</th><th className="px-3 py-2">Becomes</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {oldLocations.map(loc => (
                  <tr key={loc.id} className={!choices[loc.id] ? 'bg-amber-50' : undefined}>
                    <td className="px-3 py-2.5 font-semibold text-em-ink">{loc.name}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{usage.get(loc.id)?.parts.size || 0}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{(usage.get(loc.id)?.units || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5">
                      <select aria-label={`New location for ${loc.name}`} value={choices[loc.id] || ''} onChange={event => setChoices(prev => ({ ...prev, [loc.id]: event.target.value }))} className="form-control !w-auto min-w-[220px]">
                        <option value="">Choose…</option>
                        {SAGE_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                        <option value={KEEP}>Keep as its own location</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-md bg-em-page p-3"><div className="text-xs text-neutral-500">Renamed</div>{plan.rename.length ? plan.rename.map(r => <div key={r.id}>{r.from} → <b className="font-semibold">{r.to}</b></div>) : <div className="text-neutral-500">None</div>}</div>
            <div className="rounded-md bg-em-page p-3"><div className="text-xs text-neutral-500">Merged (stock moves, old location removed)</div>{plan.merge.length ? plan.merge.map(m => <div key={m.fromId}>{m.fromName} → <b className="font-semibold">{m.toName}</b></div>) : <div className="text-neutral-500">None</div>}</div>
            <div className="rounded-md bg-em-page p-3"><div className="text-xs text-neutral-500">Added empty</div>{plan.create.length ? <div>{plan.create.map(c => c.name).join(', ')}</div> : <div className="text-neutral-500">None</div>}</div>
          </div>
          {plan.merge.length > 0 && (
            <p className="text-sm text-neutral-700">
              Moves {plan.unitsMoved.toLocaleString()} units on {plan.stockMoves.length.toLocaleString()} stock records{plan.stockMoves.some(m => m.combined) ? '. Where a part is already in the target, the quantities are added together' : ''}.
            </p>
          )}
          {plan.binConflicts.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <b className="font-semibold">{plan.binConflicts.length} {plan.binConflicts.length === 1 ? 'part has' : 'parts have'} two different bins after combining.</b> The app keeps one bin per part per location, so the bin with more units is kept:
              <ul className="mt-1 list-disc pl-5">{plan.binConflicts.slice(0, 10).map(c => <li key={c.itemId + c.locationName}><span className="font-mono">{c.itemId}</span> in {c.locationName}: keeps {c.kept}, drops {c.dropped}</li>)}</ul>
              {plan.binConflicts.length > 10 && <div>…and {plan.binConflicts.length - 10} more.</div>}
            </div>
          )}
          {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-em-red-dark">{error}</p>}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            {unchosen.length > 0 && <p className="text-sm font-semibold text-amber-900 sm:mr-auto">Choose what {unchosen.map(loc => loc.name).join(', ')} {unchosen.length === 1 ? 'becomes' : 'become'}.</p>}
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-11 rounded-md border border-neutral-300 bg-white px-4 font-semibold text-em-ink hover:bg-neutral-50">Cancel</button>
            <button type="button" disabled={saving || unchosen.length > 0} onClick={() => void run()} className="h-11 rounded-md bg-em-red px-5 font-semibold text-white hover:bg-em-red-dark disabled:opacity-50">{saving ? 'Switching…' : 'Switch locations'}</button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SageLocationSwitch;
