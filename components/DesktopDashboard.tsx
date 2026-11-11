import React, { useMemo, useState } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { CameraIcon } from './icons/CameraIcon';
import { CheckIcon } from './icons/CheckIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';

interface DesktopDashboardProps {
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    isAdmin: boolean;
    onInventoryManagement: () => void;
    onImportExportClick: () => void;
    onSyncEmSheetClick?: () => void;
    onWarehouseClick: (locationId: string) => void;
    onAdminCategories: () => void;
    onAdminLocations: () => void;
    onDatabaseManagement: () => void;
    onExceptionsClick?: () => void;
    onCycleCountClick?: () => void;
    onTotalSkuClick: () => void;
    onWarehouseLoadClick: () => void;
    onCriticalAlertsClick: () => void;
    // Task-first home page actions
    onSearch?: (query: string) => void;
    onScanClick?: () => void;
    onMoveClick?: () => void;
    onReceiveClick?: () => void;
    onPrintLabelsClick?: () => void;
}

const formatNumber = (value: number) => value.toLocaleString();

const CoverChip: React.FC<{ monthsLeft: number; atOrBelowAlert: boolean }> = ({ monthsLeft, atOrBelowAlert }) => {
    if (monthsLeft < 1 || (atOrBelowAlert && monthsLeft >= 999)) {
        return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-red-50 px-2.5 text-xs font-semibold text-em-red">Reorder now</span>;
    }
    if (monthsLeft < 2) {
        return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-red-50 px-2.5 text-xs font-semibold text-em-red">{monthsLeft.toFixed(1)} mo left</span>;
    }
    if (monthsLeft >= 999) {
        return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-amber-100 px-2.5 text-xs font-semibold text-amber-800">At alert level</span>;
    }
    return <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-amber-100 px-2.5 text-xs font-semibold text-amber-800">{monthsLeft.toFixed(1)} mo left</span>;
};

const TaskCard: React.FC<{ icon: React.ReactNode; title: string; hint: string; onClick?: () => void }> = ({ icon, title, hint, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className="flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-5 text-left shadow-md transition-colors hover:border-em-red disabled:opacity-50"
    >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-50 text-em-red">{icon}</span>
        <span className="min-w-0">
            <span className="block text-base font-semibold text-em-ink">{title}</span>
            <span className="block text-[13px] text-neutral-500">{hint}</span>
        </span>
    </button>
);

const StatButton: React.FC<{ label: string; value: string; note?: string; tone?: 'critical'; onClick?: () => void }> = ({ label, value, note, tone, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="flex-1 border-l border-neutral-200 px-6 py-1 text-left first:border-l-0 first:pl-0 hover:[&_.stat-value]:underline"
    >
        <span className="block text-sm text-neutral-500">{label}</span>
        <span className={`stat-value block text-2xl font-bold tabular-nums ${tone === 'critical' ? 'text-em-red' : 'text-em-ink'}`}>{value}</span>
        {note && <span className="block text-xs text-neutral-500">{note}</span>}
    </button>
);

const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
    items,
    stock,
    locations,
    isAdmin,
    onWarehouseClick,
    onCycleCountClick,
    onTotalSkuClick,
    onWarehouseLoadClick,
    onCriticalAlertsClick,
    onSearch,
    onScanClick,
    onMoveClick,
    onReceiveClick,
    onPrintLabelsClick,
}) => {
    const [query, setQuery] = useState('');

    const totalUnits = useMemo(() => stock.reduce((sum, s) => sum + s.quantity, 0), [stock]);

    const warehouseData = useMemo(() => {
        return locations
            .map(loc => {
                const locStock = stock.filter(s => s.locationId === loc.id);
                const totalQty = locStock.reduce((sum, s) => sum + s.quantity, 0);
                const uniqueItems = new Set(locStock.map(s => s.itemId)).size;
                return { ...loc, totalQty, uniqueItems };
            })
            .sort((a, b) => b.totalQty - a.totalQty);
    }, [locations, stock]);
    const maxLocationQty = Math.max(1, ...warehouseData.map(w => w.totalQty));

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
                const atOrBelowAlert = item.lowAlertQuantity !== undefined && qty <= item.lowAlertQuantity;
                return { ...item, qty, monthsLeft, atOrBelowAlert };
            })
            .filter(i => i.monthsLeft < 6 || i.atOrBelowAlert)
            .sort((a, b) => a.monthsLeft - b.monthsLeft);
    }, [items, stock]);

    const submitSearch = (event: React.FormEvent) => {
        event.preventDefault();
        onSearch?.(query.trim());
    };

    return (
        <div className="animate-fade-in-down pb-12">
            {/* Search band */}
            <section className="-mx-4 -mt-4 bg-em-red px-4 pb-20 pt-9 text-white md:-mx-8 md:-mt-8 md:px-8">
                <h1 className="text-[30px] font-bold leading-[38px] tracking-tight">What are you looking for?</h1>
                <p className="mt-1 text-[15px] text-white/85">
                    {formatNumber(items.length)} parts · {formatNumber(totalUnits)} units across {locations.length} {locations.length === 1 ? 'location' : 'locations'}
                </p>
                <form onSubmit={submitSearch} className="mt-5 flex max-w-4xl gap-3" role="search">
                    <label className="relative flex-1 !mb-0">
                        <span className="sr-only">Search inventory</span>
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" />
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Part number, description or location…"
                            className="h-14 w-full rounded-lg border-0 pl-12 pr-4 text-base shadow-lg focus:outline-none focus:ring-4 focus:ring-white/40"
                        />
                    </label>
                    <button type="submit" className="h-14 rounded-lg border border-white/60 px-5 text-[15px] font-semibold text-white hover:bg-white/10">
                        Search
                    </button>
                    {onScanClick && (
                        <button type="button" onClick={onScanClick} className="flex h-14 items-center gap-2 rounded-lg bg-em-ink px-5 text-[15px] font-semibold text-white hover:bg-black">
                            <CameraIcon className="h-5 w-5" />
                            Scan
                        </button>
                    )}
                </form>
            </section>

            {/* Everyday tasks */}
            <div className="-mt-12 grid grid-cols-2 gap-4 xl:grid-cols-4">
                <TaskCard icon={<CameraIcon className="h-6 w-6" />} title="Scan a barcode" hint="Look up or move a part" onClick={onScanClick} />
                <TaskCard icon={<ArrowRightLeftIcon className="h-6 w-6" />} title="Move stock" hint="Between locations or bins" onClick={onMoveClick} />
                {isAdmin && onReceiveClick ? (
                    <TaskCard icon={<ArrowDownTrayIcon className="h-6 w-6" />} title="Receive stock" hint="Add new or existing items" onClick={onReceiveClick} />
                ) : (
                    <TaskCard icon={<PrinterIcon className="h-6 w-6" />} title="Print labels" hint="Bin and item barcodes" onClick={onPrintLabelsClick} />
                )}
                <TaskCard icon={<CheckIcon className="h-6 w-6" />} title="Cycle count" hint={isAdmin ? 'Count or approve' : 'Count a location'} onClick={onCycleCountClick} />
            </div>

            {/* At a glance: each number opens its detail view */}
            <div className="mt-7 flex rounded-lg border border-neutral-200 bg-white px-6 py-4">
                <StatButton label="Active parts" value={formatNumber(items.length)} onClick={onTotalSkuClick} />
                <StatButton label="Units on hand" value={formatNumber(totalUnits)} note={`Across ${locations.length} locations`} onClick={onWarehouseLoadClick} />
                <StatButton
                    label="Need reordering"
                    value={formatNumber(lowStockForecast.length)}
                    note="Under 6 months of cover or at alert level"
                    tone={lowStockForecast.length > 0 ? 'critical' : undefined}
                    onClick={onCriticalAlertsClick}
                />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Reorder soon */}
                <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                        <div>
                            <h2 className="!mb-0 text-base font-semibold text-em-ink">Reorder soon</h2>
                            <p className="text-[13px] text-neutral-500">
                                {lowStockForecast.length === 0 ? 'All stock levels are fine' : `${lowStockForecast.length} ${lowStockForecast.length === 1 ? 'item needs' : 'items need'} attention`}
                            </p>
                        </div>
                        {lowStockForecast.length > 0 && (
                            <button type="button" onClick={onCriticalAlertsClick} className="text-[13px] font-semibold text-em-red hover:underline">View all</button>
                        )}
                    </div>
                    {lowStockForecast.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-neutral-500">Nothing to reorder right now.</div>
                    ) : (
                        <ul className="divide-y divide-neutral-200">
                            {lowStockForecast.slice(0, 6).map(item => (
                                <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate font-semibold text-em-ink">{item.description}</div>
                                        <div className="text-xs text-neutral-500">
                                            <span className="font-mono">{item.id}</span> · {formatNumber(item.qty)} on hand
                                        </div>
                                    </div>
                                    <CoverChip monthsLeft={item.monthsLeft} atOrBelowAlert={item.atOrBelowAlert} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* Stock by location */}
                <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                        <div>
                            <h2 className="!mb-0 text-base font-semibold text-em-ink">Stock by location</h2>
                            <p className="text-[13px] text-neutral-500">Units on hand, on one scale</p>
                        </div>
                        <button type="button" onClick={onWarehouseLoadClick} className="text-[13px] font-semibold text-em-red hover:underline">Details</button>
                    </div>
                    <ul className="divide-y divide-neutral-200">
                        {warehouseData.map(wh => (
                            <li key={wh.id}>
                                <button type="button" onClick={() => onWarehouseClick(wh.id)} className="block w-full px-5 py-3 text-left hover:bg-neutral-50">
                                    <div className="mb-2 flex items-baseline justify-between gap-3">
                                        <span className="truncate font-semibold text-em-ink">{wh.name}</span>
                                        <span className="shrink-0 text-sm text-neutral-500">
                                            <b className="font-semibold text-em-ink tabular-nums">{formatNumber(wh.totalQty)}</b> units · {wh.uniqueItems} {wh.uniqueItems === 1 ? 'part' : 'parts'}
                                        </span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                                        <div className="h-full rounded-full bg-em-ink" style={{ width: `${(wh.totalQty / maxLocationQty) * 100}%` }} />
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default DesktopDashboard;
