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
import { InventoryCard } from './InventoryCard'; // New Import

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
    const [desktopMenuOpenId, setDesktopMenuOpenId] = useState<string | null>(null);
    const [groupBy, setGroupBy] = useState<'none' | 'category' | 'location'>('none');
    const [sortKey, setSortKey] = useState<SortKey>('id');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = () => setDesktopMenuOpenId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

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
        if (item.subCategory && categoryColors[item.subCategory]) return categoryColors[item.subCategory];
        if (item.category && categoryColors[item.category]) return categoryColors[item.category];
        return '#e5e5e5';
    };

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
                const
