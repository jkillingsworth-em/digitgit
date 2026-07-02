import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, Location, Stock, PrintableLabel, InventoryItemUI } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { SortIcon } from './icons/SortIcon';
import { FilterIcon } from './icons/FilterIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { TagIcon } from './icons/TagIcon';
import { ClockIcon } from './icons/ClockIcon';
import FilterModal from './FilterModal';
import ProductDetailsModal from './ProductDetailsModal';
import { InventoryCard } from './InventoryCard';

interface InventoryTableProps {
    items: InventoryItem[];
    locations: Location[];
    stock: Stock[];
    onMoveClick: (item: InventoryItem) => void;
    onDeleteClick: (itemId: string) => void;
    onDuplicateClick: (item: InventoryItem) => void;
    onEditClick: (item: InventoryItem, field?: string) => void;
    onPrintBarcode: (item: InventoryItem) => void;
    onPrintSpecificLabel: (label: PrintableLabel) => void;
    selectedItemIds: Set<string>;
    onSelectionChange: (itemId: string) => void;
    onSelectAll: (itemIds: string[], select: boolean) => void;
    onGenerateReportForItem: (itemId: string) => void;
    categoryColors: Record<string, string>;
    onBulkEditClick: () => void;
    view: 'all' | 'categories' | 'locations' | 'dashboard';
    searchQuery: string;
    filterCategory: string;
    filterLocation: string;
    filterLowStock: boolean;
    onSetFilterCategory: (cat: string) => void;
    onSetFilterLocation: (loc: string) => void;
    onSetFilterLowStock: (isLow: boolean) => void;
    onViewChange?: (view: 'all' | 'categories' | 'locations' | 'dashboard') => void;
}

type SortKey = 'id' | 'description' | 'category' | 'quantityInView' | 'location';
type SortDirection = 'asc' | 'desc';

const calculateAverageUsage = (priorUsage?: { year: number; usage: number }[]): number => {
    if (!priorUsage || priorUsage.length === 0) {
        return 0;
    }
    const totalUsage = priorUsage.reduce((sum, entry) => sum + entry.usage, 0);
    return totalUsage / priorUsage.length;
};

const InventoryTable: React.FC<InventoryTableProps> = ({ 
    items, locations, stock, onMoveClick, onDeleteClick, onDuplicateClick, onEditClick, onPrintBarcode, onPrintSpecificLabel,
    selectedItemIds, onSelectionChange, onSelectAll, onGenerateReportForItem, categoryColors,
    onBulkEditClick, view, searchQuery,
    filterCategory, filterLocation, filterLowStock, onSetFilterCategory, onSetFilterLocation, onSetFilterLowStock, onViewChange
}) => {
    const [itemToView, setItemToView] = useState<InventoryItemUI | null>(null);
    const [activeActionItem, setActiveActionItem] = useState<InventoryItem | null>(null);
    const [groupBy, setGroupBy] = useState<'none' | 'category' | 'location'>('none');
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    useEffect(() => {
        if (view === 'categories') {
            setGroupBy('category');
        } else if (view === 'locations') {
            setGroupBy('location');
        } else {
            setGroupBy('none');
        }
    }, [view]);

    const pageTitle = useMemo(() => {
        if (searchQuery) return `"${searchQuery}"`;
        if (filterLowStock) return 'LOW STOCK ALERTS';
        if (filterCategory) return `${filterCategory.replace('|', ' / ')}`;
        if (filterLocation) {
            const locName = locations.find(l => l.id === filterLocation)?.name || filterLocation;
            return `${locName}`;
        }
        if (view === 'categories') return 'BY CATEGORY';
        if (view === 'locations') return 'BY LOCATION';
        return 'ALL INVENTORY';
    }, [view, searchQuery, filterCategory, filterLocation, filterLowStock, locations]);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const getItemColor = (item: InventoryItem) => {
        // Fallback to legacy subCategory if color exists, otherwise category
        if (item.subCategory && categoryColors[item.subCategory]) return categoryColors[item.subCategory];
        if (item.category && categoryColors[item.category]) return categoryColors[item.category];
        return '#e5e5e5';
    };

    const categoryHierarchy = useMemo(() => {
        const hierarchy: Record<string, Set<string>> = {};
        items.forEach(item => {
            const cat = item.category || 'UNCATEGORIZED';
            if (!hierarchy[cat]) hierarchy[cat] = new Set();
            
            // Build hierarchy from Sub3 (Level 3) as the primary sub-node for simple filtering
            if (item.subCategory3) hierarchy[cat].add(item.subCategory3);
            
            // Legacy support
            if (item.subCategory) hierarchy[cat].add(item.subCategory);
        });
        return hierarchy;
    }, [items]);

    const mappedItems: InventoryItemUI[] = useMemo(() => {
        const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));
        const stockByItemId = new Map<string, Stock[]>();
        for (const s of stock) {
            const arr = stockByItemId.get(s.itemId);
            if (arr) arr.push(s);
            else stockByItemId.set(s.itemId, [s]);
        }
        return items.map(item => {
            const allItemStock = stockByItemId.get(item.id) ?? [];
            const totalQuantity = allItemStock.reduce((sum, s) => sum + s.quantity, 0);
            const quantityInView = totalQuantity;
            const locationsWithStock = allItemStock
                .map(s => ({...s, locationName: locationMap.get(s.locationId) || 'UNKNOWN LOCATION'}))
                .sort((a,b) => a.locationName.localeCompare(b.locationName));
            const averageUsage = calculateAverageUsage(item.priorUsage);
            const etr = averageUsage > 0 && totalQuantity > 0
                ? `${((totalQuantity / (averageUsage / 12))).toFixed(1)} MONTHS`
                : 'N/A';
            const stockTooltip = locationsWithStock.length > 0 
                ? `TOTAL: ${totalQuantity} | ETR: ${etr} | LOCATIONS: ${locationsWithStock.map(ls => `${ls.locationName}: ${ls.quantity}`).join(', ')}` 
                : `TOTAL: 0 | ETR: ${etr} | NO STOCK`;
            const isLowStock = item.lowAlertQuantity !== undefined && totalQuantity <= item.lowAlertQuantity;

            return { 
                ...item, 
                quantityInView,
                totalQuantity,
                etr,
                locationsWithStock, 
                category: item.category || 'UNCATEGORIZED', 
                stockTooltip, 
                accentColor: getItemColor(item),
                isLowStock
            };
        });
    }, [items, locations, stock, categoryColors]);

    const filteredItems = useMemo(() => {
        let result = mappedItems;
        if (searchQuery) {
            const lower = searchQuery.toUpperCase();
            result = result.filter(item => 
                item.id.toUpperCase().includes(lower) || 
                item.description.toUpperCase().includes(lower) || 
                item.category.toUpperCase().includes(lower) || 
                // Legacy
                (item.subCategory && item.subCategory.toUpperCase().includes(lower)) ||
                // New Hierarchy
                (item.subCategory3 && item.subCategory3.toUpperCase().includes(lower)) ||
                (item.subCategory1 && item.subCategory1.some(s => s.toUpperCase().includes(lower))) ||
                (item.subCategory2 && item.subCategory2.some(s => s.toUpperCase().includes(lower)))
            );
        }
        if (filterCategory) {
            if (filterCategory.includes('|')) {
                const [cat, sub] = filterCategory.split('|');
                result = result.filter(item => 
                    (item.category || 'UNCATEGORIZED') === cat && 
                    (item.subCategory === sub || item.subCategory3 === sub)
                );
            } else {
                result = result.filter(item => (item.category || 'UNCATEGORIZED') === filterCategory);
            }
        }
        if (filterLocation) result = result.filter(item => item.locationsWithStock.some(l => l.locationId === filterLocation));
        if (filterLowStock) result = result.filter(item => item.isLowStock);
        return result;
    }, [mappedItems, searchQuery, filterCategory, filterLocation, filterLowStock]);

    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            if (sortKey === 'id' || sortKey === 'location') {
                if (a.isLowStock !== b.isLowStock) {
                    return a.isLowStock ? -1 : 1;
                }
            }
            if (sortKey === 'category') {
                const catA = a.category || '';
                const catB = b.category || '';
                const categoryCompare = catA.localeCompare(catB);
                if (categoryCompare !== 0) return sortDirection === 'asc' ? categoryCompare : -categoryCompare;
                
                // Secondary sort by Sub3
                const subA = a.subCategory3 || a.subCategory || '';
                const subB = b.subCategory3 || b.subCategory || '';
                return sortDirection === 'asc' ? subA.localeCompare(subB) : -subA.localeCompare(subB);
            }
            if (sortKey === 'location') {
                const locA = a.locationsWithStock[0]?.locationName || '';
                const locB = b.locationsWithStock[0]?.locationName || '';
                return sortDirection === 'asc' ? locA.localeCompare(locB) : -locA.localeCompare(locB);
            }
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (typeof aValue === 'number' && typeof bValue === 'number') return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            return sortDirection === 'asc' ? String(aValue ?? '').localeCompare(String(bValue ?? '')) : String(bValue ?? '').localeCompare(String(aValue ?? ''));
        });
    }, [filteredItems, sortKey, sortDirection]);

    const displayData = useMemo(() => {
        if (groupBy === 'category') {
            return sortedItems.reduce((acc, item) => {
                const key = item.category;
                if (!acc[key]) acc[key] = [];
                acc[key].push(item);
                return acc;
            }, {} as Record<string, InventoryItemUI[]>);
        }
        if (groupBy === 'location') {
            const locGroups: Record<string, { name: string; items: { item: InventoryItemUI; stock: Stock }[] }> = {};
            sortedItems.forEach(item => {
                item.locationsWithStock.forEach(s => {
                    const key = `${s.locationName} ${s.subLocationDetail ? ` - ${s.subLocationDetail}` : ''}`;
                    if (!locGroups[key]) locGroups[key] = { name: key, items: [] };
                    locGroups[key].items.push({ item, stock: s });
                });
            });
            return Object.values(locGroups).sort((a, b) => a.name.localeCompare(b.name));
        }
        return sortedItems;
    }, [sortedItems, groupBy]);

    const categoriesCount = useMemo(() => new Set(filteredItems.map(i => i.category || 'Uncategorized')).size, [filteredItems]);
    const allVisibleSelected = sortedItems.length > 0 && sortedItems.every(i => selectedItemIds.has(i.id));
    const isFilterActive = filterCategory !== '' || filterLocation !== '' || filterLowStock;
    const activeFiltersCount = (filterCategory ? 1 : 0) + (filterLocation ? 1 : 0) + (filterLowStock ? 1 : 0);
    const showDesktopTitle = filterCategory !== '' || filterLocation !== '';

    // --- RENDER COMPACT STACK CELL ---
    const CategoryCellContent = ({ item }: { item: InventoryItemUI }) => (
        <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-gray-900 text-sm uppercase tracking-tight">{item.category}</span>
                {item.subCategory3 && (
                    <>
                        <span className="text-gray-300 text-xs">/</span>
                        <span className="font-bold text-gray-700 text-sm uppercase tracking-tight">{item.subCategory3}</span>
                    </>
                )}
            </div>
            
            {/* Tags Row */}
            {(item.subCategory1?.length > 0 || item.subCategory2?.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-1">
                    {item.subCategory1?.map(t => (
                        <span key={t} className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-bold rounded border border-gray-200 uppercase tracking-tight leading-none">
                            {t}
                        </span>
                    ))}
                    {item.subCategory2?.map(t => (
                        <span key={t} className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded border border-slate-200 uppercase tracking-tight leading-none">
                            {t}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );

    const renderTableRow = (item: InventoryItemUI, quantity?: number) => (
        <React.Fragment key={`${item.id}-${quantity || 'total'}`}>
            <tr className="hidden md:table-row xl:hidden border-b border-gray-200 even:bg-gray-50 hover:bg-red-50 transition-colors group">
                <td className="pl-2 md:pl-3 xl:pl-6 py-4 w-12 whitespace-nowrap align-middle">
                     <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-800 focus:ring-red-800 cursor-pointer" checked={selectedItemIds.has(item.id)} onChange={() => onSelectionChange(item.id)} />
                </td>
                <td className="px-2 md:px-3 xl:px-6 py-4 align-middle" onClick={() => setItemToView(item)}>
                    <div className="font-bold text-stone-900 text-base cursor-pointer hover:text-red-700 leading-tight max-w-[140px] lg:max-w-[200px] truncate" title={item.description}>{item.description}</div>
                    <div className="text-sm font-semibold text-black mt-1">{item.id}</div>
                </td>
                
                {/* COMPACT STACK CATEGORY CELL */}
                <td className="px-2 md:px-3 xl:px-6 py-4 text-left align-middle" onClick={() => setItemToView(item)}>
                    <CategoryCellContent item={item} />
                </td>

                <td className="px-2 md:px-3 xl:px-6 py-4 text-center whitespace-nowrap align-middle" onClick={() => setItemToView(item)}>
                    {item.isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">LOW</span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">OK</span>
                    )}
                </td>
                <td className="px-2 md:px-3 xl:px-6 py-4 text-center align-middle" onClick={() => setItemToView(item)}>
                    <span className={`text-xl font-black ${item.isLowStock ? 'text-red-700' : 'text-gray-900'}`}>{quantity ?? item.totalQuantity}</span>
                </td>
                <td className="px-2 md:px-3 xl:px-6 py-4 text-right align-middle whitespace-nowrap">
                     <div className="flex justify-end gap-1 flex-nowrap">
                         <button onClick={(e) => { e.stopPropagation(); onEditClick(item); }} className="text-gray-700 hover:text-blue-600 p-1.5" title="Edit"><PencilSquareIcon className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onMoveClick(item); }} className="text-blue-600 hover:text-blue-800 p-1.5" title="Move"><ArrowRightLeftIcon className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onGenerateReportForItem(item.id); }} className="text-gray-700 hover:text-gray-900 p-1.5" title="History"><ClockIcon className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateClick(item); }} className="text-gray-700 hover:text-purple-600 p-1.5" title="Duplicate"><DocumentDuplicateIcon className="w-5 h-5" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onPrintBarcode(item); }} className="text-gray-700 hover:text-gray-900 p-1.5" title="Print Barcode"><BarcodeIcon className="w-5 h-5" /></button>
                         <button onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }} className="text-red-400 hover:text-red-700 p-1.5" title="Delete"><TrashIcon className="w-5 h-5" /></button>
                     </div>
                </td>
            </tr>

            <tr className="hidden xl:table-row border-b border-gray-200 even:bg-gray-50 hover:bg-red-50 transition-colors group">
                <td className="pl-6 py-5 w-12 whitespace-nowrap align-middle">
                     <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-800 focus:ring-red-800 cursor-pointer" checked={selectedItemIds.has(item.id)} onChange={() => onSelectionChange(item.id)} />
                </td>
                <td className="px-6 py-5 w-36 align-middle text-lg font-bold text-gray-900 tracking-tight truncate" onClick={() => setItemToView(item)} title={item.id}>{item.id}</td>
                <td className="px-6 py-5 align-middle w-[25%] text-left" onClick={() => setItemToView(item)}>
                    <div className="text-lg font-bold text-gray-900 cursor-pointer hover:text-red-700 leading-tight truncate" title={item.description}>{item.description}</div>
                </td>
                
                {/* LARGE DESKTOP COMPACT STACK CELL */}
                <td className="px-6 py-5 whitespace-nowrap text-left align-middle w-[15%]" onClick={() => setItemToView(item)}>
                    <CategoryCellContent item={item} />
                </td>

                <td className="px-6 py-5 text-left whitespace-nowrap align-middle w-[10%]" onClick={() => setItemToView(item)}>
                    {item.isLowStock ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">LOW STOCK</span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">IN STOCK</span>
                    )}
                </td>
                 <td className="px-6 py-5 text-center align-middle w-24" onClick={() => setItemToView(item)}>
                    <span className={`text-xl font-black ${item.isLowStock ? 'text-red-700' : 'text-gray-900'}`}>{quantity ?? item.totalQuantity}</span>
                </td>
                <td className="px-6 py-5 text-right align-middle w-auto whitespace-nowrap">
                    <div className="flex w-full justify-between items-center px-4">
                         <button onClick={(e) => { e.stopPropagation(); onEditClick(item); }} className="text-gray-700 hover:text-blue-600 transition-colors hover:scale-110" title="Edit"><PencilSquareIcon className="w-6 h-6" /></button>
                         <button onClick={(e) => { e.stopPropagation(); onMoveClick(item); }} className="text-blue-600 hover:text-blue-800 transition-colors hover:scale-110" title="Move Stock"><ArrowRightLeftIcon className="w-6 h-6" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onGenerateReportForItem(item.id); }} className="text-gray-700 hover:text-gray-900 transition-colors hover:scale-110" title="History"><ClockIcon className="w-6 h-6" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDuplicateClick(item); }} className="text-gray-700 hover:text-purple-600 transition-colors hover:scale-110" title="Duplicate"><DocumentDuplicateIcon className="w-6 h-6" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onPrintBarcode(item); }} className="text-gray-700 hover:text-gray-900 transition-colors hover:scale-110" title="Print Barcode"><BarcodeIcon className="w-6 h-6" /></button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); }} className="text-red-400 hover:text-red-700 transition-colors hover:scale-110" title="Delete"><TrashIcon className="w-6 h-6" /></button>
                    </div>
                </td>
            </tr>
        </React.Fragment>
    );

    const renderMobileRow = (item: InventoryItemUI, quantityOverride?: number) => (
        <InventoryCard
            key={item.id}
            item={quantityOverride !== undefined ? { ...item, totalQuantity: quantityOverride } : item}
            onClick={() => setItemToView(item)}
            onAction={(i) => setActiveActionItem(i)}
        />
    );
    
    const renderMobileGroupHeader = (title: string, icon?: React.ReactNode) => (
        <div className="sticky top-[6.5rem] md:top-[7.5rem] z-10 bg-white/95 backdrop-blur-md border-y-2 border-red-100 py-3 px-4 mb-4 -mx-4 md:mx-0 shadow-sm flex items-center gap-2">
            {icon}
            <span className="text-sm font-black text-em-red uppercase tracking-widest">{title}</span>
        </div>
    );

    const SortableHeader = ({ sortValue, title, className, children }: { sortValue: SortKey, title: string, className?: string, children?: React.ReactNode }) => (
        <th scope="col" title={title} className={`px-2 md:px-3 xl:px-6 py-3 font-bold text-black uppercase tracking-wider text-[15px] ${className}`}>
            <button onClick={() => handleSort(sortValue)} className={`flex items-center gap-1 hover:text-red-700 transition-colors whitespace-nowrap group ${className?.includes('text-center') ? 'justify-center w-full' : ''}`}>
                {children}
                <SortIcon direction={sortKey === sortValue ? sortDirection : undefined} className="w-4 h-4 text-gray-700 group-hover:text-red-700" />
            </button>
        </th>
    );

    const handleApplyFilters = (filters: { category: string; location: string }) => {
        onSetFilterCategory(filters.category);
        onSetFilterLocation(filters.location);
    };

    const handleClearFilters = () => {
        onSetFilterCategory('');
        onSetFilterLocation('');
        onSetFilterLowStock(false);
    };

    return (
        <div className="relative">
            <div className="md:hidden pt-4 pb-2 px-4 bg-gray-50">
                 <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-none">{pageTitle}</h2>
                 <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-black uppercase tracking-widest">{view === 'all' ? 'List View' : view === 'categories' ? 'Grouped by Category' : 'Grouped by Location'}</span>
                    {items.length > 0 && <span className="text-[10px] font-bold text-gray-700">|</span>}
                    <span className="text-[10px] font-bold text-black uppercase tracking-widest">{filteredItems.length} Items</span>
                 </div>
            </div>

            <div className="md:hidden sticky top-14 z-20 bg-gray-50 border-b border-gray-300 flex items-center h-12 shadow-sm mb-4">
                 <button onClick={() => setIsFilterModalOpen(true)} className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold h-full border-r border-gray-300 active:bg-gray-100 ${isFilterActive ? 'text-red-700' : 'text-gray-700'}`}>
                    <FilterIcon className="w-4 h-4" />
                    <span>FILTER {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
                </button>
                <div className="flex-1 relative h-full">
                     <select className="w-full h-full appearance-none bg-transparent text-center font-bold text-xs text-gray-700 focus:outline-none uppercase" onChange={(e) => handleSort(e.target.value as SortKey)} value={sortKey}>
                        <option value="id">SORT: ID</option>
                        <option value="description">SORT: NAME</option>
                        <option value="quantityInView">SORT: QTY</option>
                        <option value="category">SORT: CATEGORY</option>
                        <option value="location">SORT: LOCATION</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none"><SortIcon className="w-3.5 h-3.5 text-gray-700" /></div>
                </div>
            </div>

            <div className="hidden md:flex bg-white p-4 mb-6 rounded-lg shadow-sm border border-gray-300 items-center justify-between gap-4">
                 <div className="flex-1 min-w-0">
                     {showDesktopTitle ? (
                         <div>
                            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none flex items-center gap-3">
                                {pageTitle}
                                {isFilterActive && <button onClick={handleClearFilters} className="text-xs font-bold text-black hover:text-red-600 border border-gray-200 bg-gray-50 hover:bg-red-50 px-2 py-1 rounded transition-colors">CLEAR</button>}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 text-xs font-bold text-black uppercase tracking-widest">
                                {filterLocation && <MapPinIcon className="w-3 h-3" />}
                                {filterCategory && <TagIcon className="w-3 h-3" />}
                                <span>{categoriesCount} Categories</span>
                                <span className="text-gray-700">|</span>
                                <span>{filteredItems.length} Items</span>
                            </div>
                         </div>
                     ) : (
                        <div className="flex items-center gap-4"><span className="text-sm font-bold text-black uppercase tracking-widest">{filteredItems.length} Items Found</span></div>
                     )}
                 </div>
                 <div className="flex items-center gap-3 shrink-0">
                    {selectedItemIds.size > 0 && (
                         <button onClick={onBulkEditClick} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 uppercase tracking-wide transition-colors animate-fade-in-down">EDIT SELECTED ({selectedItemIds.size})</button>
                    )}
                    <div className="relative group">
                        <select className="appearance-none bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-lg focus:ring-em-red focus:border-em-red block w-40 pl-3 pr-8 py-2.5 uppercase cursor-pointer hover:border-gray-400 transition-colors" onChange={(e) => handleSort(e.target.value as SortKey)} value={sortKey}>
                            <option value="id">Sort: ID</option>
                            <option value="description">Sort: Name</option>
                            <option value="quantityInView">Sort: Qty</option>
                            <option value="category">Sort: Category</option>
                            <option value="location">Sort: Location</option>
                        </select>
                        <div className="absolute inset-y-0 right-2 flex items-center pointer-events-none"><SortIcon className="w-4 h-4 text-gray-700 group-hover:text-black" /></div>
                    </div>
                    <button onClick={() => setIsFilterModalOpen(true)} className={`flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-bold border rounded-lg shadow-sm transition-colors uppercase ${isFilterActive ? 'bg-red-50 text-red-800 border-red-200' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 hover:border-gray-400'}`}>
                        <FilterIcon className="w-5 h-5" /> Filters
                        {activeFiltersCount > 0 && <span className="flex items-center justify-center bg-red-600 text-white text-[10px] h-5 w-5 rounded-full ml-1">{activeFiltersCount}</span>}
                    </button>
                </div>
            </div>

            {filteredItems.length === 0 && <div className="text-center py-12 px-4 bg-white rounded-lg shadow-sm border border-gray-300 no-items-message"><MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-700" /><h3>NO ITEMS FOUND</h3><p className="mt-1 text-black">TRY ADJUSTING YOUR SEARCH OR FILTERS.</p></div>}
            
            <div className="block md:hidden pb-24 px-4 sm:px-0">
                {groupBy === 'category' ? (
                    Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, itemsInCategory]) => (
                        <div key={category} className="mb-8">
                            {renderMobileGroupHeader(category, <TagIcon className="w-4 h-4 text-em-red"/>)}
                            {itemsInCategory.map(item => renderMobileRow(item))}
                        </div>
                    ))
                ) : groupBy === 'location' ? (
                    (displayData as { name: string; items: { item: InventoryItemUI; stock: Stock }[] }[]).map(group => (
                         <div key={group.name} className="mb-8">
                            {renderMobileGroupHeader(group.name, <MapPinIcon className="w-4 h-4 text-em-red"/>)}
                            {group.items.map(({ item, stock: stockEntry }) => renderMobileRow(item, stockEntry.quantity))}
                        </div>
                    ))
                ) : (
                    (displayData as InventoryItemUI[]).map(item => renderMobileRow(item))
                )}
            </div>

            <div className="hidden md:block inventory-table-container overflow-x-auto rounded-lg shadow-sm border border-gray-300">
                <table className="min-w-full divide-y divide-gray-200 xl:table-fixed">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                            <th scope="col" className="pl-2 md:pl-3 xl:pl-6 py-3 text-left w-12"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 cursor-pointer text-red-700 focus:ring-red-700" checked={allVisibleSelected} onChange={() => onSelectAll(sortedItems.map(i => i.id), !allVisibleSelected)} /></th>
                            <SortableHeader sortValue="id" title="ITEM CODE" className="hidden xl:table-cell text-left w-36">ITEM CODE</SortableHeader>
                            <SortableHeader sortValue="description" title="ITEM DESCRIPTION" className="hidden xl:table-cell text-left w-[25%]">DESCRIPTION</SortableHeader>
                            <SortableHeader sortValue="description" title="ITEM DESCRIPTION" className="hidden md:table-cell xl:hidden text-left w-auto">DESCRIPTION</SortableHeader>
                            <SortableHeader sortValue="category" title="CATEGORY" className="hidden md:table-cell text-left xl:w-[15%]">CATEGORY</SortableHeader>
                            <th scope="col" className="px-2 md:px-3 xl:px-6 py-3 text-left text-[15px] font-bold text-black uppercase tracking-wider md:w-auto xl:w-[10%]">STATUS</th>
                            <SortableHeader sortValue="quantityInView" title="TOTAL QUANTITY" className="text-center md:w-auto xl:w-24">QTY</SortableHeader>
                            <th scope="col" className="px-2 md:px-3 xl:px-6 py-3 text-right text-[15px] font-bold text-black uppercase tracking-wider w-auto rounded-tr-lg">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {groupBy === 'category' ? (
                            Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, itemsInCategory]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-white border-y-2 border-red-100">
                                        <td colSpan={7} className="px-2 md:px-3 xl:px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <TagIcon className="w-4 h-4 text-em-red" />
                                                <span className="text-sm font-black text-em-red uppercase tracking-widest">{category}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {itemsInCategory.map(item => renderTableRow(item))}
                                </React.Fragment>
                            ))
                        ) : groupBy === 'location' ? (
                             (displayData as { name: string; items: { item: InventoryItemUI; stock: Stock }[] }[]).map(group => (
                                <React.Fragment key={group.name}>
                                    <tr className="bg-white border-y-2 border-red-100">
                                        <td colSpan={7} className="px-2 md:px-3 xl:px-6 py-3">
                                            <div className="flex items-center gap-2">
                                                <MapPinIcon className="w-4 h-4 text-em-red" />
                                                <span className="text-sm font-black text-em-red uppercase tracking-widest">{group.name}</span>
                                            </div>
                                        </td>
                                    </tr>
                                    {group.items.map(({ item, stock: stockEntry }) => renderTableRow(item, stockEntry.quantity))}
                                </React.Fragment>
                            ))
                        ) : (
                            (displayData as InventoryItemUI[]).map(item => renderTableRow(item))
                        )}
                    </tbody>
                </table>
            </div>
            <FilterModal isOpen={isFilterModalOpen} onClose={() => setIsFilterModalOpen(false)} onApply={handleApplyFilters} onClear={handleClearFilters} locations={locations} categoryHierarchy={categoryHierarchy} currentCategory={filterCategory} currentLocation={filterLocation} view={view} />
            {itemToView && <ProductDetailsModal item={itemToView} onClose={() => setItemToView(null)} onPrintSpecificLabel={onPrintSpecificLabel} onSetFilterCategory={onSetFilterCategory} onEdit={() => onEditClick(itemToView)} onMove={() => onMoveClick(itemToView)} />}
            
            {activeActionItem && (
                <div className="fixed inset-0 z-[60] flex items-end justify-center md:hidden">
                    <div 
                        className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => setActiveActionItem(null)}
                    />
                    
                    <div className="relative w-full bg-white rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up">
                        <div className="flex justify-center pt-3 pb-1" onClick={() => setActiveActionItem(null)}>
                            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                        </div>

                        <div className="px-6 pb-4 border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 uppercase truncate pr-8">
                                {activeActionItem.description}
                            </h3>
                            <p className="text-xs font-bold text-gray-500">{activeActionItem.id}</p>
                            
                            <button 
                                onClick={() => setActiveActionItem(null)} 
                                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                            >
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 grid grid-cols-4 gap-4">
                            <button onClick={() => { onEditClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl group-active:scale-95 transition-transform">
                                    <PencilSquareIcon className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-gray-600">Edit</span>
                            </button>

                            <button onClick={() => { onMoveClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl group-active:scale-95 transition-transform">
                                    <ArrowRightLeftIcon className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-gray-600">Move</span>
                            </button>

                            <button onClick={() => { onDuplicateClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl group-active:scale-95 transition-transform">
                                    <DocumentDuplicateIcon className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-gray-600">Clone</span>
                            </button>

                            <button onClick={() => { onGenerateReportForItem(activeActionItem.id); setActiveActionItem(null); }} className="flex flex-col items-center gap-2 group">
                                <div className="p-4 bg-gray-100 text-gray-600 rounded-2xl group-active:scale-95 transition-transform">
                                    <ClockIcon className="w-6 h-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase text-gray-600">Log</span>
                            </button>
                        </div>

                        <div className="px-6 pb-8 grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => { onPrintBarcode(activeActionItem); setActiveActionItem(null); }} 
                                className="flex items-center justify-center gap-2 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-xs uppercase text-gray-800 hover:bg-gray-100"
                            >
                                <BarcodeIcon className="w-5 h-5" /> Print Label
                            </button>
                            <button 
                                onClick={() => { onDeleteClick(activeActionItem.id); setActiveActionItem(null); }} 
                                className="flex items-center justify-center gap-2 py-3 bg-red-50 border border-red-100 rounded-xl font-bold text-xs uppercase text-red-600 hover:bg-red-100"
                            >
                                <TrashIcon className="w-5 h-5" /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryTable;
