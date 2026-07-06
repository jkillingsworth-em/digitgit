import React, { useMemo } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { CheckIcon } from './icons/CheckIcon';

interface DesktopDashboardProps {
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    onInventoryManagement: () => void;
    onImportExportClick: () => void;
    onWarehouseClick: (locationId: string) => void;
    onAdminCategories: () => void;
    onAdminLocations: () => void;
    onDatabaseManagement: () => void;
    onTotalSkuClick: () => void;
    onWarehouseLoadClick: () => void;
    onCriticalAlertsClick: () => void;
}

const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
    items,
    stock,
    locations,
    onInventoryManagement,
    onImportExportClick,
    onWarehouseClick,
    onAdminCategories,
    onAdminLocations,
    onDatabaseManagement,
    onTotalSkuClick,
    onWarehouseLoadClick,
    onCriticalAlertsClick,
}) => {
    
    const warehouseData = useMemo(() => {
        return locations.map(loc => {
            const locStock = stock.filter(s => s.locationId === loc.id);
            const totalQty = locStock.reduce((sum, s) => sum + s.quantity, 0);
            const uniqueItems = new Set(locStock.map(s => s.itemId)).size;
            const catMap: Record<string, number> = {};
            locStock.forEach(s => {
                const item = items.find(i => i.id === s.itemId);
                const cat = item?.category || 'OTHER';
                catMap[cat] = (catMap[cat] || 0) + s.quantity;
            });
            const sortedCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
            return { ...loc, totalQty, uniqueItems, categories: sortedCategories };
        });
    }, [locations, stock, items]);

    const lowStockForecast = useMemo(() => {
        const itemStockMap = new Map<string, number>();
        stock.forEach(s => itemStockMap.set(s.itemId, (itemStockMap.get(s.itemId) || 0) + s.quantity));

        return items
            .map(item => {
                const qty = itemStockMap.get(item.id) || 0;
                const avg = item.priorUsage && item.priorUsage.length > 0 
                    ? item.priorUsage.reduce((s, u) => s + u.usage, 0) / (item.priorUsage.length * 12) 
                    : 0;
                const monthsLeft = avg > 0 ? qty / avg : 999;
                return { ...item, qty, monthsLeft };
            })
            .filter(i => i.monthsLeft < 6 || (i.lowAlertQuantity !== undefined && i.qty <= i.lowAlertQuantity))
            .sort((a, b) => a.monthsLeft - b.monthsLeft)
            .slice(0, 6);
    }, [items, stock]);

    return (
        <div className="space-y-8 animate-fade-in-down pb-12">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button type="button" onClick={onTotalSkuClick} className="bg-em-red p-7 rounded-2xl shadow-lg border border-red-900 text-white flex justify-between items-center transition-transform hover:scale-[1.01] text-left">
                    <div>
                        <div className="text-xs font-black uppercase tracking-[0.2em] opacity-80 mb-2">TOTAL SKU COUNT</div>
                        <div className="text-5xl font-black">{items.length}</div>
                    </div>
                    <div className="bg-white/10 p-3 rounded-2xl">
                        <DocumentChartBarIcon className="w-10 h-10 text-white" />
                    </div>
                </button>
                <button type="button" onClick={onWarehouseLoadClick} className="bg-white p-7 rounded-2xl shadow-md border border-gray-100 flex justify-between items-center transition-transform hover:scale-[1.01] text-left">
                    <div>
                        <div className="text-xs font-bold text-black uppercase tracking-[0.2em] mb-2">WAREHOUSE LOAD</div>
                        <div className="text-4xl font-black text-gray-900">{stock.reduce((s,i)=>s+i.quantity, 0).toLocaleString()} <span className="text-xl text-black font-bold ml-1">UNITS</span></div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-2xl text-gray-700">
                        <ArrowRightLeftIcon className="w-8 h-8" />
                    </div>
                </button>
                <button type="button" onClick={onCriticalAlertsClick} className="bg-white p-7 rounded-2xl shadow-md border border-gray-100 flex justify-between items-center transition-transform hover:scale-[1.01] text-left">
                    <div>
                        <div className="text-xs font-bold text-black uppercase tracking-[0.2em] mb-2">CRITICAL ALERTS</div>
                        <div className={`text-4xl font-black ${lowStockForecast.length > 0 ? 'text-em-red' : 'text-green-600'}`}>
                            {lowStockForecast.length} <span className="text-xl font-bold ml-1">CRITICAL</span>
                        </div>
                    </div>
                    <div className={`${lowStockForecast.length > 0 ? 'bg-red-50 text-red-200' : 'bg-green-50 text-green-200'} p-4 rounded-2xl`}>
                        <ExclamationTriangleIcon className="w-10 h-10" />
                    </div>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left: Action Hub */}
                <div className="lg:col-span-4 space-y-8">
                    <div>
                        <h3 className="text-sm font-black text-black uppercase tracking-[0.25em] px-1 mb-4 border-b border-gray-200 pb-2">ADMIN OPTIONS</h3>
                        <div className="grid grid-cols-1 gap-3">
                            <button onClick={onInventoryManagement} className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-em-red hover:shadow-md transition-all">
                                <div className="bg-red-50 text-em-red p-3 rounded-lg group-hover:bg-em-red group-hover:text-white transition-colors">
                                    <ListBulletIcon className="w-6 h-6" />
                                </div>
                                <div className="ml-4 text-left">
                                    <div className="text-base font-black text-gray-900 uppercase">Inventory Management</div>
                                    <div className="text-sm text-black font-bold uppercase tracking-wider mt-0.5 opacity-70">Add, edit, audit, and transfer from one console</div>
                                </div>
                            </button>
                            <button onClick={onAdminCategories} className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-black hover:shadow-md transition-all">
                                <div className="bg-gray-100 p-3 rounded-lg text-black">
                                    <PencilSquareIcon className="w-6 h-6" />
                                </div>
                                <div className="ml-4 text-left">
                                    <div className="text-base font-black text-gray-900 uppercase">Category Management</div>
                                    <div className="text-sm text-black font-bold uppercase tracking-wider mt-0.5">Define main and nested categories</div>
                                </div>
                            </button>
                            <button onClick={onAdminLocations} className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-black hover:shadow-md transition-all">
                                <div className="bg-gray-100 p-3 rounded-lg text-black">
                                    <MapPinIcon className="w-6 h-6" />
                                </div>
                                <div className="ml-4 text-left">
                                    <div className="text-base font-black text-gray-900 uppercase">Location Management</div>
                                    <div className="text-sm text-black font-bold uppercase tracking-wider mt-0.5">Maintain hubs and sub-locations</div>
                                </div>
                            </button>
                            <button onClick={onDatabaseManagement} className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-600 hover:shadow-md transition-all">
                                <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <CheckIcon className="w-6 h-6" />
                                </div>
                                <div className="ml-4 text-left">
                                    <div className="text-base font-black text-gray-900 uppercase">Database Management</div>
                                    <div className="text-sm text-black font-bold uppercase tracking-wider mt-0.5">Integrity checks, cleanup, and purges</div>
                                </div>
                            </button>
                            <button onClick={onImportExportClick} className="group flex items-center p-4 bg-white border border-gray-200 rounded-xl hover:border-em-red hover:shadow-md transition-all">
                                <div className="bg-stone-100 text-stone-600 p-3 rounded-lg group-hover:bg-em-red group-hover:text-white transition-colors">
                                    <DocumentChartBarIcon className="w-6 h-6" />
                                </div>
                                <div className="ml-4 text-left">
                                    <div className="text-base font-black text-gray-900 uppercase">Import / Export</div>
                                    <div className="text-sm text-black font-bold uppercase tracking-wider mt-0.5">Export by segment or queue new imports</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Low Stock List */}
                    <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-[0.2em]">LOW STOCK FORECAST</h3>
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="divide-y divide-gray-100">
                            {lowStockForecast.length === 0 ? (
                                <div className="p-8 text-center text-sm font-bold text-black uppercase tracking-widest italic">All stock levels nominal</div>
                            ) : (
                                lowStockForecast.map(item => (
                                    <div key={item.id} className="p-5 flex justify-between items-center group hover:bg-red-50 transition-colors cursor-pointer">
                                        <div className="min-w-0 pr-4">
                                            <div className="text-lg font-black text-em-red truncate uppercase transition-colors">{item.description}</div>
                                            <div className="text-base font-black text-black uppercase tracking-tight">{item.id}</div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className={`text-base font-black ${item.monthsLeft < 1.5 ? 'text-em-red animate-pulse' : 'text-amber-600'}`}>
                                                {item.monthsLeft < 1 ? 'REORDER' : `~${item.monthsLeft.toFixed(1)} MO`}
                                            </div>
                                            <div className="text-sm font-bold text-black uppercase tracking-tighter">{item.qty} ON HAND</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Visual Warehouse View */}
                <div className="lg:col-span-8 space-y-8">
                    <div>
                        <h3 className="text-sm font-black text-black uppercase tracking-[0.25em] px-1 mb-4 border-b border-gray-200 pb-2">WAREHOUSE SUPPLY MAP</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {warehouseData.map(wh => (
                                <div key={wh.id} className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 flex flex-col h-full hover:shadow-xl transition-shadow">
                                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-50">
                                        <div>
                                            <h4 className="text-3xl font-black text-gray-900 uppercase tracking-tight">{wh.name}</h4>
                                            <p className="text-sm font-black text-black uppercase tracking-[0.15em] mt-1">{wh.uniqueItems} UNIQUE COMPONENTS</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-black text-gray-900">{wh.totalQty.toLocaleString()}</div>
                                            <div className="text-sm font-black text-black uppercase tracking-widest">UNITS</div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-6 flex-grow">
                                        {wh.categories.slice(0, 4).map(([cat, qty]) => {
                                            const percent = wh.totalQty > 0 ? (qty / wh.totalQty) * 100 : 0;
                                            return (
                                                <div key={cat} className="group">
                                                    <div className="flex justify-between text-sm font-black text-black uppercase mb-2 tracking-tight group-hover:text-gray-900 transition-colors">
                                                        <span className="truncate pr-4">{cat}</span>
                                                        <span className="shrink-0">{qty.toLocaleString()}</span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                                        <div 
                                                            className="h-full bg-em-red rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(186,26,26,0.2)]" 
                                                            style={{ width: `${percent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {wh.categories.length > 4 && (
                                            <div className="pt-3">
                                                <button 
                                                    onClick={() => onWarehouseClick(wh.id)}
                                                    className="w-full bg-gray-50 py-2 px-3 rounded-lg text-center hover:bg-gray-100 transition-colors"
                                                >
                                                    <span className="text-sm font-black text-black uppercase tracking-widest">
                                                        + {wh.categories.length - 4} MORE CATEGORIES
                                                    </span>
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-8 pt-4">
                                        <button 
                                            onClick={() => onWarehouseClick(wh.id)} 
                                            className="w-full py-4 bg-white border border-gray-200 rounded-xl text-base font-black text-black uppercase tracking-[0.2em] hover:bg-gray-950 hover:text-white hover:border-gray-950 transition-all shadow-sm"
                                        >
                                            VIEW DETAILS
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DesktopDashboard;
