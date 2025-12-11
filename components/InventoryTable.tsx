import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, Location, Stock, PrintableLabel, InventoryItemUI } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { DocumentDuplicateIcon } from './icons/DocumentDuplicateIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { SortIcon } from './icons/SortIcon';
import { EllipsisVerticalIcon } from './icons/EllipsisVerticalIcon';
import { FilterIcon } from './icons/FilterIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import FilterModal from './FilterModal';
import ProductDetailsModal from './ProductDetailsModal';

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
    view: 'all' | 'categories' | 'locations';
    searchQuery: string;
    filterCategory: string;
    filterLocation: string;
    onSetFilterCategory: (cat: string) => void;
    onSetFilterLocation: (loc: string) => void;
    onViewChange?: (view: 'all' | 'categories' | 'locations') => void;
}

type SortKey = 'id' | 'description' | 'category' | 'quantityInView';
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
    filterCategory, filterLocation, onSetFilterCategory, onSetFilterLocation, onViewChange
}) => {
    // State to track which item is currently being viewed in the modal
    const [itemToView, setItemToView] = useState<InventoryItemUI | null>(null);
    
    // State for Mobile Action Sheet (Bottom Sheet)
    const [activeActionItem, setActiveActionItem] = useState<InventoryItem | null>(null);

    // Desktop Menu State
    const [desktopMenuOpenId, setDesktopMenuOpenId] = useState<string | null>(null);

    // Unified grouping state
    const [groupBy, setGroupBy] = useState<'none' | 'category' | 'location'>('none');
    
    // Sort State
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    
    // Filter Modal State
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setDesktopMenuOpenId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Set default grouping based on the view
    useEffect(() => {
        if (view === 'categories') {
            setGroupBy('category');
        } else if (view === 'locations') {
            setGroupBy('location');
        } else {
            setGroupBy('none');
        }
    }, [view]);

    // Derived Page Title
    const pageTitle = useMemo(() => {
        if (searchQuery) return `"${searchQuery}"`;
        if (filterCategory) return `${filterCategory.replace('|', ' / ')}`;
        if (filterLocation) {
            const locName = locations.find(l => l.id === filterLocation)?.name || filterLocation;
            return `${locName}`;
        }
        if (view === 'categories') return 'BY CATEGORY';
        if (view === 'locations') return 'BY LOCATION';
        return 'ALL INVENTORY';
    }, [view, searchQuery, filterCategory, filterLocation, locations]);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const getItemColor = (item: InventoryItem) => {
        if (item.subCategory && categoryColors[item.subCategory]) return categoryColors[item.subCategory];
        if (item.category && categoryColors[item.category]) return categoryColors[item.category];
        return '#e5e7eb'; // default grey
    };

    // Calculate Hierarchy for Filter Dropdown
    const categoryHierarchy = useMemo(() => {
        const hierarchy: Record<string, Set<string>> = {};
        items.forEach(item => {
            const cat = item.category || 'UNCATEGORIZED';
            if (!hierarchy[cat]) hierarchy[cat] = new Set();
            if (item.subCategory) hierarchy[cat].add(item.subCategory);
        });
        return hierarchy;
    }, [items]);

    const mappedItems: InventoryItemUI[] = useMemo(() => {
        const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));
        return items.map(item => {
            const allItemStock = stock.filter(s => s.itemId === item.id);
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
            result = result.filter(item => item.id.toUpperCase().includes(lower) || item.description.toUpperCase().includes(lower) || item.category.toUpperCase().includes(lower) || (item.subCategory && item.subCategory.toUpperCase().includes(lower)));
        }

        if (filterCategory) {
            if (filterCategory.includes('|')) {
                const [cat, sub] = filterCategory.split('|');
                result = result.filter(item => (item.category || 'UNCATEGORIZED') === cat && item.subCategory === sub);
            } else {
                result = result.filter(item => (item.category || 'UNCATEGORIZED') === filterCategory);
            }
        }

        if (filterLocation) result = result.filter(item => item.locationsWithStock.some(l => l.locationId === filterLocation));
        return result;
    }, [mappedItems, searchQuery, filterCategory, filterLocation]);

    const sortedItems = useMemo(() => {
        return [...filteredItems].sort((a, b) => {
            if (sortKey === 'category') {
                const catA = a.category || '';
                const catB = b.category || '';
                const subCatA = a.subCategory || '';
                const subCatB = b.subCategory || '';

                const categoryCompare = catA.localeCompare(catB);
                if (categoryCompare !== 0) {
                    return sortDirection === 'asc' ? categoryCompare : -categoryCompare;
                }
                const subCategoryCompare = subCatA.localeCompare(subCatB);
                return sortDirection === 'asc' ? subCategoryCompare : -subCategoryCompare;
            }

            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            }
            
            const stringA = String(aValue ?? '');
            const stringB = String(bValue ?? '');
            return sortDirection === 'asc' ? stringA.localeCompare(stringB) : stringB.localeCompare(stringA);
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

    const allVisibleSelected = sortedItems.length > 0 && sortedItems.every(i => selectedItemIds.has(i.id));

    // -- RENDER HELPERS --

    const renderActionMenu = (item: InventoryItem) => (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 text-left overflow-hidden flex flex-col py-1 animate-fade-in-down">
             <button onClick={(e) => { e.stopPropagation(); onMoveClick(item); setDesktopMenuOpenId(null); }} className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-blue-600 flex items-center gap-2 transition-colors">
                <ArrowRightLeftIcon className="w-4 h-4 text-gray-400" /> MOVE STOCK
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDuplicateClick(item); setDesktopMenuOpenId(null); }} className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-purple-600 flex items-center gap-2 transition-colors">
                <DocumentDuplicateIcon className="w-4 h-4 text-gray-400" /> DUPLICATE
            </button>
            <button onClick={(e) => { e.stopPropagation(); onGenerateReportForItem(item.id); setDesktopMenuOpenId(null); }} className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-green-600 flex items-center gap-2 transition-colors">
                <DocumentChartBarIcon className="w-4 h-4 text-gray-400" /> HISTORY
            </button>
            <button onClick={(e) => { e.stopPropagation(); onPrintBarcode(item); setDesktopMenuOpenId(null); }} className="px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 hover:text-gray-900 flex items-center gap-2 transition-colors">
                <BarcodeIcon className="w-4 h-4 text-gray-400" /> BARCODE
            </button>
            <div className="h-px bg-gray-100 my-1"></div>
            <button onClick={(e) => { e.stopPropagation(); onDeleteClick(item.id); setDesktopMenuOpenId(null); }} className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                <TrashIcon className="w-4 h-4" /> DELETE
            </button>
        </div>
    );

    const renderDesktopRow = (item: InventoryItemUI, quantity?: number) => (
        <tr key={`${item.id}-${quantity || 'total'}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors group">
            <td className="pl-6 py-4 w-[1%] whitespace-nowrap">
                 <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300 text-slate-800 focus:ring-slate-800 cursor-pointer" 
                    checked={selectedItemIds.has(item.id)} 
                    onChange={() => onSelectionChange(item.id)}
                />
            </td>
            <td className="px-6 py-4" onClick={() => setItemToView(item)}>
                <div className="font-bold text-slate-900 text-sm cursor-pointer hover:text-blue-700">{item.description}</div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-gray-500">{item.id}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wider">
                        {item.category}
                    </span>
                </div>
            </td>
            <td className="px-6 py-4 text-center w-[1%]" onClick={() => setItemToView(item)}>
                <div className={`w-2.5 h-2.5 rounded-full mx-auto ${item.isLowStock ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} title={item.isLowStock ? 'Low Stock' : 'In Stock'}></div>
            </td>
             <td className="px-6 py-4 text-center w-[1%]" onClick={() => setItemToView(item)}>
                <span className={`text-base font-black ${item.isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                    {quantity ?? item.totalQuantity}
                </span>
            </td>
            <td className="px-6 py-4 text-right w-[1%] whitespace-nowrap">
                <div className="flex items-center justify-end gap-1 relative">
                     <button 
                        onClick={(e) => { e.stopPropagation(); onEditClick(item); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                    >
                        <PencilSquareIcon className="w-5 h-5" />
                    </button>
                    <div className="relative">
                        <button 
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                setDesktopMenuOpenId(desktopMenuOpenId === item.id ? null : item.id); 
                            }}
                            className={`p-1.5 rounded transition-colors ${desktopMenuOpenId === item.id ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}
                        >
                            <EllipsisVerticalIcon className="w-5 h-5" />
                        </button>
                        {desktopMenuOpenId === item.id && renderActionMenu(item)}
                    </div>
                </div>
            </td>
        </tr>
    );

    const renderMobileRow = (item: InventoryItemUI, quantityOverride?: number) => (
         <div 
             key={`${item.id}-${quantityOverride || 'mob'}`}
             onClick={() => setItemToView(item)}
             className="flex items-center justify-between p-3 border-b border-gray-100 bg-white active:bg-gray-50 transition-colors"
        >
            <div className="flex flex-col min-w-0 pr-4">
                <span className="text-sm font-bold text-slate-900 truncate">{item.description}</span>
                <span className="text-xs text-gray-500 font-medium truncate flex items-center gap-2 mt-0.5">
                    {item.id}
                    <span className="w-px h-3 bg-gray-200"></span>
                    <span className="truncate max-w-[120px] text-[10px] bg-gray-100 px-1 rounded text-gray-600">{item.category}</span>
                </span>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
                 <span className={`text-lg font-black ${item.isLowStock ? 'text-red-600' : 'text-slate-900'}`}>
                    {quantityOverride ?? item.totalQuantity}
                </span>
                <button 
                    onClick={(e) => { e.stopPropagation(); setActiveActionItem(item); }}
                    className="text-gray-400 p-2 -mr-2 active:bg-gray-100 rounded-full"
                >
                    <EllipsisVerticalIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );

    const SortableHeader = ({ sortValue, title, className, children }: { sortValue: SortKey, title: string, className?: string, children?: React.ReactNode }) => (
        <th scope="col" title={title} className={`px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider ${className}`}>
            <button onClick={() => handleSort(sortValue)} className="flex items-center gap-1 hover:text-em-red transition-colors whitespace-nowrap group">
                {children}
                <SortIcon direction={sortKey === sortValue ? sortDirection : undefined} className="w-4 h-4 text-gray-300 group-hover:text-em-red" />
            </button>
        </th>
    );

    const isFilterActive = filterCategory !== '' || filterLocation !== '';
    const activeFiltersCount = (filterCategory ? 1 : 0) + (filterLocation ? 1 : 0);

    const handleApplyFilters = (filters: { category: string; location: string }) => {
        onSetFilterCategory(filters.category);
        onSetFilterLocation(filters.location);
    };

    const handleClearFilters = () => {
        onSetFilterCategory('');
        onSetFilterLocation('');
    };

    return (
        <div className="relative">
            {/* Sticky Mobile Utility Bar (Compact) */}
            <div className="md:hidden sticky top-14 z-20 bg-white border-b border-gray-200 flex items-center h-10 shadow-sm">
                 <button 
                    onClick={() => setIsFilterModalOpen(true)}
                    className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold h-full border-r border-gray-100 active:bg-gray-50 ${isFilterActive ? 'text-em-red' : 'text-gray-700'}`}
                >
                    <FilterIcon className="w-3.5 h-3.5" />
                    <span>FILTER {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
                </button>
                <div className="flex-1 relative h-full">
                     <select 
                        className="w-full h-full appearance-none bg-transparent text-center font-bold text-xs text-gray-700 focus:outline-none"
                        onChange={(e) => handleSort(e.target.value as SortKey)}
                        value={sortKey}
                    >
                        <option value="id">SORT: ID</option>
                        <option value="description">SORT: NAME</option>
                        <option value="quantityInView">SORT: QTY</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                        <SortIcon className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                </div>
            </div>

            {/* Desktop Page Title & Controls */}
            <div className="hidden md:flex bg-white p-6 mb-6 rounded-lg shadow-sm border border-gray-200 flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <div className="flex flex-col gap-2 w-full md:w-auto">
                     <h2 className="text-2xl font-bold text-em-dark-blue uppercase tracking-wide flex flex-wrap items-center gap-2">
                        {pageTitle}
                        {isFilterActive && (
                            <button onClick={handleClearFilters} className="text-sm font-medium text-gray-500 hover:text-red-500 ml-2 border border-gray-300 rounded px-2 py-1 hover:border-red-300 transition-colors">
                                CLEAR
                            </button>
                        )}
                     </h2>
                     {view === 'all' && onViewChange && (
                        <div className="flex items-center gap-1 text-sm font-bold text-gray-700">
                            <span className="mr-1">SORT BY:</span>
                            <button onClick={() => onViewChange('categories')} className="hover:text-em-red underline">CATEGORY</button>
                            <span className="text-gray-400 mx-1">|</span>
                            <button onClick={() => onViewChange('locations')} className="hover:text-em-red underline">LOCATION</button>
                        </div>
                     )}
                 </div>

                 <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <button 
                        onClick={() => setIsFilterModalOpen(true)}
                        className={`
                            flex justify-center items-center gap-2 px-4 py-2 text-sm font-bold border rounded-lg shadow-sm
                            ${isFilterActive ? 'bg-red-50 text-em-red border-red-200' : 'text-gray-800 bg-white border-gray-300 hover:bg-gray-50'}
                        `}
                    >
                        <FilterIcon className="w-5 h-5" />
                        FILTERS
                        {isFilterActive && <span className="h-2 w-2 rounded-full bg-em-red"></span>}
                    </button>

                    {selectedItemIds.size > 0 && (
                        <button onClick={onBulkEditClick} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 ml-auto md:ml-0">
                            EDIT ({selectedItemIds.size})
                        </button>
                    )}
                </div>
            </div>

            {filteredItems.length === 0 && <div className="text-center py-12 px-4 bg-white rounded-lg shadow-sm border border-gray-200 no-items-message"><MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-500" /><h3>NO ITEMS FOUND</h3><p className="mt-1 text-gray-700">TRY ADJUSTING YOUR SEARCH OR FILTERS.</p></div>}
            
            {/* Mobile List View (Portrait) */}
            <div className="block md:hidden pb-24">
                {groupBy === 'category' ? (
                    Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, itemsInCategory]) => (
                        <div key={category} className="mb-4">
                            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest sticky top-24 z-10 shadow-sm">{category}</div>
                            {itemsInCategory.map(item => renderMobileRow(item))}
                        </div>
                    ))
                ) : groupBy === 'location' ? (
                    (displayData as { name: string; items: { item: InventoryItemUI; stock: Stock }[] }[]).map(group => (
                         <div key={group.name} className="mb-4">
                            <div className="bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-widest sticky top-24 z-10 shadow-sm">{group.name}</div>
                            {group.items.map(({ item, stock: stockEntry }) => renderMobileRow(item, stockEntry.quantity))}
                        </div>
                    ))
                ) : (
                    (displayData as InventoryItemUI[]).map(item => renderMobileRow(item))
                )}
            </div>

            {/* Desktop/Tablet Table View (Landscape) */}
            <div className="hidden md:block inventory-table-container overflow-hidden rounded-lg shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                        <tr>
                            <th scope="col" className="pl-6 py-3 text-left w-[1%]">
                                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 cursor-pointer" checked={allVisibleSelected} onChange={() => onSelectAll(sortedItems.map(i => i.id), !allVisibleSelected)} title="SELECT ALL" />
                            </th>
                            <SortableHeader sortValue="description" title="ITEM DESCRIPTION" className="text-left">ITEM</SortableHeader>
                            <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-[1%]">STATUS</th>
                            <SortableHeader sortValue="quantityInView" title="TOTAL QUANTITY" className="text-center w-[1%]">QTY</SortableHeader>
                            <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-[1%]">ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {groupBy === 'category' ? (
                            Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB)).map(([category, itemsInCategory]) => (
                                <React.Fragment key={category}>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <td colSpan={5} className="px-6 py-2 text-sm font-bold text-gray-800 uppercase tracking-wide border-l-4 border-em-red">{category}</td>
                                    </tr>
                                    {itemsInCategory.map(item => renderDesktopRow(item))}
                                </React.Fragment>
                            ))
                        ) : groupBy === 'location' ? (
                             (displayData as { name: string; items: { item: InventoryItemUI; stock: Stock }[] }[]).map(group => (
                                <React.Fragment key={group.name}>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <td colSpan={5} className="px-6 py-2 text-sm font-bold text-gray-800 uppercase tracking-wide border-l-4 border-em-red">{group.name}</td>
                                    </tr>
                                    {group.items.map(({ item, stock: stockEntry }) => renderDesktopRow(item, stockEntry.quantity))}
                                </React.Fragment>
                            ))
                        ) : (
                            (displayData as InventoryItemUI[]).map(item => renderDesktopRow(item))
                        )}
                    </tbody>
                </table>
            </div>
            
            <FilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApply={handleApplyFilters}
                onClear={handleClearFilters}
                locations={locations}
                categoryHierarchy={categoryHierarchy}
                currentCategory={filterCategory}
                currentLocation={filterLocation}
            />

            {itemToView && (
                <ProductDetailsModal 
                    item={itemToView} 
                    onClose={() => setItemToView(null)} 
                    onPrintSpecificLabel={onPrintSpecificLabel}
                    onSetFilterCategory={onSetFilterCategory}
                    onEdit={() => onEditClick(itemToView)}
                    onMove={() => onMoveClick(itemToView)}
                />
            )}

            {/* Mobile Action Sheet (Bottom Sheet) */}
            {activeActionItem && (
                <div className="fixed inset-0 z-50 flex items-end justify-center md:hidden">
                    <div className="fixed inset-0 bg-black bg-opacity-60 transition-opacity" onClick={() => setActiveActionItem(null)}></div>
                    <div className="relative w-full bg-white rounded-t-2xl shadow-xl animate-slide-up p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{activeActionItem.description}</h3>
                                <p className="text-sm text-gray-500 font-medium">{activeActionItem.id}</p>
                            </div>
                            <button onClick={() => setActiveActionItem(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                <XMarkIcon className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                             <button onClick={() => { onEditClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-yellow-50 rounded-xl text-yellow-600 border border-yellow-100"><PencilSquareIcon className="w-6 h-6" /></div>
                                <span className="text-xs font-bold text-gray-600 uppercase">Edit</span>
                            </button>
                             <button onClick={() => { onMoveClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-blue-50 rounded-xl text-blue-600 border border-blue-100"><ArrowRightLeftIcon className="w-6 h-6" /></div>
                                <span className="text-xs font-bold text-gray-600 uppercase">Move</span>
                            </button>
                            <button onClick={() => { onDuplicateClick(activeActionItem); setActiveActionItem(null); }} className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-purple-50 rounded-xl text-purple-600 border border-purple-100"><DocumentDuplicateIcon className="w-6 h-6" /></div>
                                <span className="text-xs font-bold text-gray-600 uppercase">Clone</span>
                            </button>
                            <button onClick={() => { onDeleteClick(activeActionItem.id); setActiveActionItem(null); }} className="flex flex-col items-center gap-2">
                                <div className="p-4 bg-red-50 rounded-xl text-red-600 border border-red-100"><TrashIcon className="w-6 h-6" /></div>
                                <span className="text-xs font-bold text-gray-600 uppercase">Delete</span>
                            </button>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                             <button onClick={() => { onPrintBarcode(activeActionItem); setActiveActionItem(null); }} className="flex items-center justify-center gap-2 p-3 bg-gray-100 rounded-xl font-bold text-gray-700 text-sm border border-gray-200 uppercase">
                                <BarcodeIcon className="w-5 h-5" /> Barcode
                            </button>
                             <button onClick={() => { onGenerateReportForItem(activeActionItem.id); setActiveActionItem(null); }} className="flex items-center justify-center gap-2 p-3 bg-gray-100 rounded-xl font-bold text-gray-700 text-sm border border-gray-200 uppercase">
                                <DocumentChartBarIcon className="w-5 h-5" /> History
                            </button>
                        </div>
                    </div>
                     <style>{`
                        @keyframes slideUp {
                            from { transform: translateY(100%); }
                            to { transform: translateY(0); }
                        }
                        .animate-slide-up {
                            animation: slideUp 0.3s ease-out;
                        }
                    `}</style>
                </div>
            )}
        </div>
    );
};

export default InventoryTable;