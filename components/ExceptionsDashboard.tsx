import React, { useMemo, useState } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CheckIcon } from './icons/CheckIcon';

export type ExceptionType =
  | 'sage_variance'
  | 'missing_sage'
  | 'sage_without_floor'
  | 'negative_stock'
  | 'orphan_stock'
  | 'incomplete_item';

export interface InventoryException {
  id: string;
  type: ExceptionType;
  itemId: string;
  description: string;
  floorQty: number;
  sageQty: number | null;
  sageAsOf: string;
  delta: number | null;
  locationsBreakdown: string;
}

interface ExceptionsDashboardProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  onBack: () => void;
  onSelectItem?: (itemId: string) => void;
}

const TYPE_LABELS: Record<ExceptionType, string> = {
  sage_variance: 'SAGE Variance',
  missing_sage: 'Missing SAGE',
  sage_without_floor: 'SAGE Without Floor',
  negative_stock: 'Negative Stock',
  orphan_stock: 'Orphan Stock',
  incomplete_item: 'Incomplete Item',
};

const TYPE_CHIP: Record<ExceptionType, string> = {
  sage_variance: 'bg-amber-50 text-amber-800 border-amber-200',
  missing_sage: 'bg-sky-50 text-sky-800 border-sky-200',
  sage_without_floor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  negative_stock: 'bg-red-50 text-red-800 border-red-200',
  orphan_stock: 'bg-rose-50 text-rose-800 border-rose-200',
  incomplete_item: 'bg-stone-50 text-stone-800 border-stone-200',
};

const ALL_TYPES: ExceptionType[] = [
  'sage_variance',
  'missing_sage',
  'sage_without_floor',
  'negative_stock',
  'orphan_stock',
  'incomplete_item',
];

function isSageDefined(value: number | undefined | null): value is number {
  return value !== undefined && value !== null && !Number.isNaN(Number(value));
}

function buildLocationBreakdown(
  itemStock: Stock[],
  locationNameById: Map<string, string>,
): string {
  if (itemStock.length === 0) return '—';
  return itemStock
    .map(s => {
      const name = locationNameById.get(s.locationId) || s.locationId;
      return `${name}:${s.quantity}`;
    })
    .join(' · ');
}

export function computeExceptions(
  items: InventoryItem[],
  stock: Stock[],
  locations: Location[],
): InventoryException[] {
  const locationNameById = new Map(locations.map(l => [l.id, l.name]));
  const itemById = new Map(items.map(i => [i.id, i]));
  const stockByItem = new Map<string, Stock[]>();
  stock.forEach(s => {
    const list = stockByItem.get(s.itemId) || [];
    list.push(s);
    stockByItem.set(s.itemId, list);
  });

  const floorQtyByItem = new Map<string, number>();
  stock.forEach(s => {
    floorQtyByItem.set(s.itemId, (floorQtyByItem.get(s.itemId) || 0) + s.quantity);
  });

  const results: InventoryException[] = [];

  items.forEach(item => {
    const floorQty = floorQtyByItem.get(item.id) || 0;
    const itemStock = stockByItem.get(item.id) || [];
    const breakdown = buildLocationBreakdown(itemStock, locationNameById);
    const sageDefined = isSageDefined(item.sageQty);
    const sageQty = sageDefined ? Number(item.sageQty) : null;
    const sageAsOf = item.sageAsOf || '';

    if (sageDefined && floorQty !== sageQty) {
      const delta = floorQty - sageQty!;
      results.push({
        id: `sage_variance:${item.id}`,
        type: 'sage_variance',
        itemId: item.id,
        description: item.description || item.name || '',
        floorQty,
        sageQty,
        sageAsOf,
        delta,
        locationsBreakdown: breakdown,
      });
    }

    if (floorQty > 0 && !sageDefined) {
      results.push({
        id: `missing_sage:${item.id}`,
        type: 'missing_sage',
        itemId: item.id,
        description: item.description || item.name || '',
        floorQty,
        sageQty: null,
        sageAsOf,
        delta: null,
        locationsBreakdown: breakdown,
      });
    }

    if (sageDefined && sageQty! > 0 && floorQty === 0) {
      results.push({
        id: `sage_without_floor:${item.id}`,
        type: 'sage_without_floor',
        itemId: item.id,
        description: item.description || item.name || '',
        floorQty,
        sageQty,
        sageAsOf,
        delta: floorQty - sageQty!,
        locationsBreakdown: breakdown,
      });
    }

    const missingDesc = !item.description || item.description.trim() === '';
    const missingCat = !item.category || item.category.trim() === '';
    if (missingDesc || missingCat) {
      results.push({
        id: `incomplete_item:${item.id}`,
        type: 'incomplete_item',
        itemId: item.id,
        description: item.description || item.name || '(no description)',
        floorQty,
        sageQty,
        sageAsOf,
        delta: null,
        locationsBreakdown: breakdown,
      });
    }
  });

  stock.forEach(entry => {
    if (entry.quantity < 0) {
      const item = itemById.get(entry.itemId);
      results.push({
        id: `negative_stock:${entry.docId || `${entry.itemId}_${entry.locationId}`}`,
        type: 'negative_stock',
        itemId: entry.itemId,
        description: item?.description || item?.name || '(orphan / unknown)',
        floorQty: floorQtyByItem.get(entry.itemId) || entry.quantity,
        sageQty: isSageDefined(item?.sageQty) ? Number(item!.sageQty) : null,
        sageAsOf: item?.sageAsOf || '',
        delta: null,
        locationsBreakdown: `${locationNameById.get(entry.locationId) || entry.locationId}:${entry.quantity}`,
      });
    }

    if (!itemById.has(entry.itemId)) {
      results.push({
        id: `orphan_stock:${entry.docId || `${entry.itemId}_${entry.locationId}`}`,
        type: 'orphan_stock',
        itemId: entry.itemId,
        description: '(no inventory item)',
        floorQty: entry.quantity,
        sageQty: null,
        sageAsOf: '',
        delta: null,
        locationsBreakdown: `${locationNameById.get(entry.locationId) || entry.locationId}:${entry.quantity}`,
      });
    }
  });

  const typeOrder = new Map(ALL_TYPES.map((t, i) => [t, i]));
  results.sort((a, b) => {
    const typeDiff = (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99);
    if (typeDiff !== 0) return typeDiff;
    if (a.type === 'sage_variance') {
      return Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0);
    }
    return a.itemId.localeCompare(b.itemId);
  });

  return results;
}

const ExceptionsDashboard: React.FC<ExceptionsDashboardProps> = ({
  items,
  stock,
  locations,
  onBack,
  onSelectItem,
}) => {
  const exceptions = useMemo(
    () => computeExceptions(items, stock, locations),
    [items, stock, locations],
  );

  const counts = useMemo(() => {
    const map = Object.fromEntries(ALL_TYPES.map(t => [t, 0])) as Record<ExceptionType, number>;
    exceptions.forEach(ex => {
      map[ex.type] += 1;
    });
    return map;
  }, [exceptions]);

  const [activeTypes, setActiveTypes] = useState<Set<ExceptionType>>(() => new Set(ALL_TYPES));

  const filtered = useMemo(
    () => exceptions.filter(ex => activeTypes.has(ex.type)),
    [exceptions, activeTypes],
  );

  const toggleType = (type: ExceptionType) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selectAllTypes = () => setActiveTypes(new Set(ALL_TYPES));
  const clearTypes = () => setActiveTypes(new Set());

  const isHealthy = exceptions.length === 0;

  return (
    <div className="animate-fade-in-down pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
            {isHealthy ? (
              <CheckIcon className="w-8 h-8 text-green-600" />
            ) : (
              <ExclamationTriangleIcon className="w-8 h-8 text-amber-500" />
            )}{' '}
            Inventory Exceptions
          </h2>
          <p className="text-sm font-bold text-gray-500 mt-1 normal-case tracking-normal">
            Floor (digitgit) vs SAGE snapshot and data-health checks. digitgit remains floor system of record.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-gray-100 text-gray-800 font-bold uppercase rounded-lg hover:bg-gray-200 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {ALL_TYPES.map(type => {
          const active = activeTypes.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                active ? TYPE_CHIP[type] : 'bg-white text-gray-400 border-gray-200 opacity-60'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-80">
                {TYPE_LABELS[type]}
              </div>
              <div className="text-2xl font-black mt-1">{counts[type]}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          type="button"
          onClick={selectAllTypes}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[10px] font-black uppercase tracking-wider"
        >
          All types
        </button>
        <button
          type="button"
          onClick={clearTypes}
          className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-black uppercase tracking-wider border border-gray-200"
        >
          Clear
        </button>
        <span className="self-center text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">
          Showing {filtered.length} of {exceptions.length}
        </span>
      </div>

      {isHealthy ? (
        <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-green-200">
          <CheckIcon className="w-16 h-16 text-green-200 mx-auto mb-4" />
          <h3 className="text-lg font-black text-green-800 uppercase">No Exceptions</h3>
          <p className="text-sm font-medium text-green-700 mt-2 normal-case tracking-normal">
            Floor quantities and SAGE snapshots look aligned, and data health checks passed.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-gray-200">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            No exceptions match the selected filters.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 font-black text-gray-500 uppercase">Item ID</th>
                  <th className="p-3 font-black text-gray-500 uppercase">Description</th>
                  <th className="p-3 font-black text-gray-500 uppercase text-right">Floor</th>
                  <th className="p-3 font-black text-gray-500 uppercase text-right">SAGE</th>
                  <th className="p-3 font-black text-gray-500 uppercase">SAGE As-Of</th>
                  <th className="p-3 font-black text-gray-500 uppercase text-right">Delta</th>
                  <th className="p-3 font-black text-gray-500 uppercase">Type</th>
                  <th className="p-3 font-black text-gray-500 uppercase">Locations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(ex => (
                  <tr
                    key={ex.id}
                    className={`hover:bg-red-50/40 ${onSelectItem ? 'cursor-pointer' : ''}`}
                    onClick={() => onSelectItem?.(ex.itemId)}
                  >
                    <td className="p-3 font-mono font-bold text-gray-900">{ex.itemId}</td>
                    <td className="p-3 font-medium text-gray-700 normal-case tracking-normal max-w-xs truncate">
                      {ex.description}
                    </td>
                    <td className="p-3 font-bold text-gray-900 text-right tabular-nums">{ex.floorQty}</td>
                    <td className="p-3 font-bold text-gray-700 text-right tabular-nums">
                      {ex.sageQty === null ? '—' : ex.sageQty}
                    </td>
                    <td className="p-3 font-medium text-gray-600 normal-case tracking-normal">
                      {ex.sageAsOf || '—'}
                    </td>
                    <td
                      className={`p-3 font-black text-right tabular-nums ${
                        ex.delta === null
                          ? 'text-gray-400'
                          : ex.delta === 0
                            ? 'text-gray-700'
                            : ex.delta > 0
                              ? 'text-emerald-700'
                              : 'text-em-red'
                      }`}
                    >
                      {ex.delta === null ? '—' : ex.delta > 0 ? `+${ex.delta}` : ex.delta}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${TYPE_CHIP[ex.type]}`}
                      >
                        {TYPE_LABELS[ex.type]}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-gray-600 normal-case tracking-normal whitespace-nowrap">
                      {ex.locationsBreakdown}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExceptionsDashboard;
