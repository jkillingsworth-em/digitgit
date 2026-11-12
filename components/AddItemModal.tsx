import React, { useState, useMemo } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';

interface AddItemModalProps {
    onClose: () => void;
    onAddItem: (item: InventoryItem, stock: Omit<Stock, 'itemId'>[]) => void;
    locations: Location[];
    existingItemIds: string[];
    itemToDuplicate: InventoryItem | null;
    availableCategories?: string[];
    onShowToast: (message: string, type: 'success' | 'error') => void;
}

interface StockEntry {
    id: string;
    locationId: string;
    subLocationDetail: string;
    quantity: string;
}

interface UsageEntry {
    id: string;
    year: string;
    usage: string;
}

const AddItemModal: React.FC<AddItemModalProps> = ({ 
    onClose, onAddItem, locations, existingItemIds, itemToDuplicate, availableCategories, onShowToast 
}) => {
    // Basic Info
    const [sku, setSku] = useState(itemToDuplicate ? `${itemToDuplicate.id}-COPY` : '');
    const [description, setDescription] = useState(itemToDuplicate?.description || '');
    const [category, setCategory] = useState(itemToDuplicate?.category || '');
    const [subCategory, setSubCategory] = useState(itemToDuplicate?.subCategory || '');
    
    // Source
    const [source, setSource] = useState<'OH' | 'PO'>('OH');

    // Stock Locations
    const [stockEntries, setStockEntries] = useState<StockEntry[]>([
        { id: Math.random().toString(), locationId: locations[0]?.id || '', subLocationDetail: '', quantity: '' }
    ]);

    // Usage History
    const [usageEntries, setUsageEntries] = useState<UsageEntry[]>(
        itemToDuplicate?.priorUsage?.map(u => ({ id: Math.random().toString(), year: u.year.toString(), usage: u.usage.toString() })) || []
    );
    const [lowAlertQty, setLowAlertQty] = useState(itemToDuplicate?.lowAlertQuantity?.toString() || '');

    const calculatedAvgUsage = useMemo(() => {
        const validUsages = usageEntries.map(u => parseInt(u.usage)).filter(u => !isNaN(u));
        if (validUsages.length === 0) return 0;
        const sum = validUsages.reduce((a, b) => a + b, 0);
        return Math.round(sum / validUsages.length);
    }, [usageEntries]);

    // Combine provided categories with any stored colors (legacy)
    const categoryOptions = useMemo(() => {
        const set = new Set<string>();
        if (Array.isArray(availableCategories)) {
            availableCategories.forEach(cat => set.add(cat));
        }
        if (itemToDuplicate?.category) set.add(itemToDuplicate.category);
        return Array.from(set).sort();
    }, [availableCategories, itemToDuplicate?.category]);

    const handleAddLocation = () => {
        setStockEntries([...stockEntries, { id: Math.random().toString(), locationId: locations[0]?.id || '', subLocationDetail: '', quantity: '' }]);
    };

    const handleRemoveLocation = (id: string) => {
        if (stockEntries.length > 1) {
            setStockEntries(stockEntries.filter(e => e.id !== id));
        }
    };

    const updateStockEntry = (id: string, field: keyof StockEntry, value: string) => {
        setStockEntries(stockEntries.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const handleAddUsageYear = () => {
        setUsageEntries([...usageEntries, { id: Math.random().toString(), year: '', usage: '' }]);
    };

    const handleRemoveUsageYear = (id: string) => {
        setUsageEntries(usageEntries.filter(e => e.id !== id));
    };

    const updateUsageEntry = (id: string, field: keyof UsageEntry, value: string) => {
        setUsageEntries(usageEntries.map(e => e.id === id ? { ...e, [field]: value } : e));
    };

    const handleSave = () => {
        const cleanSku = sku.trim().toUpperCase();
        if (!cleanSku) return onShowToast("NEW ITEM ID is required.", "error");
        if (!description.trim()) return onShowToast("DESCRIPTION is required.", "error");
        if (existingItemIds.includes(cleanSku)) return onShowToast("SKU already exists.", "error");

        const hasInvalidStock = stockEntries.some(s => !s.locationId || !s.quantity || isNaN(parseInt(s.quantity)));
        if (hasInvalidStock) return onShowToast("Please check all stock entries.", "error");

        const newItem: InventoryItem = {
            id: cleanSku,
            name: description.trim(), 
            description: description.trim(),
            category: category.trim(),
            subCategory: subCategory.trim(),
            lowAlertQuantity: lowAlertQty ? parseInt(lowAlertQty) : undefined,
            priorUsage: usageEntries
                .map(u => ({ year: parseInt(u.year), usage: parseInt(u.usage) }))
                .filter(u => !isNaN(u.year) && !isNaN(u.usage))
        };

        const initialStock: Omit<Stock, 'itemId'>[] = stockEntries.map(s => ({
            locationId: s.locationId,
            quantity: parseInt(s.quantity),
            subLocationDetail: s.subLocationDetail,
            source: source
        }));

        onAddItem(newItem, initialStock);
    };

    const inputLabelClass = "block text-xs font-bold text-neutral-600  mb-1.5";
    const sectionHeaderClass = "text-sm font-bold text-neutral-800  tracking-wide mb-4";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 font-sans">
            <div className="bg-white w-full max-w-2xl rounded-lg shadow-2xl overflow-hidden animate-fade-in-down flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="border-b border-neutral-200 px-6 py-4 flex justify-between items-center shrink-0">
                    <h2 className="font-bold tracking-tight text-lg text-neutral-800">Add new item</h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* Top Row: SKU & Description */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className={inputLabelClass}>New item ID*</label>
                            <input 
                                value={sku} 
                                onChange={e => setSku(e.target.value)}
                                className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-semibold focus:ring-1 focus:ring-em-red outline-none" 
                            />
                        </div>
                        <div>
                            <label className={inputLabelClass}>Description*</label>
                            <input 
                                value={description} 
                                onChange={e => setDescription(e.target.value)}
                                className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-medium focus:ring-1 focus:ring-em-red outline-none" 
                            />
                        </div>
                    </div>

                    {/* Category & Sub-Category */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className={inputLabelClass}>Category</label>
                            <div className="flex-grow flex items-center gap-2">
                                    <select 
                                        value={category} 
                                        onChange={e => setCategory(e.target.value)}
                                        className="flex-grow border border-neutral-300 p-2.5 rounded-md text-sm font-medium focus:ring-1 focus:ring-em-red outline-none bg-white" 
                                    >
                                        <option value="">Select Category...</option>
                                        {categoryOptions.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button"
                                        onClick={() => window.location.href = '/admin/categories'}
                                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-700 p-2.5 rounded-md border border-neutral-300 transition-colors"
                                        title="Manage Categories"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                    </button>
                            </div>
                        </div>
                        <div>
                            <label className={inputLabelClass}>Sub-category</label>
                            <div>
                                <input 
                                    value={subCategory} 
                                    onChange={e => setSubCategory(e.target.value)}
                                    className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-medium focus:ring-1 focus:ring-em-red outline-none" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Source Selector */}
                    <div className="pt-2 border-t border-neutral-100">
                        <label className={inputLabelClass}>Source*</label>
                        <div className="flex gap-6 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-neutral-700">
                                <input 
                                    type="radio" 
                                    name="source" 
                                    checked={source === 'OH'} 
                                    onChange={() => setSource('OH')}
                                    className="w-4 h-4 text-em-red focus:ring-em-red border-neutral-300"
                                />
                                ON HAND
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-neutral-700">
                                <input 
                                    type="radio" 
                                    name="source" 
                                    checked={source === 'PO'} 
                                    onChange={() => setSource('PO')}
                                    className="w-4 h-4 text-em-red focus:ring-em-red border-neutral-300"
                                />
                                PURCHASE ORDER
                            </label>
                        </div>
                    </div>

                    {/* Initial Stock Section */}
                    <div className="pt-4 border-t border-neutral-100">
                        <h3 className={sectionHeaderClass}>Initial stock</h3>
                        <div className="space-y-4">
                            {stockEntries.map((entry) => (
                                <div key={entry.id} className="bg-neutral-50 p-4 rounded-lg border border-neutral-100 flex gap-4 items-end">
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>Location*</label>
                                        <select 
                                            value={entry.locationId} 
                                            onChange={e => updateStockEntry(entry.id, 'locationId', e.target.value)}
                                            className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-bold bg-white"
                                        >
                                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>Sub-location</label>
                                        <input 
                                            placeholder="Shelf / bin / rack"
                                            value={entry.subLocationDetail}
                                            onChange={e => updateStockEntry(entry.id, 'subLocationDetail', e.target.value)}
                                            className="w-full border border-neutral-300 p-2.5 rounded-md text-sm" 
                                        />
                                        <p className="mt-1 text-xs font-medium text-neutral-500 normal-case">Use for exact storage position inside this location.</p>
                                    </div>
                                    <div className="w-24">
                                        <label className={inputLabelClass}>Quantity*</label>
                                        <input 
                                            type="number"
                                            value={entry.quantity}
                                            onChange={e => updateStockEntry(entry.id, 'quantity', e.target.value)}
                                            className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-bold" 
                                        />
                                    </div>
                                    {stockEntries.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveLocation(entry.id)}
                                            className="p-2.5 text-neutral-400 hover:text-red-600"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleAddLocation}
                            className="mt-4 flex items-center gap-1.5 text-sm font-bold text-em-red hover:text-red-700 transition-colors"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Another Location
                        </button>
                    </div>

                    {/* Usage & Forecasting */}
                    <div className="pt-4 border-t border-neutral-100">
                        <h3 className={sectionHeaderClass}>Usage & forecasting</h3>
                        
                        <div className="space-y-4 mb-4">
                            {usageEntries.map((entry) => (
                                <div key={entry.id} className="flex gap-4 items-end max-w-sm">
                                    <div className="w-24">
                                        <label className={inputLabelClass}>Year</label>
                                        <input 
                                            type="number"
                                            placeholder="2024"
                                            value={entry.year}
                                            onChange={e => updateUsageEntry(entry.id, 'year', e.target.value)}
                                            className="w-full border border-neutral-300 p-2.5 rounded-md text-sm" 
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>Usage</label>
                                        <input 
                                            type="number"
                                            placeholder="0"
                                            value={entry.usage}
                                            onChange={e => updateUsageEntry(entry.id, 'usage', e.target.value)}
                                            className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-bold" 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveUsageYear(entry.id)}
                                        className="p-2.5 text-neutral-400 hover:text-red-600"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleAddUsageYear}
                            className="flex items-center gap-1.5 text-sm font-bold text-em-red hover:text-red-700 transition-colors mb-6"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Add Usage Year
                        </button>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className={inputLabelClass}>Calculated avg usage</label>
                                <input 
                                    readOnly 
                                    value={calculatedAvgUsage}
                                    className="w-full border border-neutral-200 p-2.5 rounded-md text-sm font-bold bg-neutral-50 text-neutral-500 cursor-not-allowed" 
                                />
                            </div>
                            <div>
                                <label className={inputLabelClass}>Low alert QTY</label>
                                <input 
                                    type="number"
                                    value={lowAlertQty}
                                    onChange={e => setLowAlertQty(e.target.value)}
                                    className="w-full border border-neutral-300 p-2.5 rounded-md text-sm font-bold focus:ring-1 focus:ring-em-red outline-none" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-neutral-100 px-6 py-4 flex justify-end gap-3 shrink-0 bg-neutral-50/50">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="px-8 py-2.5 text-sm font-bold text-white bg-em-red rounded-md shadow-md hover:bg-red-700 transition-colors"
                    >
                        Add Item
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddItemModal;
