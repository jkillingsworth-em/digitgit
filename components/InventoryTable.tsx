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
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { TagIcon } from './icons/TagIcon';
import { ClockIcon } from './icons/ClockIcon';
import { collectItemCategoryTokens, matchesCategoryFilters } from '../categoryFilters';
import LegacyFilterModal from './LegacyFilterModal';
import ProductDetailsModal from './ProductDetailsModal';
import { InventoryCard } from './InventoryCard';

interface InventoryTableProps {
    items: InventoryItem[];
    locations: Location[];
    stock: Stock[];
    categoryHierarchyMap: Record<string, string[]>;
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
    onBulkEditClick: () => void;
    view: 'all' | 'categories' | 'locations' | 'dashboard';
    searchQuery: string;
    navigationCategoryLink: string | null;
    navigationLocationLink: string | null;
    filterCategories: string[];
    filterLocations: string[];
    filterLowStock: boolean;
    onSetFilterCategories: (categories: string[]) => void;
    onSetFilterLocations: (locations: string[]) => void;
    onSetFilterLowStock: (isLow: boolean) => void;
    onViewChange?: (view: 'all' | 'categories' | 'locations' | 'dashboard') => void;
}

type SortKey = 'id' | 'description' | 'category' | 'quantityInView' | 'location';
type SortDirection = 'asc' | 'desc';
type LocationStockEntry = Stock & { locationName: string };

interface LocationAccordionEntry {
    item: InventoryItemUI;
    stock: LocationStockEntry;
}

interface LocationAccordionGroup {
    locationId: string;
    locationName: string;
    itemCount: number;
    subGroups: {
        name: string;
        itemCount: number;
        items: LocationAccordionEntry[];
    }[];
}

const calculateAverageUsage = (priorUsage?: { year: number; usage: number }[]): number => {
    if (!priorUsage || priorUsage.length === 0) {
        return 0;
    }
    const totalUsage = priorUsage.reduce((sum, entry) => sum + entry.usage, 0);
    return totalUsage / priorUsage.length;
};

const formatCategoryFilterLabel = (categoryFilter: string): string => categoryFilter.replace('|', ' / ');

const InventoryTable: React.FC<InventoryTableProps> = ({ 
    items, locations, stock, categoryHierarchyMap, onMoveClick, onDeleteClick, onDuplicateClick, onEditClick, onPrintBarcode, onPrintSpecificLabel,
    selectedItemIds, onSelectionChange, onSelectAll, onGenerateReportForItem,
    onBulkEditClick, view, searchQuery,
    navigationCategoryLink, navigationLocationLink,
    filterCategories, filterLocations, filterLowStock, onSetFilterCategories, onSetFilterLocations, onSetFilterLowStock, onViewChange
}) => {
    const [itemToView, setItemToView] = useState<InventoryItemUI | null>(null);
    const [activeActionItem, setActiveActionItem] = useState<InventoryItem | null>(null);
    const [groupBy, setGroupBy] = useState<'none' | 'category' | 'location'>('none');
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());
    const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());
    const [expandedSubLocations, setExpandedSubLocations] = useState<Set<string>>(new Set());
    const [lastSelectionAnchorId, setLastSelectionAnchorId] = useState<string | null>(null);

    useEffect(() => {
        if (view === 'categories') {
            setGroupBy('category');
        } else if (view === 'locations') {
            setGroupBy('location');
        } else {
            setGroupBy('none');
        }
    }, [view]);

    useEffect(() => {
        if (view !== 'categories') {
            setExpandedCategories(new Set());
            setExpandedSubCategories(new Set());
        }
        if (view !== 'locations') {
            setExpandedLocations(new Set());
            setExpandedSubLocations(new Set());
        }
    }, [view]);

    const categoryFilterSet = useMemo(() => new Set(filterCategories), [filterCategories]);
    const locationFilterSet = useMemo(() => new Set(filterLocations), [filterLocations]);

    const getVisibleLocationEntries = (item: InventoryItemUI): LocationStockEntry[] => {
        const scopedEntries = item.locationsWithStock.filter(entry => {
            if (navigationLocationLink && entry.locationId !== navigationLocationLink) return false;
            if (locationFilterSet.size > 0 && !locationFilterSet.has(entry.locationId)) return false;
            return true;
        });

        return scopedEntries.length > 0 ? scopedEntries : item.locationsWithStock;
    };

    const getPrimaryLocationEntry = (item: InventoryItemUI): LocationStockEntry | undefined => {
        return getVisibleLocationEntries(item)[0];
    };

    const getPrimaryLocationLabel = (item: InventoryItemUI): string => {
        return getPrimaryLocationEntry(item)?.locationName || 'NO LOCATION';
    };

    const pageTitle = useMemo(() => {
        if (searchQuery) return `"${searchQuery}"`;
        if (filterLowStock) return 'LOW STOCK ALERTS';
        if (filterCategories.length === 1 && filterLocations.length === 0) return formatCategoryFilterLabel(filterCategories[0]);
        if (filterLocations.length === 1 && filterCategories.length === 0) {
            return locations.find(l => l.id === filterLocations[0])?.name || filterLocations[0];
        }
        if (filterCategories.length > 0 && filterLocations.length > 0) return `${filterCategories.length + filterLocations.length} ACTIVE FILTERS`;
        if (filterCategories.length > 1) return `${filterCategories.length} CATEGORY FILTERS`;
        if (filterLocations.length > 1) return `${filterLocations.length} LOCATION FILTERS`;
        if (navigationCategoryLink) return formatCategoryFilterLabel(navigationCategoryLink);
        if (navigationLocationLink) {
            return locations.find(l => l.id === navigationLocationLink)?.name || navigationLocationLink;
        }
        if (view === 'categories') return 'BY CATEGORY';
        if (view === 'locations') return 'BY LOCATION';
        return 'ALL INVENTORY';
    }, [view, searchQuery, navigationCategoryLink, navigationLocationLink, filterCategories, filterLocations, filterLowStock, locations]);
    
    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDirection('asc');
        }
    };

    const categoryHierarchy = useMemo(() => {
        const hierarchy: Record<string, Set<string>> = {};
        Object.entries(categoryHierarchyMap).forEach(([cat, subs]) => {
            hierarchy[cat] = new Set(subs);
        });

        const hasManagedHierarchy = Object.keys(hierarchy).length > 0;

        items.forEach(item => {
            const cat = item.category || 'UNCATEGORIZED';
            if (hasManagedHierarchy && cat !== 'UNCATEGORIZED' && !hierarchy[cat]) return;
            if (!hierarchy[cat]) hierarchy[cat] = new Set();
            const add = (val?: string | null) => {
                if (val && val.trim()) hierarchy[cat].add(val);
            };
            add(item.subCategory3);
            add(item.subCategory);
            if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(add);
            if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(add);
        });
        if (!hierarchy['UNCATEGORIZED']) hierarchy['UNCATEGORIZED'] = new Set();
        return hierarchy;
    }, [items, categoryHierarchyMap]);

    const mappedItems: InventoryItemUI[] = useMemo(() => {
        const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));
        const locationOrderIndex = new Map(locations.map((loc, index) => [loc.id, index]));
        return items.map(item => {
            const allItemStock = stock.filter(s => s.itemId === item.id);
            const totalQuantity = allItemStock.reduce((sum, s) => sum + s.quantity, 0);
            const quantityInView = totalQuantity;
            const locationsWithStock = allItemStock
                .map(s => ({...s, locationName: locationMap.get(s.locationId) || 'UNKNOWN LOCATION'}))
                .sort((a,b) => {
                    const aIndex = locationOrderIndex.get(a.locationId);
                    const bIndex = locationOrderIndex.get(b.locationId);
                    if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
                    if (aIndex !== undefined) return -1;
                    if (bIndex !== undefined) return 1;
                    return a.locationName.localeCompare(b.locationName);
                });
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
                accentColor: '#e5e5e5',
                isLowStock
            };
        });
    }, [items, locations, stock]);

    const filteredItems = useMemo(() => {
        let result = mappedItems;
        if (searchQuery) {
            const query = searchQuery.trim().toLowerCase();
            if (query) {
                const includesQuery = (value: unknown) =>
                    String(value ?? '').toLowerCase().includes(query);

                result = result.filter(item => {
                    if (includesQuery(item.id) || includesQuery(item.name) || includesQuery(item.description) || includesQuery(item.category)) {
                        return true;
                    }
                    // Legacy single sub-category
                    if (includesQuery(item.subCategory) || includesQuery(item.subCategory3)) {
                        return true;
                    }
                    // Hierarchy arrays (guard non-arrays from bad/legacy docs)
                    const sub1 = Array.isArray(item.subCategory1) ? item.subCategory1 : [];
                    const sub2 = Array.isArray(item.subCategory2) ? item.subCategory2 : [];
                    return sub1.some(includesQuery) || sub2.some(includesQuery);
                });
            }
        }
        if (navigationCategoryLink) {
            result = result.filter(item => matchesCategoryFilters(item, [navigationCategoryLink]));
        }
        if (navigationLocationLink) {
            result = result.filter(item => item.locationsWithStock.some(location => location.locationId === navigationLocationLink));
        }
        if (categoryFilterSet.size > 0) {
            result = result.filter(item => matchesCategoryFilters(item, categoryFilterSet));
        }
        if (locationFilterSet.size > 0) {
            result = result.filter(item => item.locationsWithStock.some(location => locationFilterSet.has(location.locationId)));
        }
        if (filterLowStock) result = result.filter(item => item.isLowStock);
        return result;
    }, [mappedItems, searchQuery, navigationCategoryLink, navigationLocationLink, categoryFilterSet, locationFilterSet, filterLowStock]);

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
                const locA = getPrimaryLocationLabel(a);
                const locB = getPrimaryLocationLabel(b);
                const locationCompare = sortDirection === 'asc' ? locA.localeCompare(locB) : -locA.localeCompare(locB);
                if (locationCompare !== 0) return locationCompare;

                const subLocationA = getPrimaryLocationEntry(a)?.subLocationDetail || '';
                const subLocationB = getPrimaryLocationEntry(b)?.subLocationDetail || '';
                const subLocationCompare = sortDirection === 'asc' ? subLocationA.localeCompare(subLocationB) : -subLocationA.localeCompare(subLocationB);
                if (subLocationCompare !== 0) return subLocationCompare;

                return sortDirection === 'asc'
                    ? a.description.localeCompare(b.description)
                    : b.description.localeCompare(a.description);
            }
            const aValue = a[sortKey];
            const bValue = b[sortKey];
            if (typeof aValue === 'number' && typeof bValue === 'number') return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            return sortDirection === 'asc' ? String(aValue ?? '').localeCompare(String(bValue ?? '')) : String(bValue ?? '').localeCompare(String(aValue ?? ''));
        });
    }, [filteredItems, sortKey, sortDirection, navigationLocationLink, locationFilterSet]);

    const visibleItemIds = useMemo(() => sortedItems.map(item => item.id), [sortedItems]);

    const applySelectionSet = (nextSelection: Set<string>) => {
        if (nextSelection.size === 0) {
            onSelectAll([], false);
            return;
        }
        onSelectAll(Array.from(nextSelection), true);
    };

    const handleSelectionToggle = (
        itemId: string,
        modifiers?: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean },
    ) => {
        const hasShift = Boolean(modifiers?.shiftKey);
        const hasCtrlLike = Boolean(modifiers?.ctrlKey || modifiers?.metaKey);

        if (hasShift && lastSelectionAnchorId && visibleItemIds.includes(lastSelectionAnchorId)) {
            const anchorIndex = visibleItemIds.indexOf(lastSelectionAnchorId);
            const currentIndex = visibleItemIds.indexOf(itemId);
            if (anchorIndex !== -1 && currentIndex !== -1) {
                const [start, end] = anchorIndex <= currentIndex ? [anchorIndex, currentIndex] : [currentIndex, anchorIndex];
                const rangeIds = visibleItemIds.slice(start, end + 1);
                const shouldSelectRange = hasCtrlLike ? true : !selectedItemIds.has(itemId);
                const next = new Set(selectedItemIds);
                rangeIds.forEach(id => {
                    if (shouldSelectRange) next.add(id);
                    else next.delete(id);
                });
                applySelectionSet(next);
                setLastSelectionAnchorId(itemId);
                return;
            }
        }

        onSelectionChange(itemId);
        setLastSelectionAnchorId(itemId);
    };

    const handleAddAllSelection = () => {
        onSelectAll(visibleItemIds, true);
        setLastSelectionAnchorId(visibleItemIds[0] || null);
    };

    const handleClearAllSelection = () => {
        onSelectAll([], false);
        setLastSelectionAnchorId(null);
    };

    const handleRowClick = (item: InventoryItemUI, event: React.MouseEvent<HTMLElement>) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleSelectionToggle(item.id, event);
            return;
        }
        setItemToView(item);
    };

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

    const locationSortedGroups = useMemo(() => {
        if (groupBy !== 'none' || sortKey !== 'location') return [] as Array<{ name: string; items: InventoryItemUI[] }>;

        const groups = new Map<string, InventoryItemUI[]>();
        sortedItems.forEach(item => {
            const label = getPrimaryLocationLabel(item);
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label)!.push(item);
        });

        return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
    }, [sortedItems, groupBy, sortKey, navigationLocationLink, locationFilterSet]);

    const locationAccordionData = useMemo(() => {
        const locationMetaMap = new Map(locations.map(location => [location.id, location]));
        const locationOrderIndex = new Map(locations.map((location, index) => [location.id, index]));
        const groupMap = new Map<string, { locationId: string; locationName: string; subGroups: Map<string, LocationAccordionEntry[]> }>();

        sortedItems.forEach(item => {
            item.locationsWithStock
                .filter(entry => (locationFilterSet.size === 0 || locationFilterSet.has(entry.locationId)) && (!navigationLocationLink || entry.locationId === navigationLocationLink))
                .forEach(entry => {
                    const locationMeta = locationMetaMap.get(entry.locationId);
                    const locationName = locationMeta?.name || entry.locationName || 'UNKNOWN LOCATION';
                    if (!groupMap.has(entry.locationId)) {
                        groupMap.set(entry.locationId, {
                            locationId: entry.locationId,
                            locationName,
                            subGroups: new Map<string, LocationAccordionEntry[]>(),
                        });
                    }

                    const group = groupMap.get(entry.locationId)!;
                    const subGroupName = entry.subLocationDetail?.trim() || 'UNASSIGNED';
                    if (!group.subGroups.has(subGroupName)) {
                        group.subGroups.set(subGroupName, []);
                    }
                    group.subGroups.get(subGroupName)!.push({ item, stock: entry });
                });
        });

        return Array.from(groupMap.values())
            .sort((a, b) => {
                const aIndex = locationOrderIndex.get(a.locationId);
                const bIndex = locationOrderIndex.get(b.locationId);
                if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
                if (aIndex !== undefined) return -1;
                if (bIndex !== undefined) return 1;
                return a.locationName.localeCompare(b.locationName);
            })
            .map(group => {
                const locationMeta = locationMetaMap.get(group.locationId);
                const subLocationOrder = new Map((locationMeta?.subLocations || []).map((name, index) => [name.trim().toUpperCase(), index]));
                const subGroups = Array.from(group.subGroups.entries())
                    .sort(([aName], [bName]) => {
                        if (aName === 'UNASSIGNED') return 1;
                        if (bName === 'UNASSIGNED') return -1;

                        const aIndex = subLocationOrder.get(aName.toUpperCase());
                        const bIndex = subLocationOrder.get(bName.toUpperCase());
                        if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
                        if (aIndex !== undefined) return -1;
                        if (bIndex !== undefined) return 1;
                        return aName.localeCompare(bName);
                    })
                    .map(([name, entries]) => ({
                        name,
                        items: entries,
                        itemCount: new Set(entries.map(({ item }) => item.id)).size,
                    }));

                return {
                    locationId: group.locationId,
                    locationName: group.locationName,
                    itemCount: new Set(subGroups.flatMap(subGroup => subGroup.items.map(({ item }) => item.id))).size,
                    subGroups,
                } satisfies LocationAccordionGroup;
            });
    }, [sortedItems, locations, locationFilterSet, navigationLocationLink]);

    const getItemSubCategories = (item: InventoryItemUI): string[] => {
        return Array.from(collectItemCategoryTokens(item));
    };

    const toggleCategoryExpand = (category: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(category)) {
                next.delete(category);
            } else {
                next.add(category);
            }
            return next;
        });
    };

    const toggleSubCategoryExpand = (category: string, subCategory: string) => {
        const key = `${category}|${subCategory}`;
        setExpandedSubCategories(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const toggleLocationExpand = (locationId: string) => {
        setExpandedLocations(prev => {
            const next = new Set(prev);
            if (next.has(locationId)) {
                next.delete(locationId);
            } else {
                next.add(locationId);
            }
            return next;
        });
    };

    const toggleSubLocationExpand = (locationId: string, subLocation: string) => {
        const key = `${locationId}|${subLocation}`;
        setExpandedSubLocations(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const renderCategoryAccordionMobile = () => {
        const categoryGroups = Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB));
        return categoryGroups.map(([category, itemsInCategory]) => {
            const isCategoryExpanded = expandedCategories.has(category);
            const subCategoryMap = new Map<string, InventoryItemUI[]>();
            const uncategorizedSubItems: InventoryItemUI[] = [];

            itemsInCategory.forEach(item => {
                const subCategories = getItemSubCategories(item);
                if (subCategories.length === 0) {
                    uncategorizedSubItems.push(item);
                    return;
                }
                subCategories.forEach(sub => {
                    if (!subCategoryMap.has(sub)) subCategoryMap.set(sub, []);
                    subCategoryMap.get(sub)!.push(item);
                });
            });

            const hasSubCategories = subCategoryMap.size > 0;
            const orderedSubEntries = Array.from(subCategoryMap.entries()).sort(([a], [b]) => a.localeCompare(b));
            if (uncategorizedSubItems.length > 0) orderedSubEntries.push(['UNASSIGNED', uncategorizedSubItems]);

            return (
                <div key={category} className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <button
                        onClick={() => toggleCategoryExpand(category)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100"
                    >
                        <div className="flex items-center gap-2">
                            <TagIcon className="w-4 h-4 text-em-red" />
                            <span className="text-sm font-black uppercase tracking-wider text-em-red">{category}</span>
                            <span className="text-[11px] font-bold text-gray-500">({itemsInCategory.length})</span>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isCategoryExpanded && (
                        <div className="p-3 space-y-3">
                            {hasSubCategories ? (
                                orderedSubEntries.map(([subCategory, subItems]) => {
                                    const subKey = `${category}|${subCategory}`;
                                    const isSubExpanded = expandedSubCategories.has(subKey);
                                    return (
                                        <div key={subKey} className="rounded-lg border border-gray-200 overflow-hidden">
                                            <button
                                                onClick={() => toggleSubCategoryExpand(category, subCategory)}
                                                className="w-full flex items-center justify-between px-3 py-2 bg-white"
                                            >
                                                <span className="text-xs font-black uppercase text-gray-700">{subCategory}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-gray-500">{subItems.length}</span>
                                                    <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                                </div>
                                            </button>
                                            {isSubExpanded && (
                                                <div className="p-2 bg-gray-50">
                                                    {subItems.map(item => renderMobileRow(item))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                itemsInCategory.map(item => renderMobileRow(item))
                            )}
                        </div>
                    )}
                </div>
            );
        });
    };

    const renderCategoryAccordionDesktop = () => {
        const categoryGroups = Object.entries(displayData as Record<string, InventoryItemUI[]>).sort(([catA], [catB]) => catA.localeCompare(catB));
        return categoryGroups.map(([category, itemsInCategory]) => {
            const isCategoryExpanded = expandedCategories.has(category);
            const subCategoryMap = new Map<string, InventoryItemUI[]>();
            const uncategorizedSubItems: InventoryItemUI[] = [];

            itemsInCategory.forEach(item => {
                const subCategories = getItemSubCategories(item);
                if (subCategories.length === 0) {
                    uncategorizedSubItems.push(item);
                    return;
                }
                subCategories.forEach(sub => {
                    if (!subCategoryMap.has(sub)) subCategoryMap.set(sub, []);
                    subCategoryMap.get(sub)!.push(item);
                });
            });

            const hasSubCategories = subCategoryMap.size > 0;
            const orderedSubEntries = Array.from(subCategoryMap.entries()).sort(([a], [b]) => a.localeCompare(b));
            if (uncategorizedSubItems.length > 0) orderedSubEntries.push(['UNASSIGNED', uncategorizedSubItems]);

            return (
                <React.Fragment key={category}>
                    <tr className="bg-white border-y-2 border-red-100">
                        <td colSpan={8} className="px-2 md:px-3 xl:px-6 py-3">
                            <button onClick={() => toggleCategoryExpand(category)} className="w-full flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TagIcon className="w-4 h-4 text-em-red" />
                                    <span className="text-sm font-black text-em-red uppercase tracking-widest">{category}</span>
                                    <span className="text-[11px] font-bold text-gray-500">({itemsInCategory.length})</span>
                                </div>
                                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        </td>
                    </tr>

                    {isCategoryExpanded && (
                        hasSubCategories ? (
                            orderedSubEntries.map(([subCategory, subItems]) => {
                                const subKey = `${category}|${subCategory}`;
                                const isSubExpanded = expandedSubCategories.has(subKey);
                                return (
                                    <React.Fragment key={subKey}>
                                        <tr className="bg-gray-50 border-b border-gray-200">
                                            <td colSpan={8} className="px-2 md:px-3 xl:px-8 py-2">
                                                <button onClick={() => toggleSubCategoryExpand(category, subCategory)} className="w-full flex items-center justify-between">
                                                    <span className="text-xs font-black uppercase text-gray-700">{subCategory}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-gray-500">{subItems.length}</span>
                                                        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </button>
                                            </td>
                                        </tr>
                                        {isSubExpanded && subItems.map(item => renderTableRow(item))}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            itemsInCategory.map(item => renderTableRow(item))
                        )
                    )}
                </React.Fragment>
            );
        });
    };

    const createLocationScopedItem = (item: InventoryItemUI, stockEntry: LocationStockEntry): InventoryItemUI => ({
        ...item,
        quantityInView: stockEntry.quantity,
        totalQuantity: stockEntry.quantity,
        locationsWithStock: [stockEntry],
        stockTooltip: `${stockEntry.locationName}${stockEntry.subLocationDetail ? ` / ${stockEntry.subLocationDetail}` : ''}: ${stockEntry.quantity}`,
    });

    const renderLocationAccordionMobile = () => {
        return locationAccordionData.map(group => {
            const isLocationExpanded = expandedLocations.has(group.locationId);

            return (
                <div key={group.locationId} className="mb-5 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                    <button
                        onClick={() => toggleLocationExpand(group.locationId)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100"
                    >
                        <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-em-red" />
                            <span className="text-sm font-black uppercase tracking-wider text-em-red">{group.locationName}</span>
                            <span className="text-[11px] font-bold text-gray-500">({group.itemCount})</span>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isLocationExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isLocationExpanded && (
                        <div className="p-3 space-y-3">
                            {group.subGroups.map((subGroup, index) => {
                                const subKey = `${group.locationId}|${subGroup.name}`;
                                const isSubExpanded = expandedSubLocations.has(subKey);

                                return (
                                    <div key={subKey} className="rounded-lg border border-gray-200 overflow-hidden">
                                        <button
                                            onClick={() => toggleSubLocationExpand(group.locationId, subGroup.name)}
                                            className="w-full flex items-center justify-between px-3 py-2 bg-white"
                                        >
                                            <span className="text-xs font-black uppercase text-gray-700">{subGroup.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-gray-500">{subGroup.itemCount}</span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                        {isSubExpanded && (
                                            <div className="p-2 bg-gray-50">
                                                {subGroup.items.map(({ item, stock }, itemIndex) => renderMobileRow(
                                                    item,
                                                    createLocationScopedItem(item, stock),
                                                    `${subKey}-${item.id}-${stock.docId || stock.subLocationDetail || itemIndex}-${index}`,
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        });
    };

    const renderLocationAccordionDesktop = () => {
        return locationAccordionData.map(group => {
            const isLocationExpanded = expandedLocations.has(group.locationId);

            return (
                <React.Fragment key={group.locationId}>
                    <tr className="bg-white border-y-2 border-red-100">
                        <td colSpan={8} className="px-2 md:px-3 xl:px-6 py-3">
                            <button onClick={() => toggleLocationExpand(group.locationId)} className="w-full flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MapPinIcon className="w-4 h-4 text-em-red" />
                                    <span className="text-sm font-black text-em-red uppercase tracking-widest">{group.locationName}</span>
                                    <span className="text-[11px] font-bold text-gray-500">({group.itemCount})</span>
                                </div>
                                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isLocationExpanded ? 'rotate-180' : ''}`} />
                            </button>
                        </td>
                    </tr>

                    {isLocationExpanded && group.subGroups.map((subGroup, index) => {
                        const subKey = `${group.locationId}|${subGroup.name}`;
                        const isSubExpanded = expandedSubLocations.has(subKey);

                        return (
                            <React.Fragment key={subKey}>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <td colSpan={8} className="px-2 md:px-3 xl:px-8 py-2">
                                        <button onClick={() => toggleSubLocationExpand(group.locationId, subGroup.name)} className="w-full flex items-center justify-between">
                                            <span className="text-xs font-black uppercase text-gray-700">{subGroup.name}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-bold text-gray-500">{subGroup.itemCount}</span>
                                                <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isSubExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </button>
                                    </td>
                                </tr>
                                {isSubExpanded && subGroup.items.map(({ item, stock }, itemIndex) => renderTableRow(
                                    item,
                                    stock.quantity,
                                    `${subKey}-${item.id}-${stock.docId || stock.subLocationDetail || itemIndex}-${index}`,
                                ))}
                            </React.Fragment>
                        );
                    })}
                </React.Fragment>
            );
        });
    };

    const renderLocationSortMobile = () => {
        return locationSortedGroups.map(group => (
            <div key={`location-sort-mobile-${group.name}`} className="mb-8">
                {renderMobileGroupHeader(group.name, <MapPinIcon className="w-4 h-4 text-em-red" />)}
                {group.items.map(item => renderMobileRow(item))}
            </div>
        ));
    };

    const renderLocationSortDesktop = () => {
        return locationSortedGroups.map(group => (
            <React.Fragment key={`location-sort-desktop-${group.name}`}>
                <tr className="bg-white border-y-2 border-red-100">
                    <td colSpan={8} className="px-2 md:px-3 xl:px-6 py-3">
                        <div className="flex items-center gap-2">
                            <MapPinIcon className="w-4 h-4 text-em-red" />
                            <span className="text-sm font-black text-em-red uppercase tracking-widest">{group.name}</span>
                            <span className="text-[11px] font-bold text-gray-500">({group.items.length})</span>
                        </div>
                    </td>
                </tr>
                {group.items.map(item => renderTableRow(item))}
            </React.Fragment>
        ));
    };

    const categoriesCount = useMemo(() => new Set(filteredItems.map(i => i.category || 'Uncategorized')).size, [filteredItems]);
    const allVisibleSelected = sortedItems.length > 0 && sortedItems.every(i => selectedItemIds.has(i.id));
    const isFilterActive = filterCategories.length > 0 || filterLocations.length > 0 || filterLowStock;
    const activeFiltersCount = filterCategories.length + filterLocations.length + (filterLowStock ? 1 : 0);
    const showDesktopTitle = filterCategories.length > 0 || filterLocations.length > 0 || Boolean(navigationCategoryLink) || Boolean(navigationLocationLink);
    const hasCategoryContext = filterCategories.length > 0 || Boolean(navigationCategoryLink);
    const hasLocationContext = filterLocations.length > 0 || Boolean(navigationLocationLink);
    const isLocationSortActive = groupBy === 'none' && sortKey === 'location';

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

    const renderTableRow = (item: InventoryItemUI, quantity?: number, rowKey?: string) => (
        <React.Fragment key={rowKey || `${item.id}-${quantity ?? 'total'}`}>
            <tr className="hidden md:table-row xl:hidden border-b border-gray-200 even:bg-gray-50 hover:bg-red-50 transition-colors group">
                <td className="pl-2 md:pl-3 xl:pl-6 py-4 w-12 whitespace-nowrap align-middle">
                     <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-red-800 focus:ring-red-800 cursor-pointer"
                        checked={selectedItemIds.has(item.id)}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelectionToggle(item.id, e);
                        }}
                        onChange={() => {}}
                     />
                </td>
                <td className="px-2 md:px-3 xl:px-6 py-4 align-middle" onClick={(e) => handleRowClick(item, e)}>
                    <div className="font-bold text-stone-900 text-base cursor-pointer hover:text-red-700 leading-tight max-w-[140px] lg:max-w-[200px] truncate" title={item.description}>{item.description}</div>
                    <div className="text-sm font-semibold text-black mt-1">{item.id}</div>
                </td>
                
                {/* COMPACT STACK CATEGORY CELL */}
                <td className="px-2 md:px-3 xl:px-6 py-4 text-left align-middle" onClick={(e) => handleRowClick(item, e)}>
                    <CategoryCellContent item={item} />
                </td>

                <td className="px-2 md:px-3 xl:px-6 py-4 text-center whitespace-nowrap align-middle" onClick={(e) => handleRowClick(item, e)}>
                    {item.isLowStock ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200">LOW</span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">OK</span>
                    )}
                </td>
                <td className="px-2 md:px-3 xl:px-6 py-4 text-center align-middle" onClick={(e) => handleRowClick(item, e)}>
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
                     <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-gray-300 text-red-800 focus:ring-red-800 cursor-pointer"
                        checked={selectedItemIds.has(item.id)}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelectionToggle(item.id, e);
                        }}
                        onChange={() => {}}
                     />
                </td>
                <td className="px-6 py-5 w-36 align-middle text-lg font-bold text-gray-900 tracking-tight truncate" onClick={(e) => handleRowClick(item, e)} title={item.id}>{item.id}</td>
                <td className="px-6 py-5 align-middle w-[25%] text-left" onClick={(e) => handleRowClick(item, e)}>
                    <div className="text-lg font-bold text-gray-900 cursor-pointer hover:text-red-700 leading-tight truncate" title={item.description}>{item.description}</div>
                </td>
                
                {/* LARGE DESKTOP COMPACT STACK CELL */}
                <td className="px-6 py-5 whitespace-nowrap text-left align-middle w-[15%]" onClick={(e) => handleRowClick(item, e)}>
                    <CategoryCellContent item={item} />
                </td>

                <td className="px-6 py-5 text-left whitespace-nowrap align-middle w-[10%]" onClick={(e) => handleRowClick(item, e)}>
                    {item.isLowStock ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">LOW STOCK</span>
                    ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">IN STOCK</span>
                    )}
                </td>
                 <td className="px-6 py-5 text-center align-middle w-24" onClick={(e) => handleRowClick(item, e)}>
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

    const renderMobileRow = (item: InventoryItemUI, displayItem: InventoryItemUI = item, cardKey?: string) => (
        <InventoryCard 
            key={cardKey || item.id} 
            item={displayItem} 
            isSelected={selectedItemIds.has(item.id)}
            onToggleSelect={onSelectionChange}
            onClick={() => setItemToView(item)} 
            onAction={() => setActiveActionItem(item)} 
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

    const legacyCategoryHierarchy = useMemo(() => {
        const normalized: Record<string, string[]> = {};
        Object.entries(categoryHierarchy).forEach(([cat, subs]) => {
            normalized[cat] = Array.from(subs);
        });
        return normalized;
    }, [categoryHierarchy]);

    const handleApplyLegacyFilters = (filters: { categories: Set<string>; locations: Set<string> }) => {
        onSetFilterCategories(Array.from(filters.categories));
        onSetFilterLocations(Array.from(filters.locations));
    };

    const handleClearFilters = () => {
        onSetFilterCategories([]);
        onSetFilterLocations([]);
        onSetFilterLowStock(false);
    };

    return (
        <div className="relative">
                <div className="md:hidden pt-4 pb-3 px-4 bg-gradient-to-b from-white to-gray-50 border-b border-gray-100">
                      <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-none">{pageTitle}</h2>
                 <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.14em]">{view === 'all' ? 'List View' : view === 'categories' ? 'Grouped by Category' : 'Grouped by Location'}</span>
                    {items.length > 0 && <span className="text-[10px] font-bold text-gray-700">|</span>}
                          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.14em]">{filteredItems.length} Items</span>
                 </div>
            </div>

                <div className="md:hidden sticky top-16 z-20 bg-gray-50/95 backdrop-blur-sm px-4 py-2 mb-2">
                     <div className="flex items-center h-11 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
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
            </div>

            {selectedItemIds.size > 0 && (
                <div className="md:hidden mb-3 px-4">
                    <button
                        onClick={onBulkEditClick}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white shadow"
                    >
                        Manage Selected ({selectedItemIds.size})
                    </button>
                </div>
            )}

              <div className="hidden md:flex sticky top-16 z-30 bg-white/95 backdrop-blur-sm p-4 mb-6 rounded-lg shadow-sm border border-gray-300 items-center justify-between gap-4">
                 <div className="flex-1 min-w-0">
                     {showDesktopTitle ? (
                         <div>
                            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none flex items-center gap-3">
                                {pageTitle}
                                {isFilterActive && <button onClick={handleClearFilters} className="text-xs font-bold text-black hover:text-red-600 border border-gray-200 bg-gray-50 hover:bg-red-50 px-2 py-1 rounded transition-colors">CLEAR</button>}
                            </h2>
                            <div className="flex items-center gap-2 mt-1 text-xs font-bold text-black uppercase tracking-widest">
                                {hasLocationContext && <MapPinIcon className="w-3 h-3" />}
                                {hasCategoryContext && <TagIcon className="w-3 h-3" />}
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
                    <button
                        onClick={handleAddAllSelection}
                        disabled={visibleItemIds.length === 0}
                        className="px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide"
                    >
                        Add All
                    </button>
                    {selectedItemIds.size > 0 && (
                        <button
                            onClick={handleClearAllSelection}
                            className="px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 uppercase tracking-wide"
                        >
                            Clear All
                        </button>
                    )}
                    {selectedItemIds.size > 0 && (
                         <button onClick={onBulkEditClick} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 uppercase tracking-wide transition-colors animate-fade-in-down">MANAGE SELECTED ({selectedItemIds.size})</button>
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
                    renderCategoryAccordionMobile()
                ) : groupBy === 'location' ? (
                    renderLocationAccordionMobile()
                ) : isLocationSortActive ? (
                    renderLocationSortMobile()
                ) : (
                    (displayData as InventoryItemUI[]).map(item => renderMobileRow(item))
                )}
            </div>

            <div className="hidden md:block inventory-table-container overflow-x-auto rounded-lg shadow-sm border border-gray-300">
                <table className="min-w-full divide-y divide-gray-200 xl:table-fixed">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                            <th scope="col" className="pl-2 md:pl-3 xl:pl-6 py-3 text-left w-12"><input type="checkbox" className="w-4 h-4 rounded border-gray-300 cursor-pointer text-red-700 focus:ring-red-700" checked={allVisibleSelected} onChange={() => onSelectAll(visibleItemIds, !allVisibleSelected)} /></th>
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
                            renderCategoryAccordionDesktop()
                        ) : groupBy === 'location' ? (
                            renderLocationAccordionDesktop()
                        ) : isLocationSortActive ? (
                            renderLocationSortDesktop()
                        ) : (
                            (displayData as InventoryItemUI[]).map(item => renderTableRow(item))
                        )}
                    </tbody>
                </table>
            </div>
            <LegacyFilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
                onApply={handleApplyLegacyFilters}
                onClear={handleClearFilters}
                locations={locations}
                categoryHierarchy={legacyCategoryHierarchy}
                currentCategories={categoryFilterSet}
                currentLocations={locationFilterSet}
                selectionMode="multi"
                facetOrder={view === 'locations' ? 'locations-first' : 'categories-first'}
            />
            {itemToView && <ProductDetailsModal item={itemToView} onClose={() => setItemToView(null)} onPrintSpecificLabel={onPrintSpecificLabel} onSetFilterCategory={onSetFilterCategories} onEdit={() => onEditClick(itemToView)} onMove={() => onMoveClick(itemToView)} />}
            
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
