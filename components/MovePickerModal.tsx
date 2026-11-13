import React, { useMemo, useState } from 'react';
import type { InventoryItem, Stock } from '../types';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { XMarkIcon } from './icons/XMarkIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';

interface MovePickerModalProps {
  items: InventoryItem[];
  stock: Stock[];
  onClose: () => void;
  onPick: (item: InventoryItem) => void;
}

const MAX_RESULTS = 50;

/** First step of "Move stock" from the home page: choose the part, then the usual Move dialog opens. */
const MovePickerModal: React.FC<MovePickerModalProps> = ({ items, stock, onClose, onPick }) => {
  const [query, setQuery] = useState('');
  const dialog = useDialogFocus(true, onClose);

  const onHand = useMemo(() => {
    const totals = new Map<string, number>();
    stock.forEach(s => totals.set(s.itemId, (totals.get(s.itemId) || 0) + s.quantity));
    return totals;
  }, [stock]);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const movable = items.filter(item => (onHand.get(item.id) || 0) > 0);
    if (terms.length === 0) return movable;
    return movable.filter(item => {
      const haystack = `${item.id} ${item.description} ${item.category || ''}`.toLowerCase();
      return terms.every(term => haystack.includes(term));
    });
  }, [items, onHand, query]);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-3 pt-[10vh]" role="dialog" aria-modal="true" aria-labelledby="move-picker-title">
      <div ref={dialog} className="flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id="move-picker-title" className="!mb-0 flex items-center gap-2 text-lg font-bold text-em-ink">
            <ArrowRightLeftIcon className="h-5 w-5 text-em-red" />
            Which part are you moving?
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-neutral-200 p-4">
          <label className="relative !mb-0 block">
            <span className="sr-only">Search parts</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
            <input
              data-initial-focus
              autoFocus
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => { if (event.key === 'Enter' && results.length === 1) onPick(results[0]); }}
              placeholder="Item code or description…"
              className="form-control !pl-10 !text-base"
            />
          </label>
        </div>
        <ul className="flex-1 divide-y divide-neutral-200 overflow-y-auto">
          {results.slice(0, MAX_RESULTS).map(item => (
            <li key={item.id}>
              <button type="button" onClick={() => onPick(item)} className="flex w-full items-center gap-4 px-5 py-3 text-left hover:bg-neutral-50 active:bg-neutral-100">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-em-ink">{item.description}</div>
                  <div className="font-mono text-xs text-neutral-600">{item.id}</div>
                </div>
                <span className="shrink-0 text-sm text-neutral-600"><b className="font-semibold tabular-nums text-em-ink">{(onHand.get(item.id) || 0).toLocaleString()}</b> on hand</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-neutral-500">No parts with stock match “{query.trim()}”.</li>
          )}
        </ul>
        {results.length > MAX_RESULTS && (
          <p className="border-t border-neutral-200 px-5 py-2.5 text-xs text-neutral-500">Showing the first {MAX_RESULTS} of {results.length.toLocaleString()}. Keep typing to narrow it down.</p>
        )}
      </div>
    </div>
  );
};

export default MovePickerModal;
