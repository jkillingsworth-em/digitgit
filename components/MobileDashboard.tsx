import React, { useEffect, useMemo, useState } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface MobileDashboardProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  onWarehouseClick: (locationId: string) => void;
  onViewAllInventory: () => void;
  onViewCategories: () => void;
  onViewLocations: () => void;
}

const PanelTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.16em]">{children}</h3>;

const MobileDashboard: React.FC<MobileDashboardProps> = ({
  items,
  stock,
  locations,
  onWarehouseClick,
  onViewAllInventory,
  onViewCategories,
  onViewLocations,
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
      .sort((a, b) => a.monthsLeft - b.monthsLeft)
      .slice(0, 5);
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

  return (
    <div className="space-y-5 p-4 pb-24 bg-gradient-to-b from-gray-50 to-gray-100/70">
      {!isNotificationDismissed && (
        <section className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PanelTitle>Notifications</PanelTitle>
              <ExclamationTriangleIcon className="h-4 w-4 text-amber-500" />
            </div>
            <button onClick={dismissNotifications} className="h-7 w-7 rounded-full bg-white/80 border border-amber-200 flex items-center justify-center text-gray-700">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-2 space-y-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-700">
            {hasNotifications ? (
              <>
                {lowStockAlertCount > 0 && <div>{lowStockAlertCount} low inventory alert{lowStockAlertCount === 1 ? '' : 's'}.</div>}
                {uncategorizedCount > 0 && <div>{uncategorizedCount} unassigned product alert{uncategorizedCount === 1 ? '' : 's'}.</div>}
              </>
            ) : (
              <div>You have 0 new notifications.</div>
            )}
          </div>
          <div className="mt-3">
            <button onClick={dismissNotifications} className="text-[11px] font-black uppercase tracking-wider text-em-red">Dismiss</button>
          </div>
        </section>
      )}

      <section className="grid grid-cols-3 gap-2">
        <button onClick={onViewAllInventory} className="rounded-xl border border-red-100 bg-white p-3 shadow-sm text-left">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Products</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{items.length}</div>
        </button>
        <button onClick={onViewCategories} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm text-left">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Categories</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{uniqueCategoryCount}</div>
        </button>
        <button onClick={onViewLocations} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm text-left">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">Locations</div>
          <div className="mt-1 text-2xl font-black text-gray-900">{locations.length}</div>
        </button>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <PanelTitle>Warehouse Supply Map</PanelTitle>
          <MapPinIcon className="h-4 w-4 text-gray-500" />
        </div>
        <div className="space-y-2">
          {warehouseData.map(wh => {
            const widthPercent = totalUnits > 0 ? (wh.totalQty / totalUnits) * 100 : 0;
            return (
              <button key={wh.id} onClick={() => onWarehouseClick(wh.id)} className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-left">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black uppercase text-gray-900">{wh.name}</div>
                  <div className="text-[11px] font-bold uppercase text-gray-600">{wh.uniqueItems} items</div>
                </div>
                <div className="mt-1 text-sm font-black text-em-red">{wh.totalQty.toLocaleString()} units</div>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-em-red" style={{ width: `${Math.max(widthPercent, 2)}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <PanelTitle>Low Stock Forecast</PanelTitle>
          <DocumentChartBarIcon className="h-4 w-4 text-em-red" />
        </div>
        <div className="divide-y divide-gray-100">
          {lowStockForecast.length === 0 ? (
            <div className="p-4 text-xs font-bold uppercase tracking-wider text-gray-500">All stock levels nominal.</div>
          ) : (
            lowStockForecast.map(item => (
              <div key={item.id} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase text-em-red truncate">{item.description || item.id}</div>
                  <div className="text-[11px] font-bold uppercase text-gray-600 truncate">{item.id}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-gray-900">{item.qty} on hand</div>
                  <div className={`text-[11px] font-black uppercase ${item.monthsLeft < 1.5 ? 'text-em-red' : 'text-amber-600'}`}>
                    {item.monthsLeft < 1 ? 'reorder' : `~${item.monthsLeft.toFixed(1)} mo`}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default MobileDashboard;
