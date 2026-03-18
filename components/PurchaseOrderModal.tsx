import React, { useEffect, useMemo, useRef, useState } from 'react';
import { InventoryItem, PurchaseOrderRecord } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface PurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: InventoryItem[];
    purchaseOrders: PurchaseOrderRecord[];
    activePoNumber?: string;
    itemCode?: string;
    itemDescription?: string;
    defaultArrivalDate: string;
    onSavePurchaseOrder: (record: PurchaseOrderRecord) => Promise<PurchaseOrderRecord>;
    onApplyPurchaseOrder: (record: PurchaseOrderRecord) => void;
}

const uniqueSorted = (values: string[]) => Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort();

const buildDraft = (purchaseOrders: PurchaseOrderRecord[], activePoNumber?: string, defaultArrivalDate?: string, itemCode?: string) => {
    const normalizedPoNumber = (activePoNumber || '').trim().toUpperCase();
    const matchingRecord = purchaseOrders.find(record => record.poNumber.toUpperCase() === normalizedPoNumber);

    if (matchingRecord) {
        return {
            poNumber: matchingRecord.poNumber,
            vendor: matchingRecord.vendor || '',
            notes: matchingRecord.notes || '',
            arrivalDates: uniqueSorted(matchingRecord.arrivalDates || []),
            itemIds: uniqueSorted([...(matchingRecord.itemIds || []), itemCode || '']),
        };
    }

    return {
        poNumber: normalizedPoNumber,
        vendor: '',
        notes: '',
        arrivalDates: defaultArrivalDate ? [defaultArrivalDate] : [],
        itemIds: uniqueSorted([itemCode || '']),
    };
};

const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
    isOpen,
    onClose,
    items,
    purchaseOrders,
    activePoNumber,
    itemCode,
    itemDescription,
    defaultArrivalDate,
    onSavePurchaseOrder,
    onApplyPurchaseOrder,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [draft, setDraft] = useState(() => buildDraft(purchaseOrders, activePoNumber, defaultArrivalDate, itemCode));
    const [arrivalDateInput, setArrivalDateInput] = useState(defaultArrivalDate);
    const [itemLookupQuery, setItemLookupQuery] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const poNumberInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setDraft(buildDraft(purchaseOrders, activePoNumber, defaultArrivalDate, itemCode));
        setArrivalDateInput(defaultArrivalDate);
        setSearchQuery('');
        setItemLookupQuery('');
    }, [isOpen, purchaseOrders, activePoNumber, defaultArrivalDate, itemCode]);

    const normalizedContextItemId = useMemo(() => {
        const normalized = (itemCode || '').trim().toUpperCase();
        return normalized && normalized !== 'MULTI-SKU' ? normalized : '';
    }, [itemCode]);

    const itemsById = useMemo(() => {
        return new Map(items.map(item => [item.id.toUpperCase(), item]));
    }, [items]);

    const draftItemRows = useMemo(() => {
        return uniqueSorted(draft.itemIds || []).map(itemId => {
            const inventoryItem = itemsById.get(itemId.toUpperCase());
            return {
                itemId,
                description: inventoryItem?.description || '',
                existsInInventory: Boolean(inventoryItem),
                isPinned: Boolean(normalizedContextItemId) && itemId.toUpperCase() === normalizedContextItemId,
            };
        });
    }, [draft.itemIds, itemsById, normalizedContextItemId]);

    const itemLookupResults = useMemo(() => {
        const normalizedQuery = itemLookupQuery.trim().toUpperCase();
        if (!normalizedQuery) return [] as InventoryItem[];

        const selectedIds = new Set(uniqueSorted(draft.itemIds || []).map(itemId => itemId.toUpperCase()));

        return items
            .filter(item => {
                if (selectedIds.has(item.id.toUpperCase())) return false;

                const itemId = item.id.toUpperCase();
                const description = (item.description || '').toUpperCase();
                const category = (item.category || '').toUpperCase();
                return itemId.includes(normalizedQuery) || description.includes(normalizedQuery) || category.includes(normalizedQuery);
            })
            .sort((left, right) => {
                const leftStarts = left.id.toUpperCase().startsWith(normalizedQuery) ? 0 : 1;
                const rightStarts = right.id.toUpperCase().startsWith(normalizedQuery) ? 0 : 1;
                if (leftStarts !== rightStarts) return leftStarts - rightStarts;
                return left.id.localeCompare(right.id, undefined, { numeric: true, sensitivity: 'base' });
            })
            .slice(0, 8);
    }, [itemLookupQuery, items, draft.itemIds]);

    const filteredPurchaseOrders = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toUpperCase();

        return [...purchaseOrders]
            .filter(record => {
                if (!normalizedQuery) return true;

                const poNumber = (record.poNumber || '').toUpperCase();
                const vendor = (record.vendor || '').toUpperCase();
                const notes = (record.notes || '').toUpperCase();
                const itemIds = (record.itemIds || []).join(' ').toUpperCase();
                return poNumber.includes(normalizedQuery) || vendor.includes(normalizedQuery) || notes.includes(normalizedQuery) || itemIds.includes(normalizedQuery);
            })
            .sort((left, right) => {
                const leftUpdated = left.updatedDate || '';
                const rightUpdated = right.updatedDate || '';
                if (leftUpdated !== rightUpdated) return rightUpdated.localeCompare(leftUpdated);
                return left.poNumber.localeCompare(right.poNumber, undefined, { numeric: true, sensitivity: 'base' });
            });
    }, [purchaseOrders, searchQuery]);

    const isSavedPoSelected = useMemo(() => {
        const normalizedPoNumber = draft.poNumber.trim().toUpperCase();
        if (!normalizedPoNumber) return false;
        return purchaseOrders.some(record => record.poNumber.trim().toUpperCase() === normalizedPoNumber);
    }, [purchaseOrders, draft.poNumber]);

    const focusPoNumberInput = () => {
        window.requestAnimationFrame(() => {
            poNumberInputRef.current?.focus();
            poNumberInputRef.current?.select();
        });
    };

    const addItemIdToDraft = (value: string) => {
        const normalizedValue = value.trim().toUpperCase();
        if (!normalizedValue) return;

        const canonicalItemId = itemsById.get(normalizedValue)?.id || normalizedValue;
        setDraft(prev => ({
            ...prev,
            itemIds: uniqueSorted([...(prev.itemIds || []), canonicalItemId]),
        }));
        setItemLookupQuery('');
    };

    const removeItemIdFromDraft = (itemIdToRemove: string) => {
        if (normalizedContextItemId && itemIdToRemove.toUpperCase() === normalizedContextItemId) return;

        setDraft(prev => ({
            ...prev,
            itemIds: (prev.itemIds || []).filter(itemId => itemId !== itemIdToRemove),
        }));
    };

    const addArrivalDate = () => {
        const nextDate = arrivalDateInput.trim();
        if (!nextDate) return;

        setDraft(prev => ({
            ...prev,
            arrivalDates: uniqueSorted([...prev.arrivalDates, nextDate]),
        }));
        setArrivalDateInput('');
    };

    const removeArrivalDate = (dateToRemove: string) => {
        setDraft(prev => ({
            ...prev,
            arrivalDates: prev.arrivalDates.filter(date => date !== dateToRemove),
        }));
    };

    const loadPurchaseOrder = (record: PurchaseOrderRecord) => {
        setDraft({
            poNumber: record.poNumber,
            vendor: record.vendor || '',
            notes: record.notes || '',
            arrivalDates: uniqueSorted(record.arrivalDates || []),
            itemIds: uniqueSorted([...(record.itemIds || []), itemCode || '']),
        });
        setArrivalDateInput(defaultArrivalDate);
        setItemLookupQuery('');
    };

    const resetDraft = () => {
        setDraft(buildDraft([], '', defaultArrivalDate, itemCode));
        setArrivalDateInput(defaultArrivalDate);
        setSearchQuery('');
        setItemLookupQuery('');
        focusPoNumberInput();
    };

    const persistPurchaseOrder = async (applyToRow: boolean) => {
        const poNumber = draft.poNumber.trim().toUpperCase();
        const arrivalDates = uniqueSorted([
            ...draft.arrivalDates,
            ...(draft.arrivalDates.length === 0 && arrivalDateInput.trim() ? [arrivalDateInput.trim()] : []),
        ]);

        if (!poNumber) {
            window.alert('PO number is required.');
            return;
        }

        if (arrivalDates.length === 0) {
            window.alert('Add at least one arrival date.');
            return;
        }

        setIsSaving(true);
        try {
            const savedRecord = await onSavePurchaseOrder({
                poNumber,
                vendor: draft.vendor,
                notes: draft.notes,
                arrivalDates,
                itemIds: uniqueSorted(draft.itemIds || []),
            });

            setDraft({
                poNumber: savedRecord.poNumber,
                vendor: savedRecord.vendor || '',
                notes: savedRecord.notes || '',
                arrivalDates: uniqueSorted(savedRecord.arrivalDates || []),
                itemIds: uniqueSorted(savedRecord.itemIds || []),
            });

            if (applyToRow) {
                onApplyPurchaseOrder(savedRecord);
                onClose();
            }
        } catch (error: any) {
            window.alert(error?.message || 'Unable to save purchase order.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[140] overflow-y-auto bg-black/50 p-4" onClick={onClose}>
            <div className="flex min-h-full items-start justify-center py-2 md:items-center" onClick={event => event.stopPropagation()}>
                <div className="my-2 flex w-full max-w-5xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div className="shrink-0 flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-black uppercase tracking-tight text-gray-900">Purchase Order</h3>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
                            <div className="rounded-xl bg-gray-100 px-3 py-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Item Code</div>
                                <div className="mt-1 text-lg font-black uppercase tracking-tight text-gray-900">{itemCode || '-'}</div>
                            </div>
                            <div className="rounded-xl bg-gray-100 px-3 py-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Description</div>
                                <div className="mt-1 truncate text-sm font-black uppercase tracking-tight text-gray-900 sm:text-base">{itemDescription || '-'}</div>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-4">
                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="min-h-0 rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">Saved POs</div>
                            <button
                                type="button"
                                onClick={resetDraft}
                                className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-black uppercase transition-colors ${isSavedPoSelected ? 'border-gray-300 bg-white text-gray-700 hover:border-em-red hover:text-em-red' : 'border-em-red bg-red-50 text-em-red'}`}
                            >
                                New PO
                            </button>
                        </div>
                        <input
                            className="form-control mt-3 text-sm uppercase"
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                            placeholder="Search PO, vendor, notes, SKU..."
                        />
                        <div className="mt-3 max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                            {filteredPurchaseOrders.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
                                    No purchase orders found.
                                </div>
                            ) : (
                                filteredPurchaseOrders.map(record => {
                                    const isSelected = draft.poNumber.trim().toUpperCase() === record.poNumber.trim().toUpperCase();
                                    const latestArrival = [...(record.arrivalDates || [])].sort().slice(-1)[0] || '-';

                                    return (
                                        <button
                                            key={record.docId || record.poNumber}
                                            type="button"
                                            onClick={() => loadPurchaseOrder(record)}
                                            className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${isSelected ? 'border-em-red bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                                        >
                                            <div className="text-sm font-black uppercase text-gray-900">{record.poNumber}</div>
                                            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">Latest Arrival {latestArrival}</div>
                                            {record.vendor && <div className="mt-2 text-xs font-semibold uppercase text-gray-700">{record.vendor}</div>}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase text-gray-600">{(record.arrivalDates || []).length} Date{(record.arrivalDates || []).length === 1 ? '' : 's'}</span>
                                                {(record.arrivalDates || []).length > 1 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">Blanket</span>}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">PO Number</div>
                                <input
                                    ref={poNumberInputRef}
                                    className="form-control text-sm uppercase font-black"
                                    value={draft.poNumber}
                                    onChange={event => setDraft(prev => ({ ...prev, poNumber: event.target.value.toUpperCase() }))}
                                    placeholder="PO Number"
                                />
                            </div>
                            <div>
                                <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Vendor</div>
                                <input
                                    className="form-control text-sm uppercase"
                                    value={draft.vendor}
                                    onChange={event => setDraft(prev => ({ ...prev, vendor: event.target.value }))}
                                    placeholder="Vendor"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Arrival Dates</div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="date"
                                    className="form-control text-sm"
                                    value={arrivalDateInput}
                                    onChange={event => setArrivalDateInput(event.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={addArrivalDate}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add Date
                                </button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {draft.arrivalDates.length > 0 ? (
                                    draft.arrivalDates.map(date => (
                                        <div key={date} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-black uppercase text-gray-700">
                                            <span>{date}</span>
                                            <button type="button" onClick={() => removeArrivalDate(date)} className="text-gray-400 hover:text-red-600">
                                                <TrashIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm font-medium text-gray-500">
                                        No arrival dates saved.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4">
                            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Notes</div>
                            <textarea
                                value={draft.notes}
                                onChange={event => setDraft(prev => ({ ...prev, notes: event.target.value }))}
                                className="form-control min-h-[140px] text-sm"
                                placeholder="PO notes"
                            />
                        </div>

                        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">PO Line Items</div>
                            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <input
                                    className="form-control text-sm uppercase"
                                    value={itemLookupQuery}
                                    onChange={event => setItemLookupQuery(event.target.value)}
                                    onKeyDown={event => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();
                                        addItemIdToDraft(itemLookupQuery);
                                    }}
                                    placeholder="Search SKU or enter manual item code"
                                />
                                <button
                                    type="button"
                                    onClick={() => addItemIdToDraft(itemLookupQuery)}
                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add SKU
                                </button>
                            </div>

                            {itemLookupQuery.trim() && itemLookupResults.length > 0 && (
                                <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-white p-2">
                                    {itemLookupResults.map(item => (
                                        <button
                                            key={`po-item-result-${item.id}`}
                                            type="button"
                                            onClick={() => addItemIdToDraft(item.id)}
                                            className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-gray-50"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-xs font-black uppercase text-gray-900">{item.id}</div>
                                                <div className="mt-1 truncate text-[11px] font-semibold uppercase text-gray-600">{item.description || 'No description'}</div>
                                            </div>
                                            <div className="shrink-0 rounded-full bg-em-red/10 p-1.5 text-em-red">
                                                <PlusIcon className="h-3.5 w-3.5" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3 space-y-2">
                                {draftItemRows.length > 0 ? (
                                    draftItemRows.map(row => (
                                        <div key={row.itemId} className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="text-xs font-black uppercase text-gray-900">{row.itemId}</div>
                                                    {row.isPinned && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase text-blue-700">Current</span>}
                                                    {!row.existsInInventory && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase text-amber-700">Manual</span>}
                                                </div>
                                                <div className="mt-1 truncate text-[11px] font-semibold uppercase text-gray-600">
                                                    {row.existsInInventory ? row.description || 'No description' : 'Not in inventory database'}
                                                </div>
                                            </div>
                                            {!row.isPinned && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeItemIdFromDraft(row.itemId)}
                                                    className="rounded-lg border border-gray-200 bg-white p-2 text-gray-400 transition-colors hover:text-red-600"
                                                    title="Remove item"
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-white px-4 py-4 text-sm font-medium text-gray-500">
                                        No PO line items added.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                <div className="shrink-0 flex flex-col gap-3 border-t border-gray-100 px-5 py-4 md:flex-row md:items-center md:justify-end">
                    <button onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-black uppercase text-gray-700 hover:bg-gray-200">
                        Cancel
                    </button>
                    <button
                        onClick={() => persistPurchaseOrder(false)}
                        disabled={isSaving}
                        className="rounded-lg border border-gray-300 bg-white px-5 py-2 text-xs font-black uppercase text-gray-700 hover:border-em-red hover:text-em-red disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Save PO
                    </button>
                    <button
                        onClick={() => persistPurchaseOrder(true)}
                        disabled={isSaving}
                        className="rounded-lg bg-em-red px-5 py-2 text-xs font-black uppercase text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Use PO
                    </button>
                </div>
            </div>
            </div>
        </div>
    );
};

export default PurchaseOrderModal;