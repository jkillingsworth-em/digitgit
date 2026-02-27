import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { FilterIcon } from './icons/FilterIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import LegacyFilterModal from './LegacyFilterModal';

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
    editRows: Record<string, { id: string; description: string; category: string }>;
    selectedItemIds: string[];
    bulkCategory: string;
    bulkMove: { from: string; to: string; qtyMap: Record<string, number> };
    bulkMoveSubLocation: string;
}

interface InventoryManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    categoryHierarchy: Record<string, string[]>;
    onSave: (mode: SaveMode, data: any, date: string) => Promise<void>;
    onOpenItemDetails?: (item: InventoryItem) => void;
    initialMode?: Mode;
    initialFilters?: {
        categories?: string[];
        locations?: string[];
    };
}

const InventoryManagementModal: React.FC<InventoryManagementModalProps> = ({
    isOpen,
    onClose,
    items,
    stock,
    locations,
    categoryHierarchy,
    onSave,
    onOpenItemDetails,
    initialMode = 'ADD',
    initialFilters,
}) => {
    const [mode, setMode] = useState<Mode>(initialMode);
    const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [isProcessing, setIsProcessing] = useState(false);

    const [filterOpen, setFilterOpen] = useState(false);
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
    const [filterLocations, setFilterLocations] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    const [newItems, setNewItems] = useState<Array<Record<string, any>>>([
        { id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH' },
    ]);
    const [auditUpdates, setAuditUpdates] = useState<Record<string, number>>({});
    const [auditSubLocations, setAuditSubLocations] = useState<Record<string, string>>({});
    const [moveRoutes, setMoveRoutes] = useState<Record<string, MoveRoute>>({});
    const [editingQtyCell, setEditingQtyCell] = useState<string | null>(null);
    const [editRows, setEditRows] = useState<Record<string, { id: string; description: string; category: string }>>({});
    const [activeEditCell, setActiveEditCell] = useState<{ itemId: string; field: 'id' | 'description' | 'category' } | null>(null);
    const [bulkCategory, setBulkCategory] = useState('');
    const [bulkMove, setBulkMove] = useState<{ from: string; to: string; qtyMap: Record<string, number> }>({ from: '', to: '', qtyMap: {} });
    const [bulkMoveSubLocation, setBulkMoveSubLocation] = useState('');
    const [mobileEditToolsOpen, setMobileEditToolsOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [undoStack, setUndoStack] = useState<InventoryEditSnapshot[]>([]);
    const [redoStack, setRedoStack] = useState<InventoryEditSnapshot[]>([]);
    const isApplyingHistoryRef = useRef(false);

    const stagedAuditEntries = useMemo(() => {
        return Object.entries(auditUpdates)
            .map(([key, qty]) => {
                const [itemId, locationId] = key.split('|');
                return { itemId, locationId, qty: Number(qty), subLocationDetail: (auditSubLocations[key] || '').trim() };
            })
            .filter(entry => entry.itemId && entry.locationId && Number.isFinite(entry.qty) && entry.qty >= 0);
    }, [auditUpdates, auditSubLocations]);

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
                const changed =
                    nextId !== original.id ||
                    nextDescription !== original.description ||
                    nextCategory !== original.category;
                if (!changed) return null;
                return {
                    originalId: original.id,
                    newId: nextId,
                    description: nextDescription,
                    category: nextCategory,
                };
            })
            .filter(Boolean) as Array<{ originalId: string; newId: string; description: string; category: string }>;
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

    const filteredItems = useMemo(() => {
        if (mode === 'ADD') return [];
        let result = items;
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            result = result.filter(item => item.id.toLowerCase().includes(lower) || item.description.toLowerCase().includes(lower));
        }
        if (filterCategories.size > 0) {
            result = result.filter(item => {
                if (filterCategories.has(item.category)) return true;
                for (const value of filterCategories) {
                    if (!value.includes('|')) continue;
                    const [parent, child] = value.split('|');
                    if (item.category === parent && Array.isArray(item.subCategory1) && item.subCategory1.includes(child)) return true;
                }
                return false;
            });
        }
        if (filterLocations.size > 0) {
            result = result.filter(item => {
                const itemStock = stock.filter(s => s.itemId === item.id);
                return itemStock.some(s => filterLocations.has(s.locationId));
            });
        }
        return result;
    }, [items, stock, searchQuery, filterCategories, filterLocations, mode]);

    const mobileLocationSections = useMemo(() => {
        const sections = new Map<string, MobileLocationSection>();
        const visibleItemIds = new Set(filteredItems.map(item => item.id));
        const itemById = new Map(filteredItems.map(item => [item.id, item]));

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

        return Array.from(sections.values())
            .map(section => ({
                ...section,
                entries: section.entries.sort((a, b) => a.item.description.localeCompare(b.item.description)),
            }))
            .sort((a, b) => a.locationName.localeCompare(b.locationName));
    }, [filteredItems, stock, filterLocations, locationNameById]);

    useEffect(() => {
        const updateIsMobile = () => setIsMobile(window.innerWidth < 768);
        updateIsMobile();
        window.addEventListener('resize', updateIsMobile);
        return () => window.removeEventListener('resize', updateIsMobile);
    }, []);

    useEffect(() => {
        if (!isOpen || !isMobile) return;
        if (mode !== 'EDIT') setMode('EDIT');
    }, [isOpen, isMobile, mode]);

    useEffect(() => {
        if (isOpen) {
            setMode(initialMode);
            setFilterCategories(new Set(initialFilters?.categories || []));
            setFilterLocations(new Set(initialFilters?.locations || []));
            setSearchQuery('');
            setSelectedItemIds(new Set());
            setAuditUpdates({});
            setAuditSubLocations({});
            setMoveRoutes({});
            setEditingQtyCell(null);
            setEditRows({});
            setActiveEditCell(null);
            setBulkCategory('');
            setBulkMove({ from: '', to: '', qtyMap: {} });
            setBulkMoveSubLocation('');
            setMobileEditToolsOpen(false);
            setNewItems([{ id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH' }]);
            setUndoStack([]);
            setRedoStack([]);
        }
    }, [initialMode, initialFilters, isOpen]);

    useEffect(() => {
        setSelectedItemIds(new Set());
        setAuditUpdates({});
        setAuditSubLocations({});
        setMoveRoutes({});
        setEditingQtyCell(null);
        setEditRows({});
        setActiveEditCell(null);
        setBulkCategory('');
        setBulkMove({ from: '', to: '', qtyMap: {} });
        setBulkMoveSubLocation('');
        setMobileEditToolsOpen(false);
        setUndoStack([]);
        setRedoStack([]);
    }, [mode, filterCategories, filterLocations]);

    if (!isOpen) return null;

    const createSnapshot = (): InventoryEditSnapshot => ({
        newItems: structuredClone(newItems),
        auditUpdates: { ...auditUpdates },
        auditSubLocations: { ...auditSubLocations },
        moveRoutes: structuredClone(moveRoutes),
        editRows: structuredClone(editRows),
        selectedItemIds: Array.from(selectedItemIds),
        bulkCategory,
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
        setSelectedItemIds(new Set(snapshot.selectedItemIds));
        setBulkCategory(snapshot.bulkCategory);
        setBulkMove(snapshot.bulkMove);
        setBulkMoveSubLocation(snapshot.bulkMoveSubLocation);
        setActiveEditCell(null);
        setEditingQtyCell(null);
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
        setSelectedItemIds(checked ? new Set(filteredItems.map(item => item.id)) : new Set());
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
        setNewItems(prev => [...prev, { id: '', description: '', quantity: 0, category: '', subCategory1: [], locationId: '', source: 'OH' }]);
    };

    const handleRemoveNewRow = (index: number) => {
        setNewItems(prev => prev.filter((_, idx) => idx !== index));
    };

    const updateNewItem = (index: number, field: string, value: any) => {
        setNewItems(prev => prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row)));
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
        return editRows[item.id] || { id: item.id, description: item.description, category: item.category };
    };

    const updateEditRow = (item: InventoryItem, patch: Partial<{ id: string; description: string; category: string }>) => {
        pushHistory();
        const current = getEditableRow(item);
        setEditRows(prev => ({
            ...prev,
            [item.id]: {
                id: patch.id ?? current.id,
                description: patch.description ?? current.description,
                category: patch.category ?? current.category,
            },
        }));
    };

    const applyBulkCategory = () => {
        if (!bulkCategory) {
            window.alert('Select a category first.');
            return;
        }
        if (selectedItemIds.size === 0) {
            window.alert('Select one or more products first.');
            return;
        }
        pushHistory();
        const selected = new Set(selectedItemIds);
        setEditRows(prev => {
            const next = { ...prev };
            items.forEach(item => {
                if (!selected.has(item.id)) return;
                const current = next[item.id] || { id: item.id, description: item.description, category: item.category };
                next[item.id] = { ...current, category: bulkCategory };
            });
            return next;
        });
    };

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

    const openEditableCell = (item: InventoryItem, field: 'id' | 'description' | 'category') => {
        if ((field === 'id' || field === 'description') && !selectedItemIds.has(item.id)) {
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
                const payload = newItems.filter(item => item.id && item.description && item.category && item.locationId);
                if (payload.length === 0) throw new Error('Please fill in required fields (ID, Desc, Cat, Loc) for at least one item.');
                await onSave('ADD', payload, effectiveDate);
            } else if (mode === 'EDIT') {
                const hasItemChanges = stagedItemEdits.length > 0;
                const hasQtyChange = stagedAuditEntries.length > 0;
                const hasMoveChange = stagedBulkTransfers.length > 0;
                if (!hasItemChanges && !hasQtyChange && !hasMoveChange) {
                    throw new Error('No changes staged. Edit fields, qty by location, or move routing.');
                }
                if (hasItemChanges) {
                    await onSave('EDIT', { itemChanges: stagedItemEdits }, effectiveDate);
                }
                if (hasQtyChange) {
                    await onSave('AUDIT', stagedAuditEntries, effectiveDate);
                }
                if (hasMoveChange) {
                    if (!bulkMove.from || !bulkMove.to) throw new Error('Select bulk move FROM and TO locations.');
                    if (bulkMove.from === bulkMove.to) throw new Error('Bulk move FROM and TO must be different.');
                    await onSave('MOVE', stagedBulkTransfers, effectiveDate);
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

    const renderAddMode = () => (
        <div className="flex-1 overflow-y-auto p-4">
            <table className="min-w-full text-xs text-left">
                <thead className="bg-gray-100 font-black uppercase text-gray-500">
                    <tr>
                        <th className="p-2 w-32">ID <span className="text-red-500">*</span></th>
                        <th className="p-2">Description <span className="text-red-500">*</span></th>
                        <th className="p-2 w-24">Qty <span className="text-red-500">*</span></th>
                        <th className="p-2 w-32">Category <span className="text-red-500">*</span></th>
                        <th className="p-2 w-32">Location <span className="text-red-500">*</span></th>
                        <th className="p-2 w-24">Source</th>
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
                                    {Object.keys(categoryHierarchy).sort().map(cat => (
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
                            <td className="p-1 text-center">
                                <button onClick={() => handleRemoveNewRow(idx)} className="text-red-400 hover:text-red-600">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <button onClick={handleAddNewRow} className="mt-4 flex items-center gap-2 text-xs font-bold text-em-red uppercase hover:underline">
                <PlusIcon className="w-4 h-4" /> Add Row
            </button>
        </div>
    );

    const renderActionPanel = () => {
        if (mode === 'ADD') return null;
        if (isMobile && mode === 'EDIT') return null;
        return (
            <div className="bg-gray-50 border-t border-gray-200 p-4 shrink-0">
                <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-xs font-black text-gray-700 uppercase tracking-widest">
                        {mode === 'EDIT' ? 'New Properties' : mode === 'AUDIT' ? 'Update Quantities' : 'Transfer Configuration'}
                    </h3>
                    <div className="h-px bg-gray-200 flex-grow"></div>
                </div>
                {mode === 'EDIT' && (
                    <>
                    <div className="hidden md:grid md:grid-cols-5 gap-3">
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Single Item</div>
                            <div className="mt-1 text-xl font-black text-gray-900">{stagedItemEdits.length}</div>
                            <div className="text-[11px] font-medium text-gray-500">code/description/category edit(s)</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Qty Updates</div>
                            <div className="mt-1 text-xl font-black text-gray-900">{stagedAuditEntries.length}</div>
                            <div className="text-[11px] font-medium text-gray-500">location qty change(s)</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Selection</div>
                            <div className="mt-1 text-xl font-black text-gray-900">{selectedItemIds.size}</div>
                            <div className="text-[11px] font-medium text-gray-500">checked product(s)</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-3 md:col-span-2 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Category</span>
                                <select className="form-control text-xs max-w-[180px]" value={bulkCategory} onChange={e => setBulkCategory(e.target.value)}>
                                    <option value="">Select...</option>
                                    {Object.keys(categoryHierarchy).sort().map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                                <button onClick={applyBulkCategory} className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200 text-[11px] font-bold uppercase">Apply</button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <ArrowRightLeftIcon className="w-4 h-4 text-gray-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Move</span>
                                <select className="form-control text-xs max-w-[140px]" value={bulkMove.from} onChange={e => {
                                    pushHistory();
                                    setBulkMove(prev => ({ ...prev, from: e.target.value }));
                                }}>
                                    <option value="">From...</option>
                                    {locations.map(loc => <option key={`bulk-from-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                                </select>
                                <select className="form-control text-xs max-w-[140px]" value={bulkMove.to} onChange={e => {
                                    pushHistory();
                                    setBulkMove(prev => ({ ...prev, to: e.target.value }));
                                }}>
                                    <option value="">To...</option>
                                    {locations.filter(loc => loc.id !== bulkMove.from).map(loc => <option key={`bulk-to-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                                </select>
                                <span className="text-[11px] font-bold text-gray-600">{stagedBulkTransfers.length} staged</span>
                            </div>
                        </div>
                        <div className="text-xs text-gray-500 italic self-end pb-1 md:col-span-5">Single item: click value to edit, click icon to open full modal. Bulk: check rows, apply category and set move qty per checked row.</div>
                    </div>
                    <div className="md:hidden space-y-2">
                        <div className="text-[11px] text-gray-600 font-bold uppercase tracking-wider">Qty updates: {stagedAuditEntries.length} · Selected: {selectedItemIds.size} · Move staged: {stagedBulkTransfers.length}</div>
                        <button
                            type="button"
                            onClick={() => setMobileEditToolsOpen(prev => !prev)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-black uppercase text-gray-700"
                        >
                            {mobileEditToolsOpen ? 'Hide Bulk Tools' : 'Show Bulk Tools'}
                        </button>
                        {mobileEditToolsOpen && (
                            <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1">
                                        <ArrowRightLeftIcon className="w-4 h-4 text-gray-500" />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Move</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <select className="form-control text-xs" value={bulkMove.from} onChange={e => {
                                            pushHistory();
                                            setBulkMove(prev => ({ ...prev, from: e.target.value }));
                                        }}>
                                            <option value="">From...</option>
                                            {locations.map(loc => <option key={`bulk-from-mobile-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                        <select className="form-control text-xs" value={bulkMove.to} onChange={e => {
                                            pushHistory();
                                            setBulkMove(prev => ({ ...prev, to: e.target.value }));
                                        }}>
                                            <option value="">To...</option>
                                            {locations.filter(loc => loc.id !== bulkMove.from).map(loc => <option key={`bulk-to-mobile-${loc.id}`} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <input
                                        type="text"
                                        value={bulkMoveSubLocation}
                                        onChange={e => setBulkMoveSubLocation(e.target.value)}
                                        className="form-control text-xs"
                                        placeholder="Destination Sub-Location (optional)"
                                    />
                                    <div className="text-[11px] font-bold text-gray-600">{stagedBulkTransfers.length} staged</div>
                                </div>
                            </div>
                        )}
                        <div className="text-[11px] text-gray-500 italic">Mobile focus: check stock by location, adjust quantity, and move stock.</div>
                    </div>
                    </>
                )}
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
                            <div className="flex flex-col items-end gap-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        toggleSelectionForLocation(section.locationId, !allSelected);
                                    }}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-[10px] font-bold uppercase text-gray-700"
                                >
                                    {allSelected ? 'Clear Select' : 'Select All'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBulkMove(prev => ({ ...prev, from: section.locationId }))}
                                    className={`rounded border px-2 py-1 text-[10px] font-bold uppercase ${bulkMove.from === section.locationId ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-300 bg-white text-gray-700'}`}
                                >
                                    Use As Move Source
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {section.entries.map(({ item, quantity, subLocationDetail }) => {
                                const key = `${item.id}|${section.locationId}`;
                                const isSelected = selectedItemIds.has(item.id);
                                const subLocationValue = auditSubLocations[key] ?? subLocationDetail;

                                return (
                                    <div key={key} className={`rounded-lg border p-3 space-y-3 ${isSelected ? 'border-em-red bg-red-50/40 shadow-sm' : 'border-gray-200 bg-gray-50/70'}`}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="inline-flex max-w-full items-center rounded-md bg-red-100 px-2.5 py-1 text-sm font-black uppercase text-em-red truncate">{item.id}</div>
                                                <div className="mt-1.5 text-[15px] font-black uppercase text-blue-900 truncate tracking-tight">{item.description || '-'}</div>
                                                <div className="mt-1.5 inline-flex max-w-full items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase text-gray-700 truncate">{item.category || 'Uncategorized'}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Qty @ Location</div>
                                                <div className="text-2xl font-black text-gray-900 leading-none mt-1">{auditUpdates[key] ?? quantity}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Qty @ Location</div>
                                                <input
                                                    type="number"
                                                    className="form-control w-full text-xs text-right font-black"
                                                    value={auditUpdates[key] ?? quantity}
                                                    onChange={e => updateAuditQty(key, Number(e.target.value))}
                                                />
                                            </div>
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Move Qty</div>
                                                <input
                                                    type="number"
                                                    className="form-control w-full text-xs text-right font-black"
                                                    value={bulkMove.qtyMap[item.id] ?? 0}
                                                    onChange={e => updateBulkMoveQtyWithSelection(item.id, Number(e.target.value) || 0, section.locationId)}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sub-Location</div>
                                            <input
                                                type="text"
                                                className="form-control w-full text-xs"
                                                value={subLocationValue}
                                                onChange={e => updateAuditSubLocation(key, e.target.value)}
                                                placeholder="Shelf / Bin / Rack"
                                            />
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
            <table className="min-w-[1120px] text-xs text-left bg-white rounded-lg shadow-sm overflow-hidden">
                <thead className="bg-gray-100 font-black uppercase text-gray-500 sticky top-0 z-10">
                    <tr>
                        <th className="p-3 w-8 text-center">
                            <input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={filteredItems.length > 0 && selectedItemIds.size === filteredItems.length} />
                        </th>
                        <th className="p-3">Item Code</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Stock Overview</th>
                        {mode === 'EDIT' && <th className="p-3 text-right w-28">Total Qty</th>}
                        {mode === 'EDIT' && <th className="p-3 text-right w-28">Move Qty</th>}
                        {mode === 'EDIT' && <th className="p-3 w-10 text-center">Item Edit</th>}
                        {mode === 'MOVE' && <th className="p-3 text-right w-[320px]">Move Routing</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {filteredItems.map(item => {
                        const itemStock = stock.filter(s => s.itemId === item.id);
                        const filteredStock = filterLocations.size > 0 ? itemStock.filter(s => filterLocations.has(s.locationId)) : itemStock;
                        const stockByLocation = filteredStock.reduce<Record<string, number>>((acc, entry) => {
                            acc[entry.locationId] = (acc[entry.locationId] || 0) + entry.quantity;
                            return acc;
                        }, {});
                        const locationRows = Object.entries(stockByLocation).sort((a, b) => a[0].localeCompare(b[0]));
                        const totalQty = locationRows.reduce((sum, [, qty]) => sum + qty, 0);
                        const rowMove = moveRoutes[item.id] || { from: '', to: '', qty: 0 };
                        const editable = getEditableRow(item);
                        const isSelected = selectedItemIds.has(item.id);
                        const isStaged = stagedItemEditIds.has(item.id) || stagedAuditItemIds.has(item.id) || stagedBulkMoveItemIds.has(item.id);
                        return (
                            <tr key={item.id} className={`${isSelected ? 'bg-red-50' : isStaged ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}>
                                <td className="p-3">
                                    <div className="text-center">
                                        <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleSelection(item.id)} />
                                    </div>
                                </td>
                                <td className="p-3">
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
                                            <button className={`w-full text-left rounded px-2 py-2 text-sm font-black uppercase ${isSelected ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} onClick={() => openEditableCell(item, 'id')}>
                                                {editable.id}
                                            </button>
                                        )
                                    ) : (
                                        <div className="text-sm font-black text-gray-900">{item.id}</div>
                                    )}
                                </td>
                                <td className="p-3">
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
                                            <button className={`w-full text-left rounded px-2 py-2 text-[15px] font-semibold uppercase ${isSelected ? 'bg-gray-50 hover:bg-gray-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`} onClick={() => openEditableCell(item, 'description')}>
                                                {editable.description || '-'}
                                            </button>
                                        )
                                    ) : (
                                        <div className="text-[15px] font-semibold text-gray-700 truncate max-w-[240px]">{item.description}</div>
                                    )}
                                </td>
                                <td className="p-3 text-sm font-semibold text-gray-700">
                                    {mode === 'EDIT' ? (
                                        activeEditCell?.itemId === item.id && activeEditCell.field === 'category' ? (
                                            <select
                                                className="form-control text-sm font-semibold uppercase"
                                                autoFocus
                                                value={editable.category}
                                                onChange={e => updateEditRow(item, { category: e.target.value })}
                                                onBlur={() => setActiveEditCell(null)}
                                            >
                                                <option value="">Select...</option>
                                                {Object.keys(categoryHierarchy)
                                                    .sort()
                                                    .map(cat => (
                                                        <option key={cat} value={cat}>
                                                            {cat}
                                                        </option>
                                                    ))}
                                            </select>
                                        ) : (
                                            <button className="w-full text-left rounded bg-gray-50 px-2 py-2 text-sm font-semibold uppercase hover:bg-gray-100" onClick={() => openEditableCell(item, 'category')}>
                                                {editable.category || '-'}
                                            </button>
                                        )
                                    ) : (
                                        <span className="text-sm font-semibold uppercase">{item.category}</span>
                                    )}
                                </td>
                                <td className="p-3">
                                    <div className="flex flex-wrap gap-1">
                                        {locationRows.map(([locationId, quantity]) => {
                                            const key = `${item.id}|${locationId}`;
                                            return (
                                                <div key={key} className="bg-gray-100 px-2 py-1 rounded border border-gray-200 flex items-center gap-2">
                                                    <span className="font-bold text-gray-700">{locationId}:</span>
                                                    {mode === 'AUDIT' && (
                                                        <input type="number" className="w-16 form-control text-xs" value={auditUpdates[key] ?? quantity} onChange={e => updateAuditQty(key, Number(e.target.value))} />
                                                    )}
                                                    {mode === 'EDIT' && (
                                                        editingQtyCell === key ? (
                                                            <input
                                                                type="number"
                                                                className="w-16 form-control text-xs"
                                                                autoFocus
                                                                value={auditUpdates[key] ?? quantity}
                                                                onChange={e => updateAuditQty(key, Number(e.target.value))}
                                                                onBlur={() => setEditingQtyCell(null)}
                                                                onKeyDown={e => {
                                                                    if (e.key === 'Enter' || e.key === 'Escape') setEditingQtyCell(null);
                                                                }}
                                                            />
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="rounded bg-white px-2 py-0.5 text-xs font-black text-gray-700 border border-gray-300 hover:border-em-red hover:text-em-red"
                                                                onClick={() => setEditingQtyCell(key)}
                                                            >
                                                                {auditUpdates[key] ?? quantity}
                                                            </button>
                                                        )
                                                    )}
                                                    {mode !== 'AUDIT' && mode !== 'EDIT' && <span className="font-mono">{quantity}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </td>
                                {mode === 'EDIT' && <td className="p-3 text-right text-sm font-black text-gray-900">{totalQty}</td>}
                                {mode === 'EDIT' && (
                                    <td className="p-3 text-right">
                                        {selectedItemIds.has(item.id) ? (
                                            <input
                                                type="number"
                                                className="w-20 form-control text-xs text-right"
                                                value={bulkMove.qtyMap[item.id] ?? 0}
                                                onChange={e => updateBulkMoveQty(item.id, Number(e.target.value) || 0)}
                                            />
                                        ) : (
                                            <span className="text-[11px] font-bold text-gray-400">Select row</span>
                                        )}
                                    </td>
                                )}
                                {mode === 'MOVE' && (
                                    <td className="p-3 text-right">
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
                                    <td className="p-3 w-10 text-center">
                                        <button onClick={() => onOpenItemDetails?.(item)} className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-em-red" title="Open full item details">
                                            <PencilSquareIcon className="w-4 h-4" />
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
                <div className="hidden md:flex bg-gray-50 border-b border-gray-200 px-2 md:px-6 gap-1 md:space-x-1">
                    {(['ADD', 'EDIT', 'AUDIT', 'MOVE'] as Mode[]).map(value => (
                        <button key={value} onClick={() => setMode(value)} className={`px-2 md:px-6 py-3 text-xs font-black uppercase tracking-widest border-b-2 transition-colors ${mode === value ? 'border-em-red text-em-red bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
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
                        </div>
                        {isMobile && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Bulk Move Selected</div>
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
                                <div className="grid grid-cols-2 gap-2">
                                    <select className="form-control text-xs" value={bulkMove.from} onChange={e => {
                                        pushHistory();
                                        setBulkMove(prev => ({ ...prev, from: e.target.value }));
                                    }}>
                                        <option value="">From...</option>
                                        {mobileLocationSections.map(section => (
                                            <option key={`mobile-from-${section.locationId}`} value={section.locationId}>{section.locationName}</option>
                                        ))}
                                    </select>
                                    <select className="form-control text-xs" value={bulkMove.to} onChange={e => {
                                        pushHistory();
                                        setBulkMove(prev => ({ ...prev, to: e.target.value }));
                                    }}>
                                        <option value="">To...</option>
                                        {locations.filter(loc => loc.id !== bulkMove.from).map(loc => (
                                            <option key={`mobile-to-${loc.id}`} value={loc.id}>{loc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <input
                                    type="text"
                                    value={bulkMoveSubLocation}
                                    onChange={e => setBulkMoveSubLocation(e.target.value)}
                                    className="form-control text-xs"
                                    placeholder="Destination Sub-Location (optional)"
                                />
                                <div className="text-[11px] font-bold text-gray-600">{selectedItemIds.size} selected · {stagedBulkTransfers.length} move staged</div>
                            </div>
                        )}
                        </div>
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
        </div>
    );
};

export default InventoryManagementModal;
