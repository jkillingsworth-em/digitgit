import { useDialogFocus } from '../hooks/useDialogFocus';
import React, { useRef, useState } from 'react';
import type { InventoryItem, Location, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';

interface MoveStockModalProps {
  item: InventoryItem;
  locations: Location[];
  stock: Stock[];
  onClose: () => void;
  onMoveStock: (itemId: string, from: string, to: string, quantity: number, detail?: string) => Promise<{ fromQuantity: number; toQuantity: number }>;
  initialFromLocationId?: string;
}

const MoveStockModal: React.FC<MoveStockModalProps> = ({ item, locations, stock, onClose, onMoveStock, initialFromLocationId }) => {
  const [from, setFrom] = useState(initialFromLocationId || '');
  const [to, setTo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const dialog = useDialogFocus(true, () => { if (!busy.current) onClose(); });
  const [result, setResult] = useState<{ fromQuantity: number; toQuantity: number } | null>(null);
  const sources = locations.filter(loc => stock.some(s => s.itemId === item.id && s.locationId === loc.id && s.quantity > 0));
  const available = stock.filter(s => s.itemId === item.id && s.locationId === from).reduce((sum, s) => sum + s.quantity, 0);
  const fromName = locations.find(loc => loc.id === from)?.name || '';
  const destination = locations.find(loc => loc.id === to);
  const qty = Number(quantity);
  const valid = Boolean(from && to && from !== to && Number.isSafeInteger(qty) && qty > 0 && qty <= available);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    if (!valid) { setError('Choose two different locations and a whole-number quantity within the available stock.'); return; }
    busy.current = true;
    setSaving(true);
    setError('');
    try { setResult(await onMoveStock(item.id, from, to, qty, detail)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not move inventory. Please try again.'); }
    finally { busy.current = false; setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="move-title">
      <div ref={dialog} className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="move-title" className="!text-xl font-bold flex items-center gap-2"><ArrowRightLeftIcon className="h-5 w-5 text-em-red" />Move inventory</h2>
          <button type="button" disabled={saving} aria-label="Close transfer" onClick={onClose} className="h-11 w-11 flex items-center justify-center rounded-lg hover:bg-gray-100 disabled:opacity-40"><XMarkIcon className="h-6 w-6" /></button>
        </div>
        {result ? (
          <div className="space-y-5 p-5" role="status">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="text-emerald-900">Inventory moved</h3><p>Moved {qty.toLocaleString()} units of {item.id} from {fromName} to {destination?.name}.</p></div>
            <div><p className="mb-3 font-semibold text-gray-600">Balances after this transfer</p><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-gray-50 p-4"><p>{fromName}</p><strong className="text-3xl">{result.fromQuantity.toLocaleString()}</strong><p className="text-sm text-gray-500">units remaining</p></div><div className="rounded-xl bg-gray-50 p-4"><p>{destination?.name}</p><strong className="text-3xl">{result.toQuantity.toLocaleString()}</strong><p className="text-sm text-gray-500">units on hand</p></div></div></div>
            <button autoFocus type="button" onClick={onClose} className="w-full min-h-12 rounded-xl bg-em-red px-4 py-3 font-semibold text-white">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-5">
            <div><p className="text-lg font-bold text-gray-900">{item.description}</p><p className="text-sm text-gray-600">{item.id}</p></div>
            <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
              <label htmlFor="transfer-from" className="!text-sm">From<select data-initial-focus id="transfer-from" autoFocus required className="form-control mt-1 !text-base" value={from} onChange={e => { setFrom(e.target.value); setError(''); }}><option value="">Choose source location</option>{sources.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></label>
              {from && <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700"><strong className="text-lg">{available.toLocaleString()}</strong> units available at {fromName}</p>}
              <label htmlFor="transfer-to" className="!text-sm">To<select id="transfer-to" required className="form-control mt-1 !text-base" value={to} onChange={e => { setTo(e.target.value); setDetail(''); setError(''); }}><option value="">Choose destination location</option>{locations.filter(loc => loc.id !== from).map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</select></label>
              {destination?.subLocationPrompt && <label className="!text-sm">{destination.subLocationPrompt} (optional)<input className="form-control mt-1 !text-base" value={detail} onChange={e => setDetail(e.target.value)} /><span className="mt-1 block text-sm font-normal text-gray-500">Specify the shelf, bin, or rack.</span></label>}
              <label htmlFor="transfer-quantity" className="!text-sm">Quantity to move<input id="transfer-quantity" required type="number" inputMode="numeric" min={1} max={available} step={1} className="form-control mt-1 !text-3xl !font-bold" placeholder="0" value={quantity} onChange={e => { setQuantity(e.target.value); setError(''); }} /></label>
            </fieldset>
            {valid && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-base text-red-950">Move <strong>{qty.toLocaleString()} units</strong> from <strong>{fromName}</strong> to <strong>{destination?.name}</strong>{detail.trim() ? ` (${detail.trim()})` : ''}.</p>}
            {sources.length === 0 && <p className="text-sm text-gray-600">This product has no available stock to move.</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
            <div className="flex gap-3 border-t pt-4"><button type="button" disabled={saving} onClick={onClose} className="min-h-12 rounded-xl border px-4 py-3 font-semibold">Cancel</button><button type="submit" disabled={!valid || saving} className="min-h-12 flex-1 rounded-xl bg-em-red px-4 py-3 font-semibold text-white disabled:opacity-40">{saving ? 'Moving inventory…' : 'Confirm move'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
};
export default MoveStockModal;
