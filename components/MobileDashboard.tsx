import React, { useEffect, useMemo, useState } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { ClockIcon } from './icons/ClockIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface MobileDashboardProps {
  onScanClick: () => void;
  onFindClick: () => void;
  onMoveClick: () => void;
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  onWarehouseClick: (locationId: string) => void;
  onViewAllInventory: () => void;
  onViewCategories: () => void;
  onViewLocations: () => void;
  onCycleCountClick: () => void;
  onOpenWarehouseSummary: () => void;
  onOpenCriticalAlerts: () => void;
}


const MobileDashboard: React.FC<MobileDashboardProps> = ({
  onScanClick, onFindClick, onMoveClick,
  items,
  stock,
  locations,
  onWarehouseClick,
  onViewAllInventory,
  onViewCategories,
  onViewLocations,
  onCycleCountClick,
  onOpenWarehouseSummary,
  onOpenCriticalAlerts,
}) => {
  const [isNotificationDismissed, setIsNotificationDismissed] = useState(false);

  const warehouseData = useMemo(() => {
    return locations.map(loc => {
      const locStock = stock.filter(s => s.locationId === loc.id);
      const totalQty = locStock.reduce((sum, s) => sum + s.quantity, 0);
      const uniqueItems = new Set(locStock.map(s => s.itemId)).size;
      return { ...loc, totalQty, uniqueItems };
    });
  }, [locations, stock]);

  const lowStockForecast = useMemo(() => {
    const itemStockMap = new Map<string, number>();
    stock.forEach(s => itemStockMap.set(s.itemId, (itemStockMap.get(s.itemId) || 0) + s.quantity));

    return items
      .map(item => {
        const qty = itemStockMap.get(item.id) || 0;
        const avg = item.priorUsage && item.priorUsage.length > 0 ? item.priorUsage.reduce((sum, u) => sum + u.usage, 0) / (item.priorUsage.length * 12) : 0;
        const monthsLeft = avg > 0 ? qty / avg : 999;
        return { ...item, qty, monthsLeft };
      })
      .filter(i => i.monthsLeft < 6 || (i.lowAlertQuantity !== undefined && i.qty <= i.lowAlertQuantity))
      .sort((a, b) => a.monthsLeft - b.monthsLeft);
  }, [items, stock]);

  const uncategorizedCount = useMemo(() => items.filter(item => !item.category?.trim()).length, [items]);
  const totalUnits = useMemo(() => stock.reduce((sum, entry) => sum + entry.quantity, 0), [stock]);
  const uniqueCategoryCount = useMemo(() => new Set(items.map(item => (item.category || '').trim()).filter(Boolean)).size, [items]);
  const lowStockAlertCount = lowStockForecast.length;
  const hasNotifications = lowStockAlertCount > 0 || uncategorizedCount > 0;
  const notificationVersion = `${lowStockAlertCount}-${uncategorizedCount}`;

  useEffect(() => {
    const dismissedVersion = window.localStorage.getItem('mobileDashboardNotificationsDismissedVersion');
    setIsNotificationDismissed(dismissedVersion === notificationVersion);
  }, [notificationVersion]);

  const dismissNotifications = () => {
    window.localStorage.setItem('mobileDashboardNotificationsDismissedVersion', notificationVersion);
    setIsNotificationDismissed(true);
  };

  const maxLocationQty = Math.max(1, ...warehouseData.map(w => w.totalQty));

  return (
    <div className="space-y-5 pb-4">
      {/* Search band */}
      <section className="-mx-4 -mt-4 bg-em-red px-4 pb-14 pt-5 text-white">
        <h2 className="!mb-0 text-[22px] font-bold leading-7 text-white">What are you looking for?</h2>
        <button
          type="button"
          onClick={onFindClick}
          className="mt-3 flex h-12 w-full items-center gap-2.5 rounded-lg bg-white px-3.5 text-left text-[15px] text-neutral-500 shadow-md"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
          Part, description or location…
        </button>
      </section>

      {/* Everyday tasks */}
      <div className="-mt-14 grid grid-cols-2 gap-2.5">
        {[
          { icon: <CameraIcon className="h-5 w-5" />, title: 'Scan a barcode', hint: 'Look up or move', onClick: onScanClick },
          { icon: <ArrowRightLeftIcon className="h-5 w-5" />, title: 'Move stock', hint: 'Between bins', onClick: onMoveClick },
          { icon: <ClockIcon className="h-5 w-5" />, title: 'Cycle count', hint: 'Count a location', onClick: onCycleCountClick },
          { icon: <MapPinIcon className="h-5 w-5" />, title: 'Locations', hint: `${locations.length} sites`, onClick: onViewLocations },
        ].map(task => (
          <button key={task.title} type="button" onClick={task.onClick} className="min-h-[92px] rounded-lg border border-neutral-200 bg-white p-3.5 text-left shadow-md active:bg-neutral-50">
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-em-red">{task.icon}</span>
            <span className="block font-semibold text-em-ink">{task.title}</span>
            <span className="block text-xs text-neutral-500">{task.hint}</span>
          </button>
        ))}
      </div>

      {hasNotifications && !isNotificationDismissed && (
        <div className="flex items-start gap-3 rounded-lg bg-amber-100 px-4 py-3 text-sm text-amber-900" role="status">
          <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            {lowStockAlertCount > 0 && <div>{lowStockAlertCount} {lowStockAlertCount === 1 ? 'item needs' : 'items need'} reordering.</div>}
            {uncategorizedCount > 0 && <div>{uncategorizedCount} {uncategorizedCount === 1 ? 'product has' : 'products have'} no category.</div>}
          </div>
          <button aria-label="Dismiss notifications" onClick={dismissNotifications} className="-m-1 rounded p-1 text-amber-900 active:bg-amber-200">
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* At a glance */}
      <div className="grid grid-cols-3 divide-x divide-neutral-200 rounded-lg border border-neutral-200 bg-white py-3">
        <button type="button" onClick={onViewAllInventory} className="px-3 text-left">
          <span className="block text-xs text-neutral-500">Parts</span>
          <span className="block text-lg font-bold tabular-nums text-em-ink">{items.length.toLocaleString()}</span>
        </button>
        <button type="button" onClick={onOpenWarehouseSummary} className="px-3 text-left">
          <span className="block text-xs text-neutral-500">Units</span>
          <span className="block text-lg font-bold tabular-nums text-em-ink">{totalUnits.toLocaleString()}</span>
        </button>
        <button type="button" onClick={onOpenCriticalAlerts} className="px-3 text-left">
          <span className="block text-xs text-neutral-500">Reorder</span>
          <span className={`block text-lg font-bold tabular-nums ${lowStockAlertCount > 0 ? 'text-em-red' : 'text-em-ink'}`}>{lowStockAlertCount}</span>
        </button>
      </div>

      {/* Reorder soon */}
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="!mb-0 text-base font-semibold text-em-ink">Reorder soon</h3>
          {lowStockAlertCount > 0 && <button onClick={onOpenCriticalAlerts} className="text-[13px] font-semibold text-em-red">View all</button>}
        </div>
        {lowStockForecast.length === 0 ? (
          <p className="border-t border-neutral-200 px-4 py-6 text-center text-sm text-neutral-500">Nothing to reorder right now.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
            {lowStockForecast.slice(0, 5).map(item => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-em-ink">{item.description}</div>
                  <div className="text-xs text-neutral-500"><span className="font-mono">{item.id}</span> · {item.qty} on hand</div>
                </div>
                <span className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold ${item.monthsLeft < 2 || item.monthsLeft >= 999 ? 'bg-red-50 text-em-red' : 'bg-amber-100 text-amber-800'}`}>
                  {item.monthsLeft < 1 || item.monthsLeft >= 999 ? 'Reorder now' : `${item.monthsLeft.toFixed(1)} mo left`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Stock by location */}
      <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="!mb-0 text-base font-semibold text-em-ink">Stock by location</h3>
          <button onClick={onViewCategories} className="text-[13px] font-semibold text-em-red">{uniqueCategoryCount} categories</button>
        </div>
        <ul className="divide-y divide-neutral-200 border-t border-neutral-200">
          {warehouseData.map(wh => (
            <li key={wh.id}>
              <button onClick={() => onWarehouseClick(wh.id)} className="block w-full px-4 py-3 text-left active:bg-neutral-50">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold text-em-ink">{wh.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500"><b className="font-semibold text-em-ink">{wh.totalQty.toLocaleString()}</b> units · {wh.uniqueItems} {wh.uniqueItems === 1 ? 'part' : 'parts'}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
                  <div className="h-full rounded-full bg-em-ink" style={{ width: `${(wh.totalQty / maxLocationQty) * 100}%` }} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default MobileDashboard;
