import React, { useMemo } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';

export type DashboardMetricDetailView = 'dashboard-sku' | 'dashboard-warehouse-load' | 'dashboard-critical-alerts';

interface DashboardMetricDetailProps {
    view: DashboardMetricDetailView;
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    onBack: () => void;
    onOpenLocationInventory: (locationId: string) => void;
}

const DashboardMetricDetail: React.FC<DashboardMetricDetailProps> = ({
    view,
    items,
    stock,
    locations,
    onBack,
    onOpenLocationInventory,
}) => {
    const totalUnits = useMemo(() => stock.reduce((sum, entry) => sum + entry.quantity, 0), [stock]);

    const totalQuantityByItem = useMemo(() => {
        const totals = new Map<string, number>();
        stock.forEach(entry => {
            totals.set(entry.itemId, (totals.get(entry.itemId) || 0) + entry.quantity);
        });
        return totals;
    }, [stock]);

    const warehouseBreakdown = useMemo(() => {
        return locations
            .map(location => {
                const locationStock = stock.filter(entry => entry.locationId === location.id);
                const unitCount = locationStock.reduce((sum, entry) => sum + entry.quantity, 0);
                const skuCount = new Set(locationStock.map(entry => entry.itemId)).size;

                return {
                    id: location.id,
                    name: location.name,
                    unitCount,
                    skuCount,
                    share: totalUnits > 0 ? (unitCount / totalUnits) * 100 : 0,
                };
            })
            .sort((left, right) => right.unitCount - left.unitCount);
    }, [locations, stock, totalUnits]);

    const categoryBreakdown = useMemo(() => {
        const counts = new Map<string, number>();
        items.forEach(item => {
            const key = (item.category || 'Uncategorized').trim() || 'Uncategorized';
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        return Array.from(counts.entries())
            .map(([name, count]) => ({
                name,
                count,
                share: items.length > 0 ? (count / items.length) * 100 : 0,
            }))
            .sort((left, right) => right.count - left.count);
    }, [items]);

    const uncategorizedItems = useMemo(
        () => items.filter(item => !(item.category || '').trim()).slice(0, 8),
        [items],
    );

    const criticalAlerts = useMemo(() => {
        return items
            .map(item => {
                const quantity = totalQuantityByItem.get(item.id) || 0;
                const monthlyUsage = item.priorUsage && item.priorUsage.length > 0
                    ? item.priorUsage.reduce((sum, usage) => sum + usage.usage, 0) / (item.priorUsage.length * 12)
                    : 0;
                const monthsLeft = monthlyUsage > 0 ? quantity / monthlyUsage : Number.POSITIVE_INFINITY;
                const threshold = Number(item.lowAlertQuantity || 0);
                const isCritical = monthsLeft < 6 || (threshold > 0 && quantity <= threshold);

                return {
                    id: item.id,
                    description: item.description || item.name || item.id,
                    category: item.category || 'Uncategorized',
                    quantity,
                    threshold,
                    monthsLeft,
                    locations: Array.from(
                        new Set(
                            stock
                                .filter(entry => entry.itemId === item.id)
                                .map(entry => locations.find(location => location.id === entry.locationId)?.name || entry.locationId),
                        ),
                    ),
                    isCritical,
                };
            })
            .filter(item => item.isCritical)
            .sort((left, right) => {
                const leftValue = Number.isFinite(left.monthsLeft) ? left.monthsLeft : Number.MAX_SAFE_INTEGER;
                const rightValue = Number.isFinite(right.monthsLeft) ? right.monthsLeft : Number.MAX_SAFE_INTEGER;
                return leftValue - rightValue;
            });
    }, [items, locations, stock, totalQuantityByItem]);

    const skuSummaryCards = [
        { label: 'Total SKU Count', value: items.length.toLocaleString() },
        { label: 'Categorized Items', value: (items.length - uncategorizedItems.length).toLocaleString() },
        { label: 'Unassigned Categories', value: uncategorizedItems.length.toLocaleString() },
    ];

    const warehouseSummaryCards = [
        { label: 'Warehouse Units', value: totalUnits.toLocaleString() },
        { label: 'Stocked Locations', value: warehouseBreakdown.filter(location => location.unitCount > 0).length.toLocaleString() },
        { label: 'Avg Units / SKU', value: items.length > 0 ? Math.round(totalUnits / items.length).toLocaleString() : '0' },
    ];

    const immediateReorderCount = criticalAlerts.filter(item => item.quantity === 0 || item.monthsLeft < 1).length;
    const criticalSummaryCards = [
        { label: 'Critical Alerts', value: criticalAlerts.length.toLocaleString() },
        { label: 'Immediate Reorders', value: immediateReorderCount.toLocaleString() },
        { label: 'Tracked Thresholds', value: items.filter(item => Number(item.lowAlertQuantity || 0) > 0).length.toLocaleString() },
    ];

    const detailConfig = {
        'dashboard-sku': {
            title: 'Total SKU Count',
            subtitle: 'A breakdown of product records, category coverage, and where cleanup is still needed.',
            icon: <DocumentChartBarIcon className="h-8 w-8" />,
            accentClassName: 'bg-em-red text-white border-red-900',
        },
        'dashboard-warehouse-load': {
            title: 'Warehouse Load',
            subtitle: 'Current on-hand units across all warehouses, with a direct view into the heaviest storage locations.',
            icon: <ArrowRightLeftIcon className="h-8 w-8" />,
            accentClassName: 'bg-white text-gray-900 border-gray-200',
        },
        'dashboard-critical-alerts': {
            title: 'Critical Alerts',
            subtitle: 'Products that are already below threshold or trending below six months of coverage.',
            icon: <ExclamationTriangleIcon className="h-8 w-8" />,
            accentClassName: 'bg-white text-gray-900 border-gray-200',
        },
    }[view];

    return (
        <div className="mx-auto max-w-6xl space-y-6 animate-fade-in-down pb-12">
            <div className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-gradient-to-br from-white via-white to-gray-50 p-6 shadow-sm md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-gray-600 transition-colors hover:border-em-red hover:text-em-red"
                    >
                        <ListBulletIcon className="h-4 w-4" />
                        Back To Dashboard
                    </button>
                    <div>
                        <div className="text-xs font-black uppercase tracking-[0.22em] text-gray-500">Dashboard Detail</div>
                        <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-gray-900 md:text-4xl">{detailConfig.title}</h1>
                        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-600">{detailConfig.subtitle}</p>
                    </div>
                </div>
                <div className={`flex h-20 w-20 items-center justify-center rounded-3xl border ${detailConfig.accentClassName}`}>
                    {detailConfig.icon}
                </div>
            </div>

            {view === 'dashboard-sku' && (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {skuSummaryCards.map(card => (
                            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{card.label}</div>
                                <div className="mt-3 text-4xl font-black text-gray-900">{card.value}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-gray-900">Category Coverage</h2>
                                <DocumentChartBarIcon className="h-5 w-5 text-em-red" />
                            </div>
                            <div className="mt-5 space-y-4">
                                {categoryBreakdown.slice(0, 8).map(entry => (
                                    <div key={entry.name}>
                                        <div className="mb-2 flex items-center justify-between gap-4 text-sm font-black uppercase text-gray-700">
                                            <span className="truncate">{entry.name}</span>
                                            <span>{entry.count}</span>
                                        </div>
                                        <div className="h-2.5 overflow-hidden rounded-full border border-gray-100 bg-gray-50">
                                            <div className="h-full rounded-full bg-em-red" style={{ width: `${Math.max(entry.share, 4)}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-[0.22em] text-gray-900">Needs Category Assignment</h2>
                                <ListBulletIcon className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="mt-5 space-y-3">
                                {uncategorizedItems.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                                        Every product has a category assigned.
                                    </div>
                                ) : (
                                    uncategorizedItems.map(item => (
                                        <div key={item.id} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                            <div className="text-sm font-black uppercase text-gray-900">{item.description || item.id}</div>
                                            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">{item.id}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </section>
                    </div>
                </>
            )}

            {view === 'dashboard-warehouse-load' && (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {warehouseSummaryCards.map(card => (
                            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{card.label}</div>
                                <div className="mt-3 text-4xl font-black text-gray-900">{card.value}</div>
                            </div>
                        ))}
                    </div>
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-gray-900">Location Breakdown</h2>
                            <MapPinIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <div className="mt-5 space-y-3">
                            {warehouseBreakdown.map(location => (
                                <button
                                    key={location.id}
                                    type="button"
                                    onClick={() => onOpenLocationInventory(location.id)}
                                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-left transition-colors hover:border-em-red hover:bg-red-50"
                                >
                                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="text-lg font-black uppercase text-gray-900">{location.name}</div>
                                            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">{location.skuCount} active sku records</div>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div>
                                                <div className="text-2xl font-black text-em-red">{location.unitCount.toLocaleString()}</div>
                                                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">units</div>
                                            </div>
                                            <div className="min-w-[88px] text-right">
                                                <div className="text-lg font-black text-gray-900">{location.share.toFixed(1)}%</div>
                                                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">of load</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 h-2.5 overflow-hidden rounded-full border border-gray-100 bg-white">
                                        <div className="h-full rounded-full bg-em-red" style={{ width: `${Math.max(location.share, 2)}%` }} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </>
            )}

            {view === 'dashboard-critical-alerts' && (
                <>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {criticalSummaryCards.map(card => (
                            <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">{card.label}</div>
                                <div className="mt-3 text-4xl font-black text-gray-900">{card.value}</div>
                            </div>
                        ))}
                    </div>
                    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-gray-900">Alert Queue</h2>
                            <ExclamationTriangleIcon className="h-5 w-5 text-em-red" />
                        </div>
                        <div className="mt-5 space-y-3">
                            {criticalAlerts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                                    No critical inventory alerts are active.
                                </div>
                            ) : (
                                criticalAlerts.slice(0, 12).map(item => (
                                    <div key={item.id} className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0">
                                                <div className="text-lg font-black uppercase text-gray-900">{item.description}</div>
                                                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">{item.id} · {item.category}</div>
                                                <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-600">
                                                    {item.locations.length > 0 ? item.locations.join(' / ') : 'No warehouse assigned'}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-right sm:min-w-[250px]">
                                                <div>
                                                    <div className="text-2xl font-black text-em-red">{item.quantity}</div>
                                                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">on hand</div>
                                                </div>
                                                <div>
                                                    <div className="text-2xl font-black text-gray-900">{item.threshold}</div>
                                                    <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">threshold</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 rounded-xl border border-red-100 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-gray-700">
                                            {Number.isFinite(item.monthsLeft)
                                                ? item.monthsLeft < 1
                                                    ? 'Reorder now'
                                                    : `Projected coverage: ${item.monthsLeft.toFixed(1)} months`
                                                : 'No usage history available'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </>
            )}
        </div>
    );
};

export default DashboardMetricDetail;