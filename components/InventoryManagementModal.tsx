import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, PurchaseOrderRecord, Stock, Location } from '../types';
import { matchesCategoryFilters } from '../categoryFilters';
import { XMarkIcon } from './icons/XMarkIcon';
import { FilterIcon } from './icons/FilterIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { SortIcon } from './icons/SortIcon';
import LegacyFilterModal from './LegacyFilterModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import { BarcodeIcon } from './icons/BarcodeIcon';
import PurchaseOrderModal from './PurchaseOrderModal';

type SaveMode = 'ADD' | 'EDIT' | 'AUDIT' | 'MOVE';
type Mode = SaveMode;

interface MoveRoute {
    from: string;
    to: string;
    qty: number;
}

interface MobileLocationSection {
    locationId: string;
    locationName: string;
    entries: Array<{
        item: InventoryItem;
        quantity: number;
        subLocationDetail: string;
    }>;
}

interface InventoryEditSnapshot {
    newItems: Array<Record<string, any>>;
    auditUpdates: Record<string, number>;
    auditSubLocations: Record<string, string>;
    moveRoutes: Record<string, MoveRoute>;
    editRows: Record<string, { id: string; description: string; category: string; subCategory: string }>;
    extraLocationsByItem: Record<string, string[]>;
    selectedItemIds: string[];
    bulkCategory: string;
    bulkSubCategory: string;
    bulkMove: { from: string; to: string; qtyMap: Record<string, number> };
    bulkMoveSubLocation: string;
}

interface InventoryManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    stock: Stock[];
    purchaseOrders: PurchaseOrderRecord[];
    locations: Location[];
    categoryHierarchy: Record<string, string[]>;
    onSave: (mode: SaveMode, data: any, date: string) => Promise<void>;
    onUpsertPurchaseOrder: (record: PurchaseOrderRecord) => Promise<PurchaseOrderRecord>;
    onOpenItemDetails?: (item: InventoryItem) => void;
    onOpenBarcodeGenerator?: (selectedItemIds: string[]) => void;
    initialMode?: Mode;
    initialFilters?: {
        categories?: string[];
        locations?: string[];
    };
    initialItemIds?: string[];
}

type CategoryPickerTarget = { type: 'item'; itemId: string } | { type: 'bulk' };
type LocationAssignmentTarget =
    | { type: 'item'; itemId: string; visibleLocationIds: string[] }
    | { type: 'bulk'; itemIds: string[] };
type SortKey = 'id' | 'description' | 'category' | 'totalQty';
type AddInventoryMode = 'new' | 'existing';
type PurchaseOrderModalTarget = { kind: 'new'; index: number } | { kind: 'existing'; rowId: string } | { kind: 'existing-receive'; poNumber?: string };

interface ExistingInventoryRow {
    rowId: string;
    itemId: string;
    quantity: number;
    locationId: string;
    source: 'OH' | 'PO';
    poNumber: string;
    subLocationDetail: string;
}

interface ExistingInventorySeed {
    locationId?: string;
    source?: 'OH' | 'PO';
    poNumber?: string;
    subLocationDetail?: string;
}

const normalizeLookupValue = (value?: string | null) => (value || '').trim().toUpperCase();
const uniqueUppercaseValues = (values: string[]) => Array.from(new Set(values.map(value => normalizeLookupValue(value)).filter(Boolean)));

const normalizeMode = (value: Mode): Mode => (value === 'ADD' ? 'ADD' : 'EDIT');

const InventoryManagementModal: React.FC<InventoryManagementModalProps> = ({
    isOpen,
    onClose,
    items,
    stock,
    purchaseOrders,
    locations,
    categoryHierarchy,
    onSave,
    onUpsertPurchaseOrder,
    onOpenItemDetails,
    onOpenBarcodeGenerator,
    initialMode = 'ADD',
    initialFilters,
    initialItemIds,
}) => {
    const [mode, setMode] = useState<Mode>(normalizeMode(initialMode));
    const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [filterOpen, setFilterOpen] = useState(false);
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
    const [filterLocations, setFilterLocations] = useState<Set<string>>(new Set());
    const [scopedItemIds, setScopedItemIds] = useState<Set<string> | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [addInventoryMode, setAddInventoryMode] = useState<AddInventoryMode>('new');
    const [existingInventorySearch, setExistingInventorySearch] = useState('');
    const [existingInventoryPoSearch, setExistingInventoryPoSearch] = useState('');
    const [isExistingInventoryScannerOpen, setExistingInventoryScannerOpen] = useState(false);
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const [newItems, setNewItems] = useState<Array<Record<string, any>>>([
        { id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH', poNumber: '' },
    ]);
    const [existingInventoryRows, setExistingInventoryRows] = useState<ExistingInventoryRow[]>([]);
    const [auditUpdates, setAuditUpdates] = useState<Record<string, number>>({});
    const [auditSubLocations, setAuditSubLocations] = useState<Record<string, string>>({});
    const [moveRoutes, setMoveRoutes] = useState<Record<string, MoveRoute>>({});
    const [editingQtyCell, setEditingQtyCell] = useState<string | null>(null);
    const [editingSubLocationCell, setEditingSubLocationCell] = useState<string | null>(null);
    const [editRows, setEditRows] = useState<Record<string, { id: string; description: string; category: string; subCategory: string }>>({});
    const [extraLocationsByItem, setExtraLocationsByItem] = useState<Record<string, string[]>>({});
    const [locationAssignmentTarget, setLocationAssignmentTarget] = useState<LocationAssignmentTarget | null>(null);
    const [locationAssignmentValue, setLocationAssignmentValue] = useState('');
    const [locationAssignmentQty, setLocationAssignmentQty] = useState('');
    const [locationAssignmentSubLocation, setLocationAssignmentSubLocation] = useState('');
    const [activeEditCell, setActiveEditCell] = useState<{ itemId: string; field: 'id' | 'description' } | null>(null);
    const [purchaseOrderTarget, setPurchaseOrderTarget] = useState<PurchaseOrderModalTarget | null>(null);
    const [categoryPickerTarget, setCategoryPickerTarget] = useState<CategoryPickerTarget | null>(null);
    const [categoryPickerCategory, setCategoryPickerCategory] = useState('');
    const [categoryPickerSubCategory, setCategoryPickerSubCategory] = useState('');
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkSubCategory, setBulkSubCategory] = useState('');
    const [bulkMove, setBulkMove] = useState<{ from: string; to: string; qtyMap: Record<string, number> }>({ from: '', to: '', qtyMap: {} });
    const [bulkMoveSubLocation, setBulkMoveSubLocation] = useState('');
    const [sortState, setSortState] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'id', direction: 'asc' });
    const [isMobile, setIsMobile] = useState(false);
    const [undoStack, setUndoStack] = useState<InventoryEditSnapshot[]>([]);
    const [redoStack, setRedoStack] = useState<InventoryEditSnapshot[]>([]);
    const isApplyingHistoryRef = useRef(false);

    const stockSnapshotByKey = useMemo(() => {
        const snapshot: Record<string, { qty: number; subLocationDetail: string }> = {};
        stock.forEach(entry => {
            const key = `${entry.itemId}|${entry.locationId}`;
            if (!snapshot[key]) {
                snapshot[key] = {
                    qty: 0,
                    subLocationDetail: entry.subLocationDetail || '',
                };
            }

            snapshot[key].qty += Number(entry.quantity) || 0;
            if (!snapshot[key].subLocationDetail && entry.subLocationDetail) {
                snapshot[key].subLocationDetail = entry.subLocationDetail;
            }
        });
        return snapshot;
    }, [stock]);

    const stagedAuditEntries = useMemo(() => {
        const keys = new Set([...Object.keys(auditUpdates), ...Object.keys(auditSubLocations)]);

        return Array.from(keys)
            .map(key => {
                const [itemId, locationId] = key.split('|');
                const baseline = stockSnapshotByKey[key];
                const baselineQty = Number(baseline?.qty || 0);
                const baselineSubLocation = (baseline?.subLocationDetail || '').trim();
                const qty = auditUpdates[key] !== undefined ? Number(auditUpdates[key]) : baselineQty;
                const subLocationDetail = (auditSubLocations[key] ?? baseline?.subLocationDetail ?? '').trim();

                return { itemId, locationId, qty, subLocationDetail, baselineQty, baselineSubLocation };
            })
            .filter(entry => entry.itemId && entry.locationId && Number.isFinite(entry.qty) && entry.qty >= 0)
            .filter(entry => entry.qty !== entry.baselineQty || entry.subLocationDetail !== entry.baselineSubLocation)
            .map(({ itemId, locationId, qty, subLocationDetail }) => ({ itemId, locationId, qty, subLocationDetail }));
    }, [auditUpdates, auditSubLocations, stockSnapshotByKey]);

    const moveRouteEntries = useMemo(() => Object.entries(moveRoutes), [moveRoutes]);

    const stagedTransfers = useMemo(() => {
        return moveRouteEntries
            .map(([itemId, route]) => ({ itemId, qty: Number(route.qty), from: route.from, to: route.to }))
            .filter(entry => entry.itemId && Number.isFinite(entry.qty) && entry.qty > 0 && entry.from && entry.to && entry.from !== entry.to);
    }, [moveRouteEntries]);

    const invalidMoveRoutes = useMemo(() => {
        return moveRouteEntries
            .map(([itemId, route]) => ({ itemId, route }))
            .filter(({ route }) => Number(route.qty) > 0 && (!route.from || !route.to || route.from === route.to));
    }, [moveRouteEntries]);

    const stagedItemEdits = useMemo(() => {
        return Object.entries(editRows)
            .map(([originalId, updated]) => {
                const original = items.find(item => item.id === originalId);
                if (!original) return null;
                const nextId = updated.id.toUpperCase().trim();
                const nextDescription = updated.description.trim();
                const nextCategory = updated.category.trim();
                const nextSubCategory = updated.subCategory.trim();
                const originalSubCategory = (original.subCategory3 || original.subCategory || '').trim();
                const changed =
                    nextId !== original.id ||
                    nextDescription !== original.description ||
                    nextCategory !== original.category ||
                    nextSubCategory !== originalSubCategory;
                if (!changed) return null;
                return {
                    originalId: original.id,
                    newId: nextId,
                    description: nextDescription,
                    category: nextCategory,
                    subCategory: nextSubCategory,
                };
            })
            .filter(Boolean) as Array<{ originalId: string; newId: string; description: string; category: string; subCategory: string }>;
    }, [editRows, items]);

    const stagedBulkTransfers = useMemo(() => {
        return Array.from(selectedItemIds)
            .map(itemId => ({
                itemId,
                qty: Number(bulkMove.qtyMap[itemId] || 0),
                from: bulkMove.from,
                to: bulkMove.to,
                subLocationDetail: bulkMoveSubLocation.trim(),
            }))
            .filter(entry => entry.qty > 0);
    }, [selectedItemIds, bulkMove, bulkMoveSubLocation]);

    const stagedItemEditIds = useMemo(() => new Set(stagedItemEdits.map(entry => entry.originalId)), [stagedItemEdits]);
    const stagedAuditItemIds = useMemo(() => new Set(stagedAuditEntries.map(entry => entry.itemId)), [stagedAuditEntries]);
    const stagedBulkMoveItemIds = useMemo(() => new Set(stagedBulkTransfers.map(entry => entry.itemId)), [stagedBulkTransfers]);

    const locationNameById = useMemo(() => {
        const mapped: Record<string, string> = {};
        locations.forEach(loc => {
            mapped[loc.id] = loc.name;
        });
        return mapped;
    }, [locations]);

    const itemsById = useMemo(() => new Map(items.map(item => [item.id, item])), [items]);

    const locationBarcodeMatches = useMemo(() => {
        const matches = new Map<string, Array<{ itemId: string; locationId: string; subLocationDetail: string }>>();

        stock.forEach(entry => {
            const normalizedBarcode = normalizeLookupValue(entry.locationBarcode);
            if (!normalizedBarcode) return;

            if (!matches.has(normalizedBarcode)) {
                matches.set(normalizedBarcode, []);
            }

            matches.get(normalizedBarcode)!.push({
                itemId: entry.itemId,
                locationId: entry.locationId,
                subLocationDetail: entry.subLocationDetail || '',
            });
        });

        return matches;
    }, [stock]);

    const locationBarcodesByItem = useMemo(() => {
        const grouped = new Map<string, string[]>();

        locationBarcodeMatches.forEach((matches, barcode) => {
            matches.forEach(match => {
                const existing = grouped.get(match.itemId) || [];
                if (!existing.includes(barcode)) existing.push(barcode);
                grouped.set(match.itemId, existing);
            });
        });

        return grouped;
    }, [locationBarcodeMatches]);

    const stockSummaryByItem = useMemo(() => {
        const summary: Record<string, { totalQty: number; locations: string[] }> = {};

        stock.forEach(entry => {
            if (!summary[entry.itemId]) {
                summary[entry.itemId] = { totalQty: 0, locations: [] };
            }

            summary[entry.itemId].totalQty += Number(entry.quantity) || 0;
            const locationLabel = locationNameById[entry.locationId] || entry.locationId;
            const locationSummary = `${locationLabel}: ${entry.quantity}${entry.subLocationDetail ? ` / ${entry.subLocationDetail}` : ''}`;
            if (!summary[entry.itemId].locations.includes(locationSummary)) {
                summary[entry.itemId].locations.push(locationSummary);
            }
        });

        return summary;
    }, [stock, locationNameById]);

    const activeCategories = useMemo(
        () => Object.keys(categoryHierarchy).filter(cat => cat && cat.trim() && cat.toUpperCase() !== 'UNCATEGORIZED'),
        [categoryHierarchy],
    );

    const getSubCategoryOptions = (categoryValue: string) => {
        if (!categoryValue) return [];
        return (categoryHierarchy[categoryValue] || []).filter(Boolean);
    };

    const categoryPickerSubOptions = useMemo(() => getSubCategoryOptions(categoryPickerCategory), [categoryPickerCategory, categoryHierarchy]);

    const existingInventoryResults = useMemo(() => {
        const normalizedQuery = normalizeLookupValue(existingInventorySearch);
        if (!normalizedQuery) return [];

        const scoreItem = (item: InventoryItem) => {
            const itemId = normalizeLookupValue(item.id);
            const description = normalizeLookupValue(item.description);
            const barcodes = locationBarcodesByItem.get(item.id) || [];

            if (itemId === normalizedQuery) return 0;
            if (barcodes.includes(normalizedQuery)) return 1;
            if (itemId.startsWith(normalizedQuery)) return 2;
            if (barcodes.some(barcode => barcode.startsWith(normalizedQuery))) return 3;
            if (description.startsWith(normalizedQuery)) return 4;
            return 5;
        };

        return [...items]
            .filter(item => {
                const itemId = normalizeLookupValue(item.id);
                const description = normalizeLookupValue(item.description);
                const category = normalizeLookupValue(item.category || '');
                const barcodes = locationBarcodesByItem.get(item.id) || [];
                return itemId.includes(normalizedQuery) || description.includes(normalizedQuery) || category.includes(normalizedQuery) || barcodes.some(barcode => barcode.includes(normalizedQuery));
            })
            .sort((left, right) => {
                const scoreDiff = scoreItem(left) - scoreItem(right);
                if (scoreDiff !== 0) return scoreDiff;
                return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: 'base' });
            })
            .slice(0, 12);
    }, [items, existingInventorySearch, locationBarcodesByItem]);

    const lastExistingInventoryDefaults = useMemo(() => {
        for (let index = existingInventoryRows.length - 1; index >= 0; index -= 1) {
            const row = existingInventoryRows[index];
            if (row.locationId || row.subLocationDetail || row.poNumber) {
                return {
                    locationId: row.locationId,
                    source: row.source,
                    poNumber: row.poNumber,
                    subLocationDetail: row.subLocationDetail,
                } satisfies ExistingInventorySeed;
            }
        }

        return null;
    }, [existingInventoryRows]);

    const filteredItems = useMemo(() => {
        if (mode === 'ADD') return [];
        let result = items;

        if (scopedItemIds && scopedItemIds.size > 0) {
            result = result.filter(item => scopedItemIds.has(item.id));
        }

        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            result = result.filter(item => item.id.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower));
        }
        if (filterCategories.size > 0) {
            result = result.filter(item => matchesCategoryFilters(item, filterCategories));
        }
        if (filterLocations.size > 0) {
            result = result.filter(item => {
                const itemStock = stock.filter(s => s.itemId === item.id);
                return itemStock.some(s => filterLocations.has(s.locationId));
            });
        }
        return result;
    }, [items, stock, searchQuery, filterCategories, filterLocations, mode, scopedItemIds]);

    const visibleTotalQtyByItem = useMemo(() => {
        const totals: Record<string, number> = {};
        filteredItems.forEach(item => {
            const baseTotal = stock
                .filter(entry => entry.itemId === item.id)
                .filter(entry => filterLocations.size === 0 || filterLocations.has(entry.locationId))
                .reduce((sum, entry) => sum + (Number(entry.quantity) || 0), 0);

            const changedLocationIds = new Set<string>();
            Object.keys(auditUpdates).forEach(key => {
                if (key.startsWith(`${item.id}|`)) changedLocationIds.add(key.split('|')[1]);
            });
            Object.keys(auditSubLocations).forEach(key => {
                if (key.startsWith(`${item.id}|`)) changedLocationIds.add(key.split('|')[1]);
            });
            (extraLocationsByItem[item.id] || []).forEach(locationId => changedLocationIds.add(locationId));

            let adjustment = 0;
            changedLocationIds.forEach(locationId => {
                if (filterLocations.size > 0 && !filterLocations.has(locationId)) return;
                const key = `${item.id}|${locationId}`;
                const baseline = stockSnapshotByKey[key]?.qty || 0;
                const nextQty = auditUpdates[key] !== undefined ? Number(auditUpdates[key]) || 0 : baseline;
                adjustment += nextQty - baseline;
            });

            totals[item.id] = baseTotal + adjustment;
        });
        return totals;
    }, [filteredItems, stock, filterLocations, auditUpdates, auditSubLocations, extraLocationsByItem, stockSnapshotByKey]);

    const sortedFilteredItems = useMemo(() => {
        const compareText = (left: string, right: string) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
        const directionFactor = sortState.direction === 'asc' ? 1 : -1;

        return [...filteredItems].sort((left, right) => {
            if (sortState.key === 'totalQty') {
                const diff = (visibleTotalQtyByItem[left.id] || 0) - (visibleTotalQtyByItem[right.id] || 0);
                if (diff !== 0) return diff * directionFactor;
                return compareText(left.id, right.id) * directionFactor;
            }

            const leftRow = editRows[left.id];
            const rightRow = editRows[right.id];
            const leftValue =
                sortState.key === 'id'
                    ? (leftRow?.id || left.id)
                    : sortState.key === 'description'
                      ? (leftRow?.description || left.description || '')
                      : (leftRow?.category || left.category || 'UNASSIGNED');
            const rightValue =
                sortState.key === 'id'
                    ? (rightRow?.id || right.id)
                    : sortState.key === 'description'
                      ? (rightRow?.description || right.description || '')
                      : (rightRow?.category || right.category || 'UNASSIGNED');

            const textCompare = compareText(leftValue, rightValue);
            if (textCompare !== 0) return textCompare * directionFactor;
            return compareText(left.id, right.id) * directionFactor;
        });
    }, [filteredItems, sortState, visibleTotalQtyByItem, editRows]);

    const sortedItemIndex = useMemo(() => new Map(sortedFilteredItems.map((item, index) => [item.id, index])), [sortedFilteredItems]);

    const mobileLocationSections = useMemo(() => {
        const sections = new Map<string, MobileLocationSection>();
        const locationOrderIndex = new Map(locations.map((loc, index) => [loc.id, index]));
        const visibleItemIds = new Set(sortedFilteredItems.map(item => item.id));
        const itemById = new Map(sortedFilteredItems.map(item => [item.id, item]));

        stock.forEach(entry => {
            if (!visibleItemIds.has(entry.itemId)) return;
            if (filterLocations.size > 0 && !filterLocations.has(entry.locationId)) return;
            const item = itemById.get(entry.itemId);
            if (!item) return;

            if (!sections.has(entry.locationId)) {
                sections.set(entry.locationId, {
                    locationId: entry.locationId,
                    locationName: locationNameById[entry.locationId] || entry.locationId,
                    entries: [],
                });
            }

            sections.get(entry.locationId)!.entries.push({
                item,
                quantity: entry.quantity,
                subLocationDetail: entry.subLocationDetail || '',
            });
        });

        Object.entries(extraLocationsByItem).forEach(([itemId, locationIds]) => {
            if (!visibleItemIds.has(itemId)) return;
            const item = itemById.get(itemId);
            if (!item) return;

            locationIds.forEach(locationId => {
                if (filterLocations.size > 0 && !filterLocations.has(locationId)) return;
                const alreadyExists = sections.get(locationId)?.entries.some(entry => entry.item.id === itemId);
                if (alreadyExists) return;

                if (!sections.has(locationId)) {
                    sections.set(locationId, {
                        locationId,
                        locationName: locationNameById[locationId] || locationId,
                        entries: [],
                    });
                }

                sections.get(locationId)!.entries.push({
                    item,
                    quantity: auditUpdates[`${itemId}|${locationId}`] ?? 0,
                    subLocationDetail: auditSubLocations[`${itemId}|${locationId}`] ?? '',
                });
            });
        });

        return Array.from(sections.values())
            .map(section => ({
                ...section,
                entries: section.entries.sort((a, b) => (sortedItemIndex.get(a.item.id) || 0) - (sortedItemIndex.get(b.item.id) || 0)),
            }))
            .sort((a, b) => {
                const aIndex = locationOrderIndex.get(a.locationId);
                const bIndex = locationOrderIndex.get(b.locationId);
                if (aIndex !== undefined && bIndex !== undefined) return aIndex - bIndex;
                if (aIndex !== undefined) return -1;
                if (bIndex !== undefined) return 1;
                return a.locationName.localeCompare(b.locationName);
            });
    }, [sortedFilteredItems, stock, filterLocations, locationNameById, locations, extraLocationsByItem, auditUpdates, auditSubLocations, sortedItemIndex]);

    useEffect(() => {
        const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
        updateIsMobile();
        window.addEventListener('resize', updateIsMobile);
        return () => window.removeEventListener('resize', updateIsMobile);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setMode(normalizeMode(initialMode));
            setFilterCategories(new Set(initialFilters?.categories || []));
            setFilterLocations(new Set(initialFilters?.locations || []));
            setScopedItemIds(initialItemIds && initialItemIds.length > 0 ? new Set(initialItemIds) : null);
            setSearchQuery('');
            setAddInventoryMode('new');
            setExistingInventorySearch('');
            setExistingInventoryPoSearch('');
            setSelectedItemIds(new Set(initialItemIds || []));
            setAuditUpdates({});
            setAuditSubLocations({});
            setMoveRoutes({});
            setEditingQtyCell(null);
            setEditingSubLocationCell(null);
            setEditRows({});
            setExistingInventoryRows([]);
            setExtraLocationsByItem({});
            setLocationAssignmentTarget(null);
            setLocationAssignmentValue('');
            setLocationAssignmentQty('');
            setLocationAssignmentSubLocation('');
            setActiveEditCell(null);
            setPurchaseOrderTarget(null);
            setCategoryPickerTarget(null);
            setCategoryPickerCategory('');
            setCategoryPickerSubCategory('');
            setBulkCategory('');
            setBulkSubCategory('');
            setBulkMove({ from: '', to: '', qtyMap: {} });
            setBulkMoveSubLocation('');
            setSortState({ key: 'id', direction: 'asc' });
            setNewItems([{ id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH', poNumber: '' }]);
            setUndoStack([]);
            setRedoStack([]);
        }
    }, [initialMode, initialFilters, initialItemIds, isOpen]);

    useEffect(() => {
        setSelectedItemIds(scopedItemIds && scopedItemIds.size > 0 ? new Set(scopedItemIds) : new Set());
        setAuditUpdates({});
        setAuditSubLocations({});
        setMoveRoutes({});
        setEditingQtyCell(null);
        setEditingSubLocationCell(null);
        setEditRows({});
        setExtraLocationsByItem({});
        setLocationAssignmentTarget(null);
        setLocationAssignmentValue('');
        setLocationAssignmentQty('');
        setLocationAssignmentSubLocation('');
        setExistingInventoryPoSearch('');
        setActiveEditCell(null);
        setPurchaseOrderTarget(null);
        setCategoryPickerTarget(null);
        setCategoryPickerCategory('');
        setCategoryPickerSubCategory('');
        setBulkCategory('');
        setBulkSubCategory('');
        setBulkMove({ from: '', to: '', qtyMap: {} });
        setBulkMoveSubLocation('');
        setUndoStack([]);
        setRedoStack([]);
    }, [mode, filterCategories, filterLocations, scopedItemIds]);

    if (!isOpen) return null;

    const createSnapshot = (): InventoryEditSnapshot => ({
        newItems: structuredClone(newItems),
        auditUpdates: { ...auditUpdates },
        auditSubLocations: { ...auditSubLocations },
        moveRoutes: structuredClone(moveRoutes),
        editRows: structuredClone(editRows),
        extraLocationsByItem: structuredClone(extraLocationsByItem),
        selectedItemIds: Array.from(selectedItemIds),
        bulkCategory,
        bulkSubCategory,
        bulkMove: structuredClone(bulkMove),
        bulkMoveSubLocation,
    });

    const applySnapshot = (snapshot: InventoryEditSnapshot) => {
        isApplyingHistoryRef.current = true;
        setNewItems(snapshot.newItems);
        setAuditUpdates(snapshot.auditUpdates);
        setAuditSubLocations(snapshot.auditSubLocations);
        setMoveRoutes(snapshot.moveRoutes);
        setEditRows(snapshot.editRows);
        setExtraLocationsByItem(snapshot.extraLocationsByItem);
        setSelectedItemIds(new Set(snapshot.selectedItemIds));
        setBulkCategory(snapshot.bulkCategory);
        setBulkSubCategory(snapshot.bulkSubCategory);
        setBulkMove(snapshot.bulkMove);
        setBulkMoveSubLocation(snapshot.bulkMoveSubLocation);
        setActiveEditCell(null);
        setEditingQtyCell(null);
        setEditingSubLocationCell(null);
        setLocationAssignmentTarget(null);
        setLocationAssignmentValue('');
        setLocationAssignmentQty('');
        setLocationAssignmentSubLocation('');
        setCategoryPickerTarget(null);
        setCategoryPickerCategory('');
        setCategoryPickerSubCategory('');
        setTimeout(() => {
            isApplyingHistoryRef.current = false;
        }, 0);
    };

    const pushHistory = () => {
        if (isApplyingHistoryRef.current || mode === 'ADD') return;
        const snapshot = createSnapshot();
        setUndoStack(prev => {
            const next = [...prev, snapshot];
            return next.length > 40 ? next.slice(next.length - 40) : next;
        });
        setRedoStack([]);
    };

    const handleUndo = () => {
        if (undoStack.length === 0 || mode === 'ADD') return;
        const previous = undoStack[undoStack.length - 1];
        const current = createSnapshot();
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, current]);
        applySnapshot(previous);
    };

    const handleRedo = () => {
        if (redoStack.length === 0 || mode === 'ADD') return;
        const next = redoStack[redoStack.length - 1];
        const current = createSnapshot();
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, current]);
        applySnapshot(next);
    };

    useEffect(() => {
        if (!isOpen || mode === 'ADD') return;

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tag = target?.tagName?.toLowerCase();
            const isTextEntryTarget =
                tag === 'input' ||
                tag === 'textarea' ||
                tag === 'select' ||
                Boolean(target?.isContentEditable);
            if (isTextEntryTarget) return;

            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            if (!isCtrlOrCmd) return;

            const key = event.key.toLowerCase();
            if (key === 'z' && !event.shiftKey) {
                if (undoStack.length === 0) return;
                event.preventDefault();
                handleUndo();
                return;
            }

            if (key === 'y' || (key === 'z' && event.shiftKey)) {
                if (redoStack.length === 0) return;
                event.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, mode, undoStack, redoStack]);

    const handleSelectAll = (checked: boolean) => {
        pushHistory();
        setSelectedItemIds(checked ? new Set(sortedFilteredItems.map(item => item.id)) : new Set());
    };

    const toggleSelection = (id: string) => {
        pushHistory();
        const next = new Set(selectedItemIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedItemIds(next);
    };

    const toggleSelectionForLocation = (locationId: string, checked: boolean) => {
        pushHistory();
        const itemIds = new Set(
            mobileLocationSections
                .find(section => section.locationId === locationId)
                ?.entries.map(entry => entry.item.id) || [],
        );
        const next = new Set(selectedItemIds);
        itemIds.forEach(itemId => {
            if (checked) next.add(itemId);
            else next.delete(itemId);
        });
        setSelectedItemIds(next);
        setBulkMove(prev => ({ ...prev, from: locationId }));
    };

    const handleAddNewRow = () => {
        setNewItems(prev => [...prev, { id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH', poNumber: '' }]);
    };

    const handleRemoveNewRow = (index: number) => {
        setNewItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const updateNewItem = (index: number, field: string, value: any) => {
        setNewItems(prev => prev.map((row, idx) => {
            if (idx !== index) return row;

            const nextValue = field === 'poNumber' && typeof value === 'string' ? value.toUpperCase() : value;
            return {
                ...row,
                [field]: nextValue,
                ...(field === 'source' && value !== 'PO' ? { poNumber: '' } : {}),
            };
        }));
    };

    const getSuggestedLocationId = (itemId?: string) => {
        if (filterLocations.size === 1) {
            return Array.from(filterLocations)[0];
        }

        if (!itemId) return '';

        const knownLocations = Array.from(new Set(stock.filter(entry => entry.itemId === itemId).map(entry => entry.locationId)));
        return knownLocations.length === 1 ? knownLocations[0] : '';
    };

    const resolveExistingInventoryLookup = (lookupValue: string) => {
        const normalizedValue = normalizeLookupValue(lookupValue);
        if (!normalizedValue) return null;

        const directItemMatch = items.find(item => normalizeLookupValue(item.id) === normalizedValue);
        if (directItemMatch) {
            return {
                item: directItemMatch,
                seed: {},
            };
        }

        const locationBarcodeMatch = locationBarcodeMatches.get(normalizedValue)?.find(match => itemsById.has(match.itemId));
        if (!locationBarcodeMatch) return null;

        const matchedItem = itemsById.get(locationBarcodeMatch.itemId);
        if (!matchedItem) return null;

        return {
            item: matchedItem,
            seed: {
                locationId: locationBarcodeMatch.locationId,
                subLocationDetail: locationBarcodeMatch.subLocationDetail,
            } satisfies ExistingInventorySeed,
        };
    };

    const resolvePurchaseOrderLookup = (lookupValue: string) => {
        const normalizedValue = normalizeLookupValue(lookupValue);
        if (!normalizedValue) return null;

        return purchaseOrders.find(record => normalizeLookupValue(record.poNumber) === normalizedValue) || null;
    };

    const buildExistingInventoryRow = (item: InventoryItem, seed: ExistingInventorySeed = {}): ExistingInventoryRow => {
        const nextSource = seed.source || lastExistingInventoryDefaults?.source || 'OH';

        return {
            rowId: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            itemId: item.id,
            quantity: 0,
            locationId: seed.locationId || lastExistingInventoryDefaults?.locationId || getSuggestedLocationId(item.id),
            source: nextSource,
            poNumber: nextSource === 'PO' ? seed.poNumber || lastExistingInventoryDefaults?.poNumber || '' : '',
            subLocationDetail: seed.subLocationDetail || lastExistingInventoryDefaults?.subLocationDetail || '',
        };
    };

    const stageExistingInventoryByPurchaseOrder = (record: PurchaseOrderRecord) => {
        const linkedItems = uniqueUppercaseValues(record.itemIds || [])
            .map(itemId => itemsById.get(itemId))
            .filter((item): item is InventoryItem => Boolean(item));

        if (linkedItems.length === 0) {
            window.alert('That PO does not have any linked existing inventory items yet.');
            return;
        }

        const linkedItemIds = new Set(linkedItems.map(item => item.id));
        const stagedItemIds = new Set(existingInventoryRows.map(row => row.itemId));
        const itemsToAdd = linkedItems.filter(item => !stagedItemIds.has(item.id));

        setExistingInventoryRows(prev => {
            const next = prev.map(row => (
                linkedItemIds.has(row.itemId)
                    ? { ...row, source: 'PO' as const, poNumber: record.poNumber }
                    : row
            ));

            itemsToAdd.forEach(item => {
                next.push(buildExistingInventoryRow(item, { source: 'PO', poNumber: record.poNumber }));
            });

            return next;
        });

        setExistingInventoryPoSearch(record.poNumber);
    };

    const handleExistingInventoryPurchaseOrderLoad = (lookupValue: string) => {
        const record = resolvePurchaseOrderLookup(lookupValue);
        if (!record) {
            window.alert('Purchase order not found.');
            return;
        }

        stageExistingInventoryByPurchaseOrder(record);
    };

    const addExistingInventoryRow = (item: InventoryItem, seed: ExistingInventorySeed = {}) => {
        setExistingInventoryRows(prev => [...prev, buildExistingInventoryRow(item, seed)]);
        setExistingInventorySearch('');
    };

    const updateExistingInventoryRow = (rowId: string, patch: Partial<Omit<ExistingInventoryRow, 'rowId'>>) => {
        setExistingInventoryRows(prev => prev.map(row => {
            if (row.rowId !== rowId) return row;

            const normalizedPatch = {
                ...patch,
                ...(typeof patch.poNumber === 'string' ? { poNumber: patch.poNumber.toUpperCase() } : {}),
            };

            return {
                ...row,
                ...normalizedPatch,
                ...(patch.source && patch.source !== 'PO' ? { poNumber: '' } : {}),
            };
        }));
    };

    const removeExistingInventoryRow = (rowId: string) => {
        setExistingInventoryRows(prev => prev.filter(row => row.rowId !== rowId));
    };

    const applyExistingInventorySeed = (rowId: string, seed: ExistingInventorySeed) => {
        const nextSource = seed.source || 'OH';

        updateExistingInventoryRow(rowId, {
            locationId: seed.locationId || '',
            source: nextSource,
            poNumber: nextSource === 'PO' ? seed.poNumber || '' : '',
            subLocationDetail: seed.subLocationDetail || '',
        });
    };

    const applyLastLocationToExistingRow = (rowId: string) => {
        if (!lastExistingInventoryDefaults?.locationId) {
            window.alert('Set a location on another staged row first.');
            return;
        }

        applyExistingInventorySeed(rowId, lastExistingInventoryDefaults);
    };

    const repeatPreviousExistingRow = (rowId: string) => {
        const rowIndex = existingInventoryRows.findIndex(row => row.rowId === rowId);
        if (rowIndex <= 0) {
            window.alert('There is no previous row to repeat.');
            return;
        }

        const previousRow = existingInventoryRows[rowIndex - 1];
        if (!previousRow.locationId && !previousRow.subLocationDetail && !previousRow.poNumber) {
            window.alert('The previous row does not have receiving details to copy yet.');
            return;
        }

        applyExistingInventorySeed(rowId, {
            locationId: previousRow.locationId,
            source: previousRow.source,
            poNumber: previousRow.poNumber,
            subLocationDetail: previousRow.subLocationDetail,
        });
    };

    const handleExistingInventoryScan = (result: string) => {
        setExistingInventorySearch(result);
        setExistingInventoryScannerOpen(false);

        const lookup = resolveExistingInventoryLookup(result);
        if (!lookup) {
            window.alert('Barcode not found in existing inventory.');
            return;
        }

        addExistingInventoryRow(lookup.item, lookup.seed);
    };

    const openPurchaseOrderModal = (target: PurchaseOrderModalTarget) => {
        setPurchaseOrderTarget(target);
    };

    const closePurchaseOrderModal = () => {
        setPurchaseOrderTarget(null);
    };

    const purchaseOrderModalContext = useMemo(() => {
        if (!purchaseOrderTarget) return null;

        if (purchaseOrderTarget.kind === 'new') {
            const row = newItems[purchaseOrderTarget.index];
            if (!row) return null;

            return {
                poNumber: String(row.poNumber || ''),
                itemCode: String(row.id || '').toUpperCase(),
                itemDescription: String(row.description || ''),
            };
        }

        if (purchaseOrderTarget.kind === 'existing-receive') {
            return {
                poNumber: purchaseOrderTarget.poNumber || existingInventoryPoSearch,
                itemCode: 'MULTI-SKU',
                itemDescription: 'EXISTING INVENTORY',
            };
        }

        const row = existingInventoryRows.find(entry => entry.rowId === purchaseOrderTarget.rowId);
        if (!row) return null;
        const item = itemsById.get(row.itemId);

        return {
            poNumber: row.poNumber,
            itemCode: row.itemId,
            itemDescription: item?.description || '',
        };
    }, [purchaseOrderTarget, newItems, existingInventoryRows, itemsById, existingInventoryPoSearch]);

    const applyPurchaseOrderToTarget = (record: PurchaseOrderRecord) => {
        if (!purchaseOrderTarget) return;

        if (purchaseOrderTarget.kind === 'new') {
            setNewItems(prev => prev.map((row, index) => (
                index === purchaseOrderTarget.index
                    ? { ...row, source: 'PO', poNumber: record.poNumber }
                    : row
            )));
            return;
        }

        if (purchaseOrderTarget.kind === 'existing-receive') {
            stageExistingInventoryByPurchaseOrder(record);
            return;
        }

        updateExistingInventoryRow(purchaseOrderTarget.rowId, { source: 'PO', poNumber: record.poNumber });
    };

    const updateMoveRoute = (itemId: string, patch: Partial<MoveRoute>) => {
        pushHistory();
        setMoveRoutes(prev => ({
            ...prev,
            [itemId]: {
                from: prev[itemId]?.from || '',
                to: prev[itemId]?.to || '',
                qty: prev[itemId]?.qty || 0,
                ...patch,
            },
        }));
    };

    const getEditableRow = (item: InventoryItem) => {
        return editRows[item.id] || {
            id: item.id,
            description: item.description,
            category: item.category,
            subCategory: item.subCategory3 || item.subCategory || '',
        };
    };

    const updateEditRow = (item: InventoryItem, patch: Partial<{ id: string; description: string; category: string; subCategory: string }>) => {
        pushHistory();
        const current = getEditableRow(item);
        const nextCategory = patch.category ?? current.category;
        let nextSubCategory = patch.subCategory ?? current.subCategory;

        if (patch.category !== undefined && nextSubCategory) {
            const options = getSubCategoryOptions(nextCategory);
            if (!options.includes(nextSubCategory)) nextSubCategory = '';
        }

        setEditRows(prev => ({
            ...prev,
            [item.id]: {
                id: patch.id ?? current.id,
                description: patch.description ?? current.description,
                category: nextCategory,
                subCategory: nextSubCategory,
            },
        }));
    };

    const openCategoryPicker = (target: CategoryPickerTarget, item?: InventoryItem) => {
        if (target.type === 'bulk') {
            if (selectedItemIds.size === 0) {
                window.alert('Select one or more products first.');
                return;
            }
            setCategoryPickerTarget(target);
            setCategoryPickerCategory(bulkCategory);
            setCategoryPickerSubCategory(bulkSubCategory);
            return;
        }

        const sourceItem = item || items.find(entry => entry.id === target.itemId);
        if (!sourceItem) return;
        const editable = getEditableRow(sourceItem);
        setCategoryPickerTarget(target);
        setCategoryPickerCategory(editable.category);
        setCategoryPickerSubCategory(editable.subCategory);
    };

    const closeCategoryPicker = () => {
        setCategoryPickerTarget(null);
        setCategoryPickerCategory('');
        setCategoryPickerSubCategory('');
    };

    const handleCategoryPickerCategoryChange = (value: string) => {
        setCategoryPickerCategory(value);
        setCategoryPickerSubCategory(prev => {
            if (!value) return '';
            return getSubCategoryOptions(value).includes(prev) ? prev : '';
        });
    };

    const applyBulkCategorySelection = (nextCategory: string, nextSubCategory: string) => {
        if (!nextCategory) {
            window.alert('Select a category first.');
            return false;
        }
        if (selectedItemIds.size === 0) {
            window.alert('Select one or more products first.');
            return false;
        }

        const normalizedSubCategory = nextSubCategory && getSubCategoryOptions(nextCategory).includes(nextSubCategory) ? nextSubCategory : '';
        pushHistory();
        const selected = new Set(selectedItemIds);
        setBulkCategory(nextCategory);
        setBulkSubCategory(normalizedSubCategory);
        setEditRows(prev => {
            const next = { ...prev };
            items.forEach(item => {
                if (!selected.has(item.id)) return;
                const current = next[item.id] || {
                    id: item.id,
                    description: item.description,
                    category: item.category,
                    subCategory: item.subCategory3 || item.subCategory || '',
                };
                next[item.id] = { ...current, category: nextCategory, subCategory: normalizedSubCategory };
            });
            return next;
        });
        return true;
    };

    const commitCategoryPicker = () => {
        if (!categoryPickerTarget) return;

        if (categoryPickerTarget.type === 'bulk') {
            const applied = applyBulkCategorySelection(categoryPickerCategory, categoryPickerSubCategory);
            if (applied) closeCategoryPicker();
            return;
        }

        const item = items.find(entry => entry.id === categoryPickerTarget.itemId);
        if (!item) {
            closeCategoryPicker();
            return;
        }

        updateEditRow(item, {
            category: categoryPickerCategory,
            subCategory: categoryPickerSubCategory,
        });
        closeCategoryPicker();
    };

    const getActiveLocationIdsForItem = (itemId: string, visibleLocationIds?: string[]) => {
        const activeLocationIds = new Set<string>();

        if (visibleLocationIds && visibleLocationIds.length > 0) {
            visibleLocationIds.forEach(locationId => {
                if (filterLocations.size === 0 || filterLocations.has(locationId)) activeLocationIds.add(locationId);
            });
        } else {
            stock.forEach(entry => {
                if (entry.itemId !== itemId) return;
                if (filterLocations.size > 0 && !filterLocations.has(entry.locationId)) return;
                activeLocationIds.add(entry.locationId);
            });
        }

        (extraLocationsByItem[itemId] || []).forEach(locationId => {
            if (filterLocations.size === 0 || filterLocations.has(locationId)) activeLocationIds.add(locationId);
        });

        return activeLocationIds;
    };

    const getAllLocationIdsForItem = (itemId: string) => {
        const locationIds = new Set<string>();

        stock.forEach(entry => {
            if (entry.itemId === itemId) locationIds.add(entry.locationId);
        });

        (extraLocationsByItem[itemId] || []).forEach(locationId => {
            locationIds.add(locationId);
        });

        return Array.from(locationIds);
    };

    const getLocationDisplayName = (locationId: string) => locationNameById[locationId] || locationId;

    const getSelectableLocationsForItem = (itemId: string, visibleLocationIds: string[] = [], ignoreFilters = false) => {
        const activeLocationIds = ignoreFilters
            ? new Set(getAllLocationIdsForItem(itemId))
            : getActiveLocationIdsForItem(itemId, visibleLocationIds);

        return locations.filter(loc => (ignoreFilters || filterLocations.size === 0 || filterLocations.has(loc.id)) && !activeLocationIds.has(loc.id));
    };

    const getSelectableLocationsForBulk = (itemIds: string[], ignoreFilters = false) => {
        return locations.filter(loc => {
            if (!ignoreFilters && filterLocations.size > 0 && !filterLocations.has(loc.id)) return false;
            return itemIds.some(itemId => {
                const activeLocationIds = ignoreFilters
                    ? new Set(getAllLocationIdsForItem(itemId))
                    : getActiveLocationIdsForItem(itemId);
                return !activeLocationIds.has(loc.id);
            });
        });
    };

    const openLocationAssignment = (target: LocationAssignmentTarget) => {
        if (target.type === 'bulk' && target.itemIds.length === 0) {
            window.alert('Select one or more products first.');
            return;
        }

        const available = target.type === 'bulk'
            ? getSelectableLocationsForBulk(target.itemIds)
            : getSelectableLocationsForItem(target.itemId, target.visibleLocationIds, true);

        if (target.type === 'bulk' && available.length === 0) {
            window.alert(target.type === 'bulk' ? 'No additional locations are available for the selected products.' : 'No additional locations are available for this product.');
            return;
        }
        setLocationAssignmentTarget(target);
        setLocationAssignmentValue(available[0]?.id || '');
        setLocationAssignmentQty('');
        setLocationAssignmentSubLocation('');
    };

    const closeLocationAssignment = () => {
        setLocationAssignmentTarget(null);
        setLocationAssignmentValue('');
        setLocationAssignmentQty('');
        setLocationAssignmentSubLocation('');
    };

    const assignmentLocations = useMemo(() => {
        if (!locationAssignmentTarget) return [];
        return locationAssignmentTarget.type === 'bulk'
            ? getSelectableLocationsForBulk(locationAssignmentTarget.itemIds)
            : getSelectableLocationsForItem(locationAssignmentTarget.itemId, locationAssignmentTarget.visibleLocationIds, true);
    }, [locationAssignmentTarget, locations, filterLocations, stock, extraLocationsByItem]);

    const locationEditorItem = useMemo(() => {
        if (!locationAssignmentTarget || locationAssignmentTarget.type !== 'item') return null;
        return itemsById.get(locationAssignmentTarget.itemId) || null;
    }, [locationAssignmentTarget, itemsById]);

    const locationEditorDisplay = useMemo(() => {
        if (!locationEditorItem) return null;
        return getEditableRow(locationEditorItem);
    }, [locationEditorItem, editRows]);

    const itemLocationEditorEntries = useMemo<Array<{
        locationId: string;
        locationName: string;
        quantity: number;
        subLocationDetail: string;
        hasBaseline: boolean;
        isExtra: boolean;
    }>>(() => {
        if (!locationAssignmentTarget || locationAssignmentTarget.type !== 'item') return [];

        const itemId = locationAssignmentTarget.itemId;
        const extraLocationIds = new Set(extraLocationsByItem[itemId] || []);
        const locationOrderIndex = new Map(locations.map((loc, index) => [loc.id, index]));

        return getAllLocationIdsForItem(itemId)
            .map(locationId => {
                const key = `${itemId}|${locationId}`;
                const baseline = stockSnapshotByKey[key];
                const quantity = auditUpdates[key] !== undefined ? Number(auditUpdates[key]) || 0 : Number(baseline?.qty || 0);
                const subLocationDetail = (auditSubLocations[key] ?? baseline?.subLocationDetail ?? '').trim();

                return {
                    locationId,
                    locationName: getLocationDisplayName(locationId),
                    quantity,
                    subLocationDetail,
                    hasBaseline: Boolean(baseline),
                    isExtra: extraLocationIds.has(locationId),
                };
            })
            .filter(entry => entry.isExtra || entry.quantity > 0 || entry.subLocationDetail.length > 0)
            .sort((left, right) => {
                const leftIndex = locationOrderIndex.get(left.locationId);
                const rightIndex = locationOrderIndex.get(right.locationId);
                if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
                if (leftIndex !== undefined) return -1;
                if (rightIndex !== undefined) return 1;
                return left.locationName.localeCompare(right.locationName);
            });
    }, [locationAssignmentTarget, extraLocationsByItem, locations, stockSnapshotByKey, auditUpdates, auditSubLocations, stock, locationNameById]);

    const addLocationToItemEditor = () => {
        if (!locationAssignmentTarget || locationAssignmentTarget.type !== 'item' || !locationAssignmentValue) return;

        const itemId = locationAssignmentTarget.itemId;
        const key = `${itemId}|${locationAssignmentValue}`;
        const nextQty = locationAssignmentQty.trim() === '' ? 0 : Math.max(0, Number(locationAssignmentQty) || 0);
        const nextSubLocation = locationAssignmentSubLocation.trim();
        const currentLocationIds = getAllLocationIdsForItem(itemId);

        if (currentLocationIds.includes(locationAssignmentValue)) {
            window.alert('That location is already assigned to this product.');
            return;
        }

        pushHistory();
        setExtraLocationsByItem(prev => ({
            ...prev,
            [itemId]: Array.from(new Set([...(prev[itemId] || []), locationAssignmentValue])),
        }));
        setAuditUpdates(prev => ({ ...prev, [key]: nextQty }));
        setAuditSubLocations(prev => ({ ...prev, [key]: nextSubLocation }));

        const remainingLocations = getSelectableLocationsForItem(itemId, [...currentLocationIds, locationAssignmentValue], true)
            .filter(loc => loc.id !== locationAssignmentValue);

        setLocationAssignmentValue(remainingLocations[0]?.id || '');
        setLocationAssignmentQty('');
        setLocationAssignmentSubLocation('');
    };

    const removeLocationFromItemEditor = (itemId: string, locationId: string) => {
        const key = `${itemId}|${locationId}`;
        const hasBaseline = Boolean(stockSnapshotByKey[key]);

        pushHistory();

        setAuditUpdates(prev => {
            const next = { ...prev };
            if (hasBaseline) next[key] = 0;
            else delete next[key];
            return next;
        });

        setAuditSubLocations(prev => {
            const next = { ...prev };
            if (hasBaseline) next[key] = '';
            else delete next[key];
            return next;
        });

        setExtraLocationsByItem(prev => {
            const current = prev[itemId] || [];
            if (!current.includes(locationId)) return prev;

            const next = { ...prev };
            const remaining = current.filter(id => id !== locationId);
            if (remaining.length > 0) next[itemId] = remaining;
            else delete next[itemId];
            return next;
        });

        if (!locationAssignmentValue) {
            const remainingLocations = getSelectableLocationsForItem(itemId, getAllLocationIdsForItem(itemId).filter(id => id !== locationId), true);
            setLocationAssignmentValue(remainingLocations[0]?.id || '');
        }
    };

    const commitLocationAssignment = () => {
        if (!locationAssignmentTarget || !locationAssignmentValue) return;
        const qty = locationAssignmentQty.trim() === '' ? 0 : Math.max(0, Number(locationAssignmentQty) || 0);
        const targetItems = locationAssignmentTarget.type === 'bulk' ? locationAssignmentTarget.itemIds : [locationAssignmentTarget.itemId];
        const nextExtraLocations = { ...extraLocationsByItem };
        const touchedKeys: string[] = [];

        targetItems.forEach(itemId => {
            const activeLocationIds = getActiveLocationIdsForItem(
                itemId,
                locationAssignmentTarget.type === 'item' ? locationAssignmentTarget.visibleLocationIds : undefined,
            );
            if (activeLocationIds.has(locationAssignmentValue)) return;

            nextExtraLocations[itemId] = Array.from(new Set([...(nextExtraLocations[itemId] || []), locationAssignmentValue]));
            touchedKeys.push(`${itemId}|${locationAssignmentValue}`);
        });

        if (touchedKeys.length === 0) {
            window.alert('That location is already on all selected products.');
            closeLocationAssignment();
            return;
        }

        pushHistory();
        setExtraLocationsByItem(nextExtraLocations);
        setAuditUpdates(prev => ({
            ...prev,
            ...touchedKeys.reduce<Record<string, number>>((acc, key) => {
                acc[key] = qty;
                return acc;
            }, {}),
        }));
        setAuditSubLocations(prev => ({
            ...prev,
            ...touchedKeys.reduce<Record<string, string>>((acc, key) => {
                acc[key] = locationAssignmentSubLocation.trim();
                return acc;
            }, {}),
        }));

        if (locationAssignmentTarget.type === 'item') {
            setLocationAssignmentValue('');
            setLocationAssignmentQty('');
            setLocationAssignmentSubLocation('');
            return;
        }

        closeLocationAssignment();
    };

    const clearSubLocationValue = (key: string) => {
        updateAuditSubLocation(key, '');
        setEditingSubLocationCell(null);
    };

    const handleSort = (key: SortKey) => {
        setSortState(prev => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: key === 'totalQty' ? 'desc' : 'asc' };
        });
    };

    const renderSortHeader = (label: string, key: SortKey) => (
        <button
            type="button"
            onClick={() => handleSort(key)}
            className="inline-flex items-center gap-1.5 text-sm hover:text-gray-800 md:text-[15px]"
        >
            <span>{label}</span>
            <SortIcon className="w-3.5 h-3.5" direction={sortState.key === key ? sortState.direction : undefined} />
        </button>
    );

    const updateBulkMoveQty = (itemId: string, qty: number) => {
        pushHistory();
        setBulkMove(prev => ({
            ...prev,
            qtyMap: { ...prev.qtyMap, [itemId]: qty },
        }));
    };

    const updateBulkMoveQtyWithSelection = (itemId: string, qty: number, locationId: string) => {
        pushHistory();
        const nextQty = Number.isFinite(qty) ? Math.max(0, qty) : 0;

        setBulkMove(prev => ({
            ...prev,
            from: locationId,
            qtyMap: { ...prev.qtyMap, [itemId]: nextQty },
        }));

        setSelectedItemIds(prev => {
            const next = new Set(prev);
            if (nextQty > 0) next.add(itemId);
            else next.delete(itemId);
            return next;
        });
    };

    const updateAuditQty = (key: string, qty: number) => {
        pushHistory();
        setAuditUpdates(prev => ({ ...prev, [key]: qty }));
    };

    const updateAuditSubLocation = (key: string, subLocationDetail: string) => {
        pushHistory();
        setAuditSubLocations(prev => ({ ...prev, [key]: subLocationDetail }));
    };

    const openEditableCell = (item: InventoryItem, field: 'id' | 'description') => {
        if (!selectedItemIds.has(item.id)) {
            window.alert('Check the row before editing Product ID or Description.');
            return;
        }
        setActiveEditCell({ itemId: item.id, field });
    };

    const handleExecute = async () => {
        if (!effectiveDate) {
            window.alert('Please select an effective date.');
            return;
        }
        setIsProcessing(true);
        try {
            if (mode === 'ADD') {
                if (addInventoryMode === 'new') {
                    const payload = newItems.filter(item => item.id && item.description && item.category && item.locationId);
                    if (payload.length === 0) throw new Error('Please fill in required fields (ID, Desc, Cat, Loc) for at least one new inventory row.');
                    if (payload.some(item => item.source === 'PO' && Number(item.quantity) > 0 && !String(item.poNumber || '').trim())) {
                        throw new Error('PO number is required whenever source is PO.');
                    }
                    await onSave('ADD', { kind: 'new', rows: payload }, effectiveDate);
                } else {
                    const payload = existingInventoryRows.filter(row => row.itemId && row.locationId && Number(row.quantity) > 0);
                    if (payload.length === 0) throw new Error('Add at least one existing product row with a quantity and location.');
                    if (payload.some(row => row.source === 'PO' && !row.poNumber.trim())) {
                        throw new Error('PO number is required whenever source is PO.');
                    }
                    await onSave('ADD', { kind: 'existing', rows: payload }, effectiveDate);
                }
            } else if (mode === 'EDIT') {
                const hasItemChanges = stagedItemEdits.length > 0;
                const hasQtyChange = stagedAuditEntries.length > 0;
                if (!hasItemChanges && !hasQtyChange) {
                    throw new Error('No changes staged. Edit fields or update quantities by location.');
                }
                if (hasItemChanges) {
                    await onSave('EDIT', { itemChanges: stagedItemEdits }, effectiveDate);
                }
                if (hasQtyChange) {
                    await onSave('AUDIT', stagedAuditEntries, effectiveDate);
                }
            } else if (mode === 'AUDIT') {
                if (stagedAuditEntries.length === 0) throw new Error('No quantities changed.');
                await onSave('AUDIT', stagedAuditEntries, effectiveDate);
            } else if (mode === 'MOVE') {
                if (invalidMoveRoutes.length > 0) throw new Error('Some move rows are missing source/destination or have the same source and destination.');
                if (stagedTransfers.length === 0) throw new Error('No valid transfers.');
                await onSave('MOVE', stagedTransfers, effectiveDate);
            }
            onClose();
        } catch (err: any) {
            window.alert(err.message || 'Inventory update failed.');
        } finally {
            setIsProcessing(false);
        }
    };

    const renderNewInventoryMode = () => (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                    <thead className="bg-gray-100 font-black uppercase text-gray-500">
                        <tr>
                            <th className="p-2 w-32">ID <span className="text-red-500">*</span></th>
                            <th className="p-2">Description <span className="text-red-500">*</span></th>
                            <th className="p-2 w-24">Qty <span className="text-red-500">*</span></th>
                            <th className="p-2 w-32">Category <span className="text-red-500">*</span></th>
                            <th className="p-2 w-32">Location <span className="text-red-500">*</span></th>
                            <th className="p-2 w-24">Source</th>
                            <th className="p-2 w-36">PO Number</th>
                            <th className="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {newItems.map((item, idx) => (
                            <tr key={idx}>
                                <td className="p-1">
                                    <input className="form-control text-xs uppercase" value={item.id} onChange={e => updateNewItem(idx, 'id', e.target.value)} placeholder="SKU" />
                                </td>
                                <td className="p-1">
                                    <input className="form-control text-xs uppercase" value={item.description} onChange={e => updateNewItem(idx, 'description', e.target.value)} placeholder="DESC" />
                                </td>
                                <td className="p-1">
                                    <input type="number" className="form-control text-xs text-center" value={item.quantity} onChange={e => updateNewItem(idx, 'quantity', Number(e.target.value) || 0)} />
                                </td>
                                <td className="p-1">
                                    <select className="form-control text-xs uppercase" value={item.category} onChange={e => updateNewItem(idx, 'category', e.target.value)}>
                                        <option value="">Cat...</option>
                                        {activeCategories.map(cat => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-1">
                                    <select className="form-control text-xs uppercase" value={item.locationId} onChange={e => updateNewItem(idx, 'locationId', e.target.value)}>
                                        <option value="">Loc...</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                                {loc.name}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                                <td className="p-1">
                                    <select className="form-control text-xs uppercase" value={item.source} onChange={e => updateNewItem(idx, 'source', e.target.value)}>
                                        <option value="OH">OH</option>
                                        <option value="PO">PO</option>
                                    </select>
                                </td>
                                <td className="p-1">
                                    {item.source === 'PO' ? (
                                        <button
                                            type="button"
                                            onClick={() => openPurchaseOrderModal({ kind: 'new', index: idx })}
                                            className={`flex min-h-[38px] w-full items-center rounded-lg border px-3 py-2 text-left text-xs font-black uppercase transition-colors ${item.poNumber ? 'border-gray-300 bg-white text-gray-800 hover:border-em-red hover:text-em-red' : 'border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                                        >
                                            <span className="truncate">{item.poNumber || 'Select PO'}</span>
                                        </button>
                                    ) : (
                                        <div className="flex min-h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-[10px] font-black uppercase tracking-wide text-gray-400">
                                            OH only
                                        </div>
                                    )}
                                </td>
                                <td className="p-1 text-center">
                                    <button onClick={() => handleRemoveNewRow(idx)} className="text-red-400 hover:text-red-600">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button onClick={handleAddNewRow} className="mt-4 flex items-center gap-2 text-xs font-bold text-em-red uppercase hover:underline">
                <PlusIcon className="w-4 h-4" /> Add Row
            </button>
        </div>
    );

    const renderExistingInventoryMode = () => (
        <div className="grid gap-4 xl:grid-cols-[340px,minmax(0,1fr)]">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Receive By PO</div>
                    <div className="mt-1 text-xs font-medium text-gray-600">Manual PO entry stays available if scanner or barcode lookup is down.</div>
                    <div className="mt-2 flex gap-2">
                        <input
                            className="form-control text-sm uppercase"
                            value={existingInventoryPoSearch}
                            onChange={e => setExistingInventoryPoSearch(e.target.value)}
                            onKeyDown={e => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                handleExistingInventoryPurchaseOrderLoad(existingInventoryPoSearch);
                            }}
                            placeholder="Manual PO number"
                        />
                        <button
                            type="button"
                            onClick={() => handleExistingInventoryPurchaseOrderLoad(existingInventoryPoSearch)}
                            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-black uppercase text-gray-700 transition-colors hover:border-em-red hover:text-em-red"
                        >
                            Load PO
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={() => openPurchaseOrderModal({ kind: 'existing-receive', poNumber: existingInventoryPoSearch })}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-black uppercase text-gray-700 transition-colors hover:border-em-red hover:text-em-red"
                    >
                        Browse Saved POs
                    </button>
                </div>

                <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Find Existing Products</div>
                <div className="mt-2 text-sm font-medium text-gray-600">Search by SKU, barcode, description, or category, then add matching products to the staging list.</div>
                <div className="mt-4 flex gap-2">
                    <input
                        className="form-control text-sm uppercase"
                        value={existingInventorySearch}
                        onChange={e => setExistingInventorySearch(e.target.value)}
                        onKeyDown={e => {
                            if (e.key !== 'Enter') return;
                            const lookup = resolveExistingInventoryLookup(existingInventorySearch);
                            if (!lookup) return;
                            e.preventDefault();
                            addExistingInventoryRow(lookup.item, lookup.seed);
                        }}
                        placeholder="Search or scan barcode..."
                    />
                    <button
                        type="button"
                        onClick={() => setExistingInventoryScannerOpen(true)}
                        className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-black uppercase text-gray-700 transition-colors hover:border-em-red hover:text-em-red"
                    >
                        Scan
                    </button>
                </div>

                {!existingInventorySearch.trim() ? (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
                        Start typing or scan a barcode to find products already in the database.
                    </div>
                ) : existingInventoryResults.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
                        No matches found. Use <span className="font-black uppercase text-gray-700">New Inventory</span> for brand new products.
                    </div>
                ) : (
                    <div className="mt-4 max-h-[480px] space-y-2 overflow-y-auto pr-1">
                        {existingInventoryResults.map(item => {
                            const stockSummary = stockSummaryByItem[item.id];
                            const barcodeValues = locationBarcodesByItem.get(item.id) || [];
                            return (
                                <button
                                    key={`existing-result-${item.id}`}
                                    type="button"
                                    onClick={() => addExistingInventoryRow(item)}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-em-red hover:bg-red-50"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-black uppercase text-gray-900">{item.id}</div>
                                            <div className="mt-1 truncate text-xs font-semibold uppercase text-gray-600">{item.description || 'No description'}</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-600">{item.category || 'UNASSIGNED'}</span>
                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">{stockSummary?.totalQty || 0} On Hand</span>
                                                {barcodeValues.length > 0 && (
                                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-700">Barcode Ready</span>
                                                )}
                                            </div>
                                            {stockSummary?.locations?.length ? (
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                                    {stockSummary.locations.slice(0, 3).join(' · ')}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">No stock assigned yet</div>
                                            )}
                                            {barcodeValues.length > 0 && (
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                                                    {barcodeValues.slice(0, 2).join(' · ')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="shrink-0 rounded-full bg-em-red/10 p-2 text-em-red">
                                            <PlusIcon className="w-4 h-4" />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Staged Existing Inventory</div>
                        <div className="mt-1 text-sm font-medium text-gray-600">Add quantity and location only for products that already exist in inventory.</div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black uppercase text-gray-700">
                        {existingInventoryRows.length} Row{existingInventoryRows.length === 1 ? '' : 's'}
                    </span>
                </div>

                {existingInventoryRows.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm font-medium text-gray-500">
                        Search and add products from the left panel to stage inventory updates.
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {existingInventoryRows.map((row, index) => {
                            const item = itemsById.get(row.itemId);
                            const stockSummary = stockSummaryByItem[row.itemId];

                            if (!item) return null;

                            return (
                                <div key={row.rowId} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-black uppercase text-gray-900">{item.id}</div>
                                            <div className="mt-1 truncate text-[13px] font-semibold uppercase text-blue-900">{item.description || 'No description'}</div>
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-gray-600 border border-gray-200">{item.category || 'UNASSIGNED'}</span>
                                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">{stockSummary?.totalQty || 0} Current Qty</span>
                                            </div>
                                            {stockSummary?.locations?.length ? (
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                                                    {stockSummary.locations.slice(0, 4).join(' · ')}
                                                </div>
                                            ) : (
                                                <div className="mt-2 text-[10px] font-bold uppercase tracking-wide text-gray-400">No existing location assigned</div>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => removeExistingInventoryRow(row.rowId)} className="rounded-lg bg-white p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => applyLastLocationToExistingRow(row.rowId)}
                                            disabled={!lastExistingInventoryDefaults?.locationId}
                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-gray-700 transition-colors hover:border-em-red hover:text-em-red disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Use Last Location
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => repeatPreviousExistingRow(row.rowId)}
                                            disabled={index === 0}
                                            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-[11px] font-black uppercase text-gray-700 transition-colors hover:border-em-red hover:text-em-red disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            Repeat Previous Row
                                        </button>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                        <div>
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Qty To Add <span className="text-red-500">*</span></div>
                                            <input
                                                type="number"
                                                className="form-control text-sm font-black text-right"
                                                value={row.quantity}
                                                onChange={e => updateExistingInventoryRow(row.rowId, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Location <span className="text-red-500">*</span></div>
                                            <select className="form-control text-xs uppercase" value={row.locationId} onChange={e => updateExistingInventoryRow(row.rowId, { locationId: e.target.value })}>
                                                <option value="">Select location...</option>
                                                {locations.map(loc => (
                                                    <option key={`${row.rowId}-${loc.id}`} value={loc.id}>
                                                        {loc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Source</div>
                                            <select className="form-control text-xs uppercase" value={row.source} onChange={e => updateExistingInventoryRow(row.rowId, { source: e.target.value as 'OH' | 'PO' })}>
                                                <option value="OH">OH</option>
                                                <option value="PO">PO</option>
                                            </select>
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                                PO Number {row.source === 'PO' && <span className="text-red-500">*</span>}
                                            </div>
                                            {row.source === 'PO' ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openPurchaseOrderModal({ kind: 'existing', rowId: row.rowId })}
                                                    className={`flex min-h-[40px] w-full items-center rounded-lg border px-3 py-2 text-left text-xs font-black uppercase transition-colors ${row.poNumber ? 'border-gray-300 bg-white text-gray-800 hover:border-em-red hover:text-em-red' : 'border-dashed border-amber-400 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
                                                >
                                                    <span className="truncate">{row.poNumber || 'Select PO'}</span>
                                                </button>
                                            ) : (
                                                <div className="flex min-h-[40px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-[10px] font-black uppercase tracking-wide text-gray-400">
                                                    OH only
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                            <input
                                                className="form-control text-xs uppercase"
                                                value={row.subLocationDetail}
                                                onChange={e => updateExistingInventoryRow(row.rowId, { subLocationDetail: e.target.value })}
                                                placeholder="Shelf / Bin / Rack"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    const renderAddMode = () => (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Add Inventory Flow</div>
                    <div className="mt-1 text-sm font-medium text-gray-600">
                        Use <span className="font-black uppercase text-gray-800">New Inventory</span> for brand new products, or <span className="font-black uppercase text-gray-800">Existing Inventory</span> to add stock to products already in the database.
                    </div>
                </div>
                <div className="inline-flex rounded-xl bg-gray-100 p-1">
                    <button
                        type="button"
                        onClick={() => setAddInventoryMode('new')}
                        className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${addInventoryMode === 'new' ? 'bg-white text-em-red shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        New Inventory
                    </button>
                    <button
                        type="button"
                        onClick={() => setAddInventoryMode('existing')}
                        className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide transition-colors ${addInventoryMode === 'existing' ? 'bg-white text-em-red shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                        Existing Inventory
                    </button>
                </div>
            </div>

            {addInventoryMode === 'new' ? renderNewInventoryMode() : renderExistingInventoryMode()}
        </div>
    );

    const renderActionPanel = () => {
        if (mode === 'ADD') return null;
        if (mode === 'EDIT') return null;
        if (isMobile) return null;
        return (
            <div className="bg-gray-50 border-t border-gray-200 p-4 shrink-0">
                <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        {mode === 'AUDIT' ? 'Update Quantities' : 'Transfer Configuration'}
                    </h3>
                    <div className="h-px bg-gray-200 flex-grow"></div>
                </div>
                {mode === 'AUDIT' && (
                    <div className="text-xs text-gray-500 font-medium italic">
                        Adjust quantities directly in the table rows. <span className="ml-2 not-italic font-bold text-em-red">{Object.keys(auditUpdates).length} updates pending.</span>
                    </div>
                )}
                {mode === 'MOVE' && (
                    <div className="text-xs text-gray-500 italic">
                        Set source, destination, and transfer quantity per item row in the table below.
                    </div>
                )}
            </div>
        );
    };

    const renderEditMobileCards = () => (
        <div className="md:hidden flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-2 space-y-3">
            {mobileLocationSections.length === 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                    <div className="text-sm font-black text-gray-900 uppercase">No Products In View</div>
                    <div className="mt-1 text-xs text-gray-500">Try clearing filters or search to show all products.</div>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('');
                            setFilterCategories(new Set());
                            setFilterLocations(new Set());
                        }}
                        className="mt-3 px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-xs font-bold uppercase text-gray-700"
                    >
                        Clear Filters
                    </button>
                </div>
            )}

            {mobileLocationSections.map(section => {
                const sectionItemIds = Array.from(new Set(section.entries.map(entry => entry.item.id)));
                const allSelected = sectionItemIds.length > 0 && sectionItemIds.every(itemId => selectedItemIds.has(itemId));

                return (
                    <div key={section.locationId} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Location</div>
                                <div className="text-sm font-black uppercase text-gray-900">{section.locationName}</div>
                                <div className="text-[11px] font-medium text-gray-500">{section.entries.length} product{section.entries.length === 1 ? '' : 's'}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    toggleSelectionForLocation(section.locationId, !allSelected);
                                }}
                                className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-gray-700"
                            >
                                {allSelected ? 'Clear Select' : 'Select All'}
                            </button>
                        </div>

                        <div className="space-y-2">
                            {section.entries.map(({ item, quantity, subLocationDetail }) => {
                                const key = `${item.id}|${section.locationId}`;
                                const isSelected = selectedItemIds.has(item.id);
                                const subLocationValue = auditSubLocations[key] ?? subLocationDetail;
                                const editable = getEditableRow(item);
                                const allLocationIds = getAllLocationIdsForItem(item.id);
                                const locationSummary = allLocationIds.map(locationId => getLocationDisplayName(locationId)).join(' / ');

                                return (
                                    <div key={key} className={`rounded-lg border p-3 space-y-3 ${isSelected ? 'border-em-red bg-red-50/40 shadow-sm' : 'border-gray-200 bg-gray-50/70'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="inline-flex max-w-full items-center rounded-md bg-red-100 px-2.5 py-1 text-sm font-black uppercase text-em-red truncate">{item.id}</div>
                                                <div className="mt-1.5 text-[15px] font-black uppercase text-blue-900 truncate tracking-tight">{item.description || '-'}</div>
                                                <div className={`mt-1.5 inline-flex max-w-full items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase truncate ${editable.category ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                                                    {editable.category || 'UNASSIGNED'}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Qty @ Location</div>
                                                <div className="text-2xl font-black text-gray-900 leading-none mt-1">{auditUpdates[key] ?? quantity}</div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => openCategoryPicker({ type: 'item', itemId: item.id }, item)}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-300"
                                        >
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Category</div>
                                            <div className={`mt-1 text-sm font-black uppercase ${editable.category ? 'text-gray-900' : 'text-red-600'}`}>{editable.category || 'UNASSIGNED'}</div>
                                            {editable.subCategory && <div className="text-[11px] font-medium uppercase text-gray-500">{editable.subCategory}</div>}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => openLocationAssignment({ type: 'item', itemId: item.id, visibleLocationIds: allLocationIds })}
                                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-gray-300"
                                        >
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Locations</div>
                                            <div className="mt-1 text-sm font-black uppercase text-gray-900">{locationSummary || 'Add Location'}</div>
                                            {subLocationValue && <div className="text-[11px] font-medium uppercase text-gray-500">{subLocationValue}</div>}
                                        </button>

                                        <div>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Qty @ Location</div>
                                                <input
                                                    type="number"
                                                    className="form-control w-full text-xs text-right font-black"
                                                    value={auditUpdates[key] ?? quantity}
                                                    onChange={e => updateAuditQty(key, Number(e.target.value))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                            {editingSubLocationCell === key ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        className="form-control w-full text-xs"
                                                        autoFocus
                                                        value={subLocationValue}
                                                        onChange={e => updateAuditSubLocation(key, e.target.value)}
                                                        onBlur={() => setEditingSubLocationCell(null)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' || e.key === 'Escape') setEditingSubLocationCell(null);
                                                        }}
                                                        placeholder="Shelf / Bin / Rack"
                                                    />
                                                    <button
                                                        type="button"
                                                        onMouseDown={e => e.preventDefault()}
                                                        onClick={() => clearSubLocationValue(key)}
                                                        className="rounded border border-gray-200 bg-white p-2 text-gray-400 hover:text-red-600"
                                                        title="Remove sub-location"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingSubLocationCell(key)}
                                                    className={`w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold hover:border-gray-300 ${subLocationValue ? 'text-gray-600' : 'text-green-600'}`}
                                                >
                                                    {subLocationValue ? subLocationValue : <PlusIcon className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );

    const renderTable = () => (
        <>
        {mode === 'EDIT' && renderEditMobileCards()}
        <div className={`${mode === 'EDIT' ? 'hidden md:block' : ''} flex-1 overflow-auto bg-gray-50 p-2 md:p-4`}>
            <table className="w-full min-w-[940px] table-fixed text-xs text-left bg-white rounded-lg shadow-sm overflow-hidden">
                <thead className="bg-gray-100 font-black uppercase text-gray-500 sticky top-0 z-10">
                    <tr>
                        <th className="px-2 py-2.5 w-8 text-center">
                            <input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={sortedFilteredItems.length > 0 && selectedItemIds.size === sortedFilteredItems.length} />
                        </th>
                        <th className="px-2 py-2.5 w-[150px]">{renderSortHeader('Item Code', 'id')}</th>
                        <th className="px-2 py-2.5 w-[280px]">{renderSortHeader('Description', 'description')}</th>
                        <th className="px-2 py-2.5 w-[170px]">{renderSortHeader('Category', 'category')}</th>
                        <th className="px-2 py-2.5 w-[220px]"><span className="text-sm md:text-[15px]">Locations</span></th>
                        {mode === 'EDIT' && <th className="px-2 py-2.5 w-[88px] text-center">{renderSortHeader('Total Qty', 'totalQty')}</th>}
                        {mode === 'EDIT' && <th className="px-2 py-2.5 w-[68px] text-center"><span className="sr-only">Item Edit</span></th>}
                        {mode === 'MOVE' && <th className="px-2 py-2.5 text-right w-[320px]">Move Routing</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {sortedFilteredItems.map(item => {
                        const itemStock = stock.filter(s => s.itemId === item.id);
                        const filteredStock = filterLocations.size > 0 ? itemStock.filter(s => filterLocations.has(s.locationId)) : itemStock;
                        const stockByLocation = filteredStock.reduce<Record<string, { quantity: number; subLocationDetail: string }>>((acc, entry) => {
                            if (!acc[entry.locationId]) {
                                acc[entry.locationId] = { quantity: 0, subLocationDetail: entry.subLocationDetail || '' };
                            }
                            acc[entry.locationId].quantity += entry.quantity;
                            if (!acc[entry.locationId].subLocationDetail && entry.subLocationDetail) {
                                acc[entry.locationId].subLocationDetail = entry.subLocationDetail;
                            }
                            return acc;
                        }, {});
                        (extraLocationsByItem[item.id] || []).forEach(locationId => {
                            if (filterLocations.size > 0 && !filterLocations.has(locationId)) return;
                            if (!stockByLocation[locationId]) {
                                const key = `${item.id}|${locationId}`;
                                stockByLocation[locationId] = {
                                    quantity: auditUpdates[key] ?? 0,
                                    subLocationDetail: auditSubLocations[key] ?? '',
                                };
                            }
                        });
                        const locationRows = Object.entries(stockByLocation).sort((a, b) => {
                            const aIndex = locations.findIndex(loc => loc.id === a[0]);
                            const bIndex = locations.findIndex(loc => loc.id === b[0]);
                            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                            if (aIndex !== -1) return -1;
                            if (bIndex !== -1) return 1;
                            return a[0].localeCompare(b[0]);
                        });
                        const visibleLocationIds = locationRows.map(([locationId]) => locationId);
                        const allLocationIds = getAllLocationIdsForItem(item.id);
                        const totalQty = visibleTotalQtyByItem[item.id] ?? locationRows.reduce((sum, [locationId, stockInfo]) => sum + (auditUpdates[`${item.id}|${locationId}`] ?? stockInfo.quantity), 0);
                        const rowMove = moveRoutes[item.id] || { from: '', to: '', qty: 0 };
                        const editable = getEditableRow(item);
                        const isSelected = selectedItemIds.has(item.id);
                        const isStaged = stagedItemEditIds.has(item.id) || stagedAuditItemIds.has(item.id) || stagedBulkMoveItemIds.has(item.id);
                        return (
                            <tr key={item.id} className={`${isSelected ? 'bg-red-50' : isStaged ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
                                <td className="px-2 py-2 align-top">
                                    <div className="text-center">
                                        <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleSelection(item.id)} />
                                    </div>
                                </td>
                                <td className="px-2 py-2 align-top">
                                    {mode === 'EDIT' ? (
                                        activeEditCell?.itemId === item.id && activeEditCell.field === 'id' ? (
                                            <input
                                                className="form-control text-sm font-bold uppercase"
                                                autoFocus
                                                disabled={!isSelected}
                                                value={editable.id}
                                                onChange={e => updateEditRow(item, { id: e.target.value.toUpperCase() })}
                                                onBlur={() => setActiveEditCell(null)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' || e.key === 'Escape') setActiveEditCell(null);
                                                }}
                                            />
                                        ) : (
                                            <button className={`w-full text-left py-1 text-sm font-black uppercase ${isSelected ? 'text-gray-900 hover:text-em-red' : 'text-gray-400 cursor-not-allowed'}`} onClick={() => openEditableCell(item, 'id')}>
                                                <span className="inline-block truncate max-w-[150px]">{editable.id}</span>
                                            </button>
                                        )
                                    ) : (
                                        <div className="text-sm font-black text-gray-900">{item.id}</div>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top">
                                    {mode === 'EDIT' ? (
                                        activeEditCell?.itemId === item.id && activeEditCell.field === 'description' ? (
                                            <input
                                                className="form-control text-[15px] font-semibold uppercase"
                                                autoFocus
                                                disabled={!isSelected}
                                                value={editable.description}
                                                onChange={e => updateEditRow(item, { description: e.target.value })}
                                                onBlur={() => setActiveEditCell(null)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' || e.key === 'Escape') setActiveEditCell(null);
                                                }}
                                            />
                                        ) : (
                                            <button className={`w-full text-left py-1 text-[15px] font-semibold uppercase ${isSelected ? 'text-gray-800 hover:text-em-red' : 'text-gray-400 cursor-not-allowed'}`} onClick={() => openEditableCell(item, 'description')}>
                                                <span className="inline-block truncate max-w-[260px]">{editable.description || '-'}</span>
                                            </button>
                                        )
                                    ) : (
                                        <div className="text-[15px] font-semibold text-gray-700 truncate max-w-[240px]">{item.description}</div>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top text-sm font-semibold text-gray-700">
                                    {mode === 'EDIT' ? (
                                        <button
                                            type="button"
                                            onClick={() => openCategoryPicker({ type: 'item', itemId: item.id }, item)}
                                            className="w-full text-left py-1 hover:text-em-red"
                                        >
                                            <div className={`text-sm font-semibold uppercase ${editable.category ? 'text-gray-800' : 'text-red-600'}`}>{editable.category || 'UNASSIGNED'}</div>
                                            {editable.subCategory && <div className="text-[11px] font-medium uppercase text-gray-500">{editable.subCategory}</div>}
                                        </button>
                                    ) : (
                                        <span className={`text-sm font-semibold uppercase ${item.category ? 'text-gray-700' : 'text-red-600'}`}>{item.category || 'UNASSIGNED'}</span>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top">
                                    <div className="flex flex-wrap items-start gap-1.5">
                                        {mode === 'EDIT' ? (
                                            visibleLocationIds.length > 0 ? (
                                                visibleLocationIds.map(locationId => {
                                                    const stockInfo = stockByLocation[locationId];
                                                    const key = `${item.id}|${locationId}`;
                                                    const quantity = auditUpdates[key] ?? stockInfo.quantity;
                                                    const subLocationValue = (auditSubLocations[key] ?? stockInfo.subLocationDetail ?? '').trim();
                                                    const buttonTitle = [getLocationDisplayName(locationId), subLocationValue || null, `Qty ${quantity}`]
                                                        .filter(Boolean)
                                                        .join(' / ');

                                                    return (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => openLocationAssignment({ type: 'item', itemId: item.id, visibleLocationIds: allLocationIds })}
                                                            className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-black uppercase text-gray-700 transition-colors hover:border-emerald-600 hover:text-emerald-700"
                                                            title={buttonTitle}
                                                        >
                                                            {getLocationDisplayName(locationId)}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => openLocationAssignment({ type: 'item', itemId: item.id, visibleLocationIds: allLocationIds })}
                                                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-400 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase text-emerald-700 transition-colors hover:bg-emerald-100"
                                                >
                                                    <PlusIcon className="w-3.5 h-3.5" />
                                                    Add Location
                                                </button>
                                            )
                                        ) : (
                                            locationRows.map(([locationId, stockInfo]) => {
                                                const key = `${item.id}|${locationId}`;
                                                const quantity = auditUpdates[key] ?? stockInfo.quantity;
                                                return (
                                                    <div key={key} className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                                        <span className="font-bold text-gray-700">{locationId}:</span>
                                                        <span className="font-mono">{quantity}</span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </td>
                                {mode === 'EDIT' && <td className="px-2 py-2 align-top whitespace-nowrap text-center text-base font-black text-em-red md:text-lg">{totalQty}</td>}
                                {mode === 'MOVE' && (
                                    <td className="px-2 py-2 align-top text-right">
                                        <div className="grid grid-cols-3 gap-2">
                                            <select
                                                className="form-control text-xs"
                                                value={rowMove.from}
                                                onChange={e => updateMoveRoute(item.id, { from: e.target.value })}
                                            >
                                                <option value="">From...</option>
                                                {locationRows.map(([locationId]) => (
                                                    <option key={`${item.id}-from-${locationId}`} value={locationId}>
                                                        {locationId}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                className="form-control text-xs"
                                                value={rowMove.to}
                                                onChange={e => updateMoveRoute(item.id, { to: e.target.value })}
                                            >
                                                <option value="">To...</option>
                                                {locations
                                                    .filter(loc => loc.id !== rowMove.from)
                                                    .map(loc => (
                                                        <option key={`${item.id}-to-${loc.id}`} value={loc.id}>
                                                            {loc.name}
                                                        </option>
                                                    ))}
                                            </select>
                                            <input
                                                type="number"
                                                className="form-control text-xs text-right"
                                                value={rowMove.qty}
                                                onChange={e => updateMoveRoute(item.id, { qty: Number(e.target.value) || 0 })}
                                            />
                                        </div>
                                    </td>
                                )}
                                {mode === 'EDIT' && (
                                    <td className="px-2 py-2 align-top text-center">
                                        <button onClick={() => onOpenItemDetails?.(item)} className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-em-red" title="Open full item details">
                                            <PencilSquareIcon className="w-5 h-5" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-3 md:p-4">
            <div className="relative bg-white rounded-lg md:rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] md:h-[90vh] flex flex-col overflow-hidden animate-fade-in-down">
                {isMobile && (mode === 'MOVE' || mode === 'AUDIT') && (
                    <button
                        onClick={onClose}
                        className="md:hidden absolute top-3 right-3 z-20 bg-white text-gray-600 p-2 rounded-lg border border-gray-200 shadow-sm"
                        aria-label="Close inventory management"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                )}
                <div className="flex flex-col gap-2 md:flex-row md:justify-between md:items-center p-3 md:p-6 border-b border-gray-100 bg-white">
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Inventory Management</h2>
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Effective Date:</span>
                            <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-900 focus:outline-none uppercase" />
                        </div>
                        <button onClick={onClose} className="bg-gray-100 text-gray-600 p-2 rounded-lg hover:bg-gray-200 transition-colors">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
                <div className="flex bg-gray-50 border-b border-gray-200 px-2 md:px-6 gap-1 md:space-x-1 overflow-x-auto">
                    {(['ADD', 'EDIT'] as Mode[]).map(value => (
                        <button key={value} onClick={() => setMode(value)} className={`px-3 md:px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${mode === value ? 'border-em-red text-em-red bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                            {value} Inventory
                        </button>
                    ))}
                </div>
                {mode !== 'ADD' && (
                    <div className="p-4 bg-white border-b border-gray-100">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <div className="relative flex-grow hidden md:block">
                                <input className="w-full pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-bold uppercase focus:ring-1 focus:ring-em-red focus:outline-none" placeholder={isMobile ? 'Search products or location...' : 'Search products...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="hidden md:flex items-center gap-2 overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={handleUndo}
                                    disabled={undoStack.length === 0 || mode === 'ADD'}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs font-black uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                                    title="Undo"
                                >
                                    <UndoIcon className="w-4 h-4" /> Undo
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRedo}
                                    disabled={redoStack.length === 0 || mode === 'ADD'}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-600 text-xs font-black uppercase disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                                    title="Redo"
                                >
                                    <RedoIcon className="w-4 h-4" /> Redo
                                </button>
                                <button onClick={() => setFilterOpen(true)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-black uppercase transition-colors ${filterCategories.size + filterLocations.size > 0 ? 'bg-em-red text-white border-em-red' : 'bg-white text-gray-600 border-gray-300'}`}>
                                    <FilterIcon className="w-4 h-4" /> Filters ({filterCategories.size + filterLocations.size})
                                </button>
                                {onOpenBarcodeGenerator && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenBarcodeGenerator(Array.from(selectedItemIds))}
                                        className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-black uppercase text-amber-800 transition-colors hover:bg-amber-100"
                                        title={selectedItemIds.size > 0 ? `Print labels for ${selectedItemIds.size} selected products` : 'Open barcode batching hub'}
                                    >
                                        <BarcodeIcon className="w-4 h-4" />
                                        {selectedItemIds.size > 0 ? `Print Barcodes (${selectedItemIds.size})` : 'Print Barcodes'}
                                    </button>
                                )}
                            </div>
                        {isMobile && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Edit Tools</div>
                                <div className="flex items-center gap-2">
                                    <input
                                        className="flex-1 min-w-0 pl-3 pr-3 py-2 border border-gray-300 rounded-lg text-xs font-bold uppercase focus:ring-1 focus:ring-em-red focus:outline-none"
                                        placeholder="Search products or location..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    <button onClick={() => setFilterOpen(true)} className={`relative h-10 w-10 rounded-lg border transition-colors flex items-center justify-center shrink-0 ${filterCategories.size + filterLocations.size > 0 ? 'bg-em-red text-white border-em-red' : 'bg-white text-gray-600 border-gray-300'}`}>
                                        <FilterIcon className="w-4 h-4" />
                                        {filterCategories.size + filterLocations.size > 0 && (
                                            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-black text-white text-[10px] font-black leading-4">
                                                {filterCategories.size + filterLocations.size}
                                            </span>
                                        )}
                                    </button>
                                </div>
                                {onOpenBarcodeGenerator && (
                                    <button
                                        type="button"
                                        onClick={() => onOpenBarcodeGenerator(Array.from(selectedItemIds))}
                                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-center text-sm font-black uppercase tracking-wide text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
                                    >
                                        <BarcodeIcon className="w-4 h-4" />
                                        {selectedItemIds.size > 0 ? `Print Barcodes (${selectedItemIds.size})` : 'Print Barcodes'}
                                    </button>
                                )}
                                {mode === 'EDIT' && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => openCategoryPicker({ type: 'bulk' })}
                                            className="w-full rounded-lg border border-em-red bg-em-red px-3 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-red-700"
                                            title={bulkCategory ? `${bulkCategory}${bulkSubCategory ? ` / ${bulkSubCategory}` : ''}` : 'Assign category'}
                                        >
                                            Assign Category
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openLocationAssignment({ type: 'bulk', itemIds: Array.from(selectedItemIds) })}
                                            className="w-full rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-700"
                                            title="Assign location"
                                        >
                                            Assign Location
                                        </button>
                                    </div>
                                )}
                                <div className="text-[11px] font-bold text-gray-600">{selectedItemIds.size} selected · {stagedItemEdits.length} item edits · {stagedAuditEntries.length} qty updates</div>
                            </div>
                        )}
                        </div>
                        {mode === 'EDIT' && (
                            <div className="mt-3 hidden md:flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">Item edits {stagedItemEdits.length}</span>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">Qty updates {stagedAuditEntries.length}</span>
                                    <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">Selected {selectedItemIds.size}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openCategoryPicker({ type: 'bulk' })}
                                        className="rounded-lg border border-em-red bg-em-red px-5 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-red-700"
                                        title={bulkCategory ? `${bulkCategory}${bulkSubCategory ? ` / ${bulkSubCategory}` : ''}` : 'Assign category'}
                                    >
                                        Assign Category
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openLocationAssignment({ type: 'bulk', itemIds: Array.from(selectedItemIds) })}
                                        className="rounded-lg border border-emerald-600 bg-emerald-600 px-5 py-3 text-center text-sm font-black uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-emerald-700"
                                        title="Assign location"
                                    >
                                        Assign Location
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {mode === 'ADD' ? renderAddMode() : renderTable()}
                {renderActionPanel()}
                <div className="flex items-center justify-end gap-3 p-4 md:p-6 border-t border-gray-200 bg-white">
                    <button onClick={onClose} className="px-6 py-3 text-xs font-black uppercase bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleExecute} disabled={isProcessing} className="px-6 py-3 text-xs font-black uppercase bg-em-red text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                        {isProcessing ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
            <LegacyFilterModal
                isOpen={filterOpen}
                onClose={() => setFilterOpen(false)}
                onApply={({ categories, locations: locs }) => {
                    setFilterCategories(new Set(categories));
                    setFilterLocations(new Set(locs));
                }}
                onClear={() => {
                    setFilterCategories(new Set());
                    setFilterLocations(new Set());
                }}
                locations={locations}
                categoryHierarchy={categoryHierarchy}
                currentCategories={filterCategories}
                currentLocations={filterLocations}
            />
            <BarcodeScannerModal
                isOpen={isExistingInventoryScannerOpen}
                onClose={() => setExistingInventoryScannerOpen(false)}
                onScan={handleExistingInventoryScan}
                zIndexClassName="z-[130]"
            />
            {categoryPickerTarget && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={closeCategoryPicker}>
                    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">
                                    {categoryPickerTarget.type === 'bulk' ? 'Assign Category' : 'Edit Category'}
                                </h3>
                                <p className="mt-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    {categoryPickerTarget.type === 'bulk'
                                        ? `${selectedItemIds.size} selected product${selectedItemIds.size === 1 ? '' : 's'}`
                                        : 'Choose main category and sub-category in one place'}
                                </p>
                            </div>
                            <button onClick={closeCategoryPicker} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="grid gap-4 bg-gray-50 p-4 md:grid-cols-2">
                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Main Category</div>
                                <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                                    {activeCategories.map(cat => {
                                        const isSelected = categoryPickerCategory === cat;
                                        return (
                                            <button
                                                key={`picker-main-${cat}`}
                                                type="button"
                                                onClick={() => handleCategoryPickerCategoryChange(cat)}
                                                className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-black uppercase transition-colors ${isSelected ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                                            >
                                                {cat}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-white p-4">
                                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Category</div>
                                {!categoryPickerCategory ? (
                                    <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 text-center text-sm font-medium text-gray-500">
                                        Select a main category first.
                                    </div>
                                ) : (
                                    <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                                        <button
                                            type="button"
                                            onClick={() => setCategoryPickerSubCategory('')}
                                            className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-black uppercase transition-colors ${categoryPickerSubCategory === '' ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                                        >
                                            No Sub-Category
                                        </button>
                                        {categoryPickerSubOptions.length > 0 ? (
                                            categoryPickerSubOptions.map(sub => {
                                                const isSelected = categoryPickerSubCategory === sub;
                                                return (
                                                    <button
                                                        key={`picker-sub-${categoryPickerCategory}-${sub}`}
                                                        type="button"
                                                        onClick={() => setCategoryPickerSubCategory(sub)}
                                                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-black uppercase transition-colors ${isSelected ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                                                    >
                                                        {sub}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm font-medium text-gray-500">
                                                No saved sub-categories under {categoryPickerCategory}.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
                            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
                                {categoryPickerCategory
                                    ? `${categoryPickerCategory}${categoryPickerSubCategory ? ` / ${categoryPickerSubCategory}` : ''}`
                                    : 'No category selected'}
                            </div>
                            <div className="flex items-center justify-end gap-2">
                                <button onClick={closeCategoryPicker} className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200">
                                    Cancel
                                </button>
                                <button onClick={commitCategoryPicker} className="rounded-lg bg-em-red px-5 py-2 text-xs font-black uppercase text-white hover:bg-red-700">
                                    Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {locationAssignmentTarget && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4" onClick={closeLocationAssignment}>
                    <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">
                                    {locationAssignmentTarget.type === 'bulk' ? 'Assign Location' : 'Edit Location'}
                                </h3>
                                {locationAssignmentTarget.type === 'item' && locationEditorDisplay ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                                        <div className="rounded-xl bg-gray-100 px-3 py-2">
                                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Item Code</div>
                                            <div className="mt-1 text-xl font-black uppercase tracking-tight text-gray-900">{locationEditorDisplay.id}</div>
                                        </div>
                                        <div className="rounded-xl bg-gray-100 px-3 py-2">
                                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Description</div>
                                            <div className="mt-1 text-sm font-black uppercase tracking-tight text-gray-900 sm:text-base">{locationEditorDisplay.description || '-'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 text-sm font-black uppercase tracking-wide text-gray-700">
                                        {locationAssignmentTarget.itemIds.length} product{locationAssignmentTarget.itemIds.length === 1 ? '' : 's'} selected
                                    </div>
                                )}
                            </div>
                            <button onClick={closeLocationAssignment} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        {locationAssignmentTarget.type === 'item' ? (
                            <>
                                <div className="grid gap-4 bg-gray-50 p-4 md:grid-cols-[1.15fr_0.85fr]">
                                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                                        <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Current Locations</div>
                                        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-1">
                                            {itemLocationEditorEntries.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
                                                    No locations assigned.
                                                </div>
                                            ) : (
                                                itemLocationEditorEntries.map(entry => {
                                                    const key = `${locationAssignmentTarget.itemId}|${entry.locationId}`;
                                                    const currentSubLocation = auditSubLocations[key] ?? entry.subLocationDetail;
                                                    return (
                                                        <div key={`editor-${key}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="text-sm font-black uppercase text-gray-900">{entry.locationName}</div>
                                                                    {!entry.hasBaseline && <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">New</div>}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeLocationFromItemEditor(locationAssignmentTarget.itemId, entry.locationId)}
                                                                    className="rounded-lg border border-red-200 bg-white p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                                                                    title="Remove location"
                                                                >
                                                                    <TrashIcon className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                                                <div>
                                                                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Qty</div>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={auditUpdates[key] ?? entry.quantity}
                                                                        onChange={e => updateAuditQty(key, Math.max(0, Number(e.target.value) || 0))}
                                                                        className="form-control text-sm text-right font-black"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="text"
                                                                            value={currentSubLocation}
                                                                            onChange={e => updateAuditSubLocation(key, e.target.value)}
                                                                            className="form-control text-sm"
                                                                            placeholder="Shelf / Bin / Rack"
                                                                        />
                                                                        {currentSubLocation ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => updateAuditSubLocation(key, '')}
                                                                                className="rounded-lg border border-gray-200 bg-white p-2 text-gray-400 transition-colors hover:text-red-600"
                                                                                title="Clear sub-location"
                                                                            >
                                                                                <TrashIcon className="w-4 h-4" />
                                                                            </button>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                                        <div>
                                            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Add Location</div>
                                            <div className="max-h-[22vh] space-y-1 overflow-y-auto pr-1">
                                                {assignmentLocations.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm font-medium text-gray-500">
                                                        All locations assigned.
                                                    </div>
                                                ) : (
                                                    assignmentLocations.map(loc => {
                                                        const isSelected = locationAssignmentValue === loc.id;
                                                        return (
                                                            <button
                                                                key={`assign-loc-${loc.id}`}
                                                                type="button"
                                                                onClick={() => setLocationAssignmentValue(loc.id)}
                                                                className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-black uppercase transition-colors ${isSelected ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                                                            >
                                                                {loc.name}
                                                            </button>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                            <input
                                                type="text"
                                                value={locationAssignmentSubLocation}
                                                onChange={e => setLocationAssignmentSubLocation(e.target.value)}
                                                className="form-control text-sm"
                                                placeholder="Shelf / Bin / Rack"
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Qty</div>
                                            <input
                                                type="number"
                                                min="0"
                                                value={locationAssignmentQty}
                                                onChange={e => setLocationAssignmentQty(e.target.value)}
                                                className="form-control text-sm text-right font-black"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                            {locationAssignmentValue
                                                ? `${getLocationDisplayName(locationAssignmentValue)}${locationAssignmentSubLocation.trim() ? ` / ${locationAssignmentSubLocation.trim()}` : ''}`
                                                : 'No additional location selected'}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-end">
                                    <button onClick={closeLocationAssignment} className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200">
                                        Done
                                    </button>
                                    <button
                                        onClick={addLocationToItemEditor}
                                        disabled={!locationAssignmentValue}
                                        className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-black uppercase text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Add Location
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="grid gap-4 bg-gray-50 p-4 md:grid-cols-[1.1fr_0.9fr]">
                                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                                        <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-500">Main Location</div>
                                        <div className="max-h-[45vh] space-y-1 overflow-y-auto pr-1">
                                            {assignmentLocations.map(loc => {
                                                const isSelected = locationAssignmentValue === loc.id;
                                                return (
                                                    <button
                                                        key={`assign-loc-${loc.id}`}
                                                        type="button"
                                                        onClick={() => setLocationAssignmentValue(loc.id)}
                                                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm font-black uppercase transition-colors ${isSelected ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                                                    >
                                                        {loc.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                                        <div>
                                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                            <input
                                                type="text"
                                                value={locationAssignmentSubLocation}
                                                onChange={e => setLocationAssignmentSubLocation(e.target.value)}
                                                className="form-control text-sm"
                                                placeholder="Shelf / Bin / Rack"
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Qty</div>
                                            <input
                                                type="number"
                                                min="0"
                                                value={locationAssignmentQty}
                                                onChange={e => setLocationAssignmentQty(e.target.value)}
                                                className="form-control text-sm text-right font-black"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">
                                            {locationAssignmentValue
                                                ? `${getLocationDisplayName(locationAssignmentValue)}${locationAssignmentSubLocation.trim() ? ` / ${locationAssignmentSubLocation.trim()}` : ''}`
                                                : 'No location selected'}
                                        </div>
                                        <div className="text-[11px] font-medium text-gray-500">
                                            Products that already have this location will be left unchanged.
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-end">
                                    <button onClick={closeLocationAssignment} className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200">
                                        Cancel
                                    </button>
                                    <button onClick={commitLocationAssignment} className="rounded-lg bg-em-red px-5 py-2 text-xs font-black uppercase text-white hover:bg-red-700">
                                        Apply
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            {purchaseOrderTarget && purchaseOrderModalContext && (
                <PurchaseOrderModal
                    isOpen={Boolean(purchaseOrderTarget)}
                    onClose={closePurchaseOrderModal}
                    items={items}
                    purchaseOrders={purchaseOrders}
                    activePoNumber={purchaseOrderModalContext.poNumber}
                    itemCode={purchaseOrderModalContext.itemCode}
                    itemDescription={purchaseOrderModalContext.itemDescription}
                    defaultArrivalDate={effectiveDate}
                    onSavePurchaseOrder={onUpsertPurchaseOrder}
                    onApplyPurchaseOrder={applyPurchaseOrderToTarget}
                />
            )}
        </div>
    );
};

export default InventoryManagementModal;
