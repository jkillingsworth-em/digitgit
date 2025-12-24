import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import MultiSelectDropdown from './MultiSelectDropdown';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface AddItemModalProps {
    onClose: () => void;
    onAddItem: (item: InventoryItem, stock: Omit<Stock, 'itemId'>[], colors?: { category?: string, subCategory?: string }) => void;
    locations: Location[];
    existingItemIds: string[];
    itemToDuplicate: InventoryItem | null;
    currentCategoryColors: Record<string, string>;
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
    onClose, onAddItem, locations, existingItemIds, itemToDuplicate, currentCategoryColors, onShowToast 
}) => {
    // Basic Info
    const [sku, setSku] = useState(itemToDuplicate ? `${itemToDuplicate.id}-COPY` : '');
    const [description, setDescription] = useState(itemToDuplicate?.description || '');
    
    // NEW HIERARCHY STATE
    const [hierarchy, setHierarchy] = useState<any>({});
    const [category, setCategory] = useState(itemToDuplicate?.category || '');
    const [subCat1, setSubCat1] = useState<string[]>(itemToDuplicate?.subCategory1 || []);
    const [subCat2, setSubCat2] = useState<string[]>(itemToDuplicate?.subCategory2 || []);
    const [subCat3, setSubCat3] = useState(itemToDuplicate?.subCategory3 || '');

    // Colors (Legacy support mostly)
    const [categoryColor, setCategoryColor] = useState(itemToDuplicate?.category ? (currentCategoryColors[itemToDuplicate.category] || '#000000') : '#000000');
    
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

    // Load Hierarchy
    useEffect(() => {
        getDoc(doc(db, 'settings', 'categoryHierarchy')).then(snap => {
            if (snap.exists()) setHierarchy(snap.data());
        });
    }, []);

    // Hierarchy Option Derivation
    const mainOptions = useMemo(() => Object.keys(hierarchy).sort(), [hierarchy]);
    
    const sub1Options = useMemo(() => {
        if (!category || !hierarchy[category]) return [];
        return Object.keys(hierarchy[category]).sort();
    }, [category, hierarchy]);

    const sub2Options = useMemo(() => {
        if (!category || subCat1.length === 0) return [];
        const opts = new Set<string>();
        subCat1.forEach(s1 => {
            const s2Obj = hierarchy[category][s1];
            if (s2Obj) Object.keys(s2Obj).forEach(k => opts.add(k));
        });
        return Array.from(opts).sort();
    }, [category, subCat1, hierarchy]);

    const sub3Options = useMemo(() => {
        if (!category || subCat1.length === 0 || subCat2.length === 0) return [];
        const opts = new Set<string>();
        subCat1.forEach(s1 => {
            subCat2.forEach(s2 => {
                const list = hierarchy[category][s1]?.[s2];
                if (Array.isArray(list)) list.forEach(k => opts.add(k));
            });
        });
        return Array.from(opts).sort();
    }, [category, subCat1, subCat2, hierarchy]);

    const calculatedAvgUsage = useMemo(() => {
        const validUsages = usageEntries.map(u => parseInt(u.usage)).filter(u => !isNaN(u));
        if (validUsages.length === 0) return 0;
        const sum = validUsages.reduce((a, b) => a + b, 0);
        return Math.round(sum / validUsages.length);
    }, [usageEntries]);

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
            subCategory1: subCat1,
            subCategory2: subCat2,
            subCategory3: subCat3,
            subCategory: subCat3 || (subCat2.length > 0 ? subCat2[0] : "") || (subCat1.length > 0 ? subCat1[0] : ""), // Legacy Fallback
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

        const colors = {
            category: category.trim() ? categoryColor : undefined,
        };

        onAddItem(newItem, initialStock, colors);
    };

    const inputLabelClass = "block text-[11px] font-bold text-gray-600 uppercase mb-1.5";
    const sectionHeaderClass = "text-sm font-bold text-slate-800 uppercase tracking-wide mb-4";

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 font-sans">
            <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl overflow-hidden animate-fade-in-down flex flex-col max-h-[95vh]">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center shrink-0">
                    <h2 className="font-bold uppercase tracking-tight text-lg text-slate-800">ADD NEW ITEM</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto space-y-8">
                    {/* Top Row: SKU & Description */}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className={inputLabelClass}>NEW ITEM ID*</label>
                            <input 
                                value={sku} 
                                onChange={e => setSku(e.target.value)}
                                className="w-full border border-gray-300 p-2.5 rounded-md text-sm uppercase font-semibold focus:ring-1 focus:ring-em-red outline-none" 
                            />
                        </div>
                        <div>
                            <label className={inputLabelClass}>DESCRIPTION*</label>
                            <input 
                                value={description} 
                                onChange={e => setDescription(e.target.value)}
                                className="w-full border border-gray-300 p-2.5 rounded-md text-sm font-medium focus:ring-1 focus:ring-em-red outline-none" 
                            />
                        </div>
                    </div>

                    {/* NEW HIERARCHY SECTION */}
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                        <h3 className={sectionHeaderClass}>CATEGORIZATION</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {/* Main Category */}
                            <div>
                                <label className={inputLabelClass}>MAIN CATEGORY (SINGLE)</label>
                                <div className="flex gap-2">
                                    <select 
                                        value={category} 
                                        onChange={e => {
                                            const newCat = e.target.value;
                                            setCategory(newCat);
                                            setSubCat1([]); setSubCat2([]); setSubCat3('');
                                            if (currentCategoryColors[newCat]) setCategoryColor(currentCategoryColors[newCat]);
                                        }}
                                        className="flex-grow border border-gray-300 p-2 rounded-md text-sm font-bold uppercase focus:ring-1 focus:ring-em-red outline-none bg-white"
                                    >
                                        <option value="">Select...</option>
                                        {mainOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <input type="color" value={categoryColor} onChange={e => setCategoryColor(e.target.value)} className="w-9 h-full p-0.5 border border-gray-300 rounded cursor-pointer shrink-0" />
                                </div>
                            </div>

                            {/* Sub 1 */}
                            <div>
                                <MultiSelectDropdown 
                                    label="SUB CATEGORY 1 (MULTI)" 
                                    options={sub1Options} 
                                    selected={subCat1} 
                                    onChange={val => { setSubCat1(val); setSubCat2([]); setSubCat3(''); }}
                                    disabled={!category}
                                    placeholder="Select Tags..."
                                />
                            </div>

                            {/* Sub 2 */}
                            <div>
                                <MultiSelectDropdown 
                                    label="SUB CATEGORY 2 (MULTI)" 
                                    options={sub2Options} 
                                    selected={subCat2} 
                                    onChange={val => { setSubCat2(val); setSubCat3(''); }}
                                    disabled={subCat1.length === 0}
                                    placeholder="Select Tags..."
                                />
                            </div>

                            {/* Sub 3 */}
                            <div>
                                <label className={inputLabelClass}>SUB CATEGORY 3 (SINGLE)</label>
                                <select 
                                    value={subCat3} 
                                    onChange={e => setSubCat3(e.target.value)}
                                    className="w-full border border-gray-300 p-2 rounded-md text-sm font-bold uppercase focus:ring-1 focus:ring-em-red outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                    disabled={subCat2.length === 0}
                                >
                                    <option value="">Select...</option>
                                    {sub3Options.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Source Selector */}
                    <div className="pt-2 border-t border-gray-100">
                        <label className={inputLabelClass}>SOURCE*</label>
                        <div className="flex gap-6 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                                <input type="radio" name="source" checked={source === 'OH'} onChange={() => setSource('OH')} className="w-4 h-4 text-em-red focus:ring-em-red border-gray-300"/>
                                ON HAND
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                                <input type="radio" name="source" checked={source === 'PO'} onChange={() => setSource('PO')} className="w-4 h-4 text-em-red focus:ring-em-red border-gray-300"/>
                                PURCHASE ORDER
                            </label>
                        </div>
                    </div>

                    {/* Initial Stock Section */}
                    <div className="pt-4 border-t border-gray-100">
                        <h3 className={sectionHeaderClass}>INITIAL STOCK</h3>
                        <div className="space-y-4">
                            {stockEntries.map((entry) => (
                                <div key={entry.id} className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex gap-4 items-end">
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>LOCATION*</label>
                                        <select 
                                            value={entry.locationId} 
                                            onChange={e => updateStockEntry(entry.id, 'locationId', e.target.value)}
                                            className="w-full border border-gray-300 p-2.5 rounded-md text-sm font-bold bg-white"
                                        >
                                            {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>DETAIL</label>
                                        <input 
                                            placeholder="SHELF OR RACK"
                                            value={entry.subLocationDetail}
                                            onChange={e => updateStockEntry(entry.id, 'subLocationDetail', e.target.value)}
                                            className="w-full border border-gray-300 p-2.5 rounded-md text-sm" 
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className={inputLabelClass}>QUANTITY*</label>
                                        <input 
                                            type="number"
                                            value={entry.quantity}
                                            onChange={e => updateStockEntry(entry.id, 'quantity', e.target.value)}
                                            className="w-full border border-gray-300 p-2.5 rounded-md text-sm font-bold" 
                                        />
                                    </div>
                                    {stockEntries.length > 1 && (
                                        <button 
                                            onClick={() => handleRemoveLocation(entry.id)}
                                            className="p-2.5 text-slate-400 hover:text-red-600"
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
                    <div className="pt-4 border-t border-gray-100">
                        <h3 className={sectionHeaderClass}>USAGE & FORECASTING</h3>
                        
                        <div className="space-y-4 mb-4">
                            {usageEntries.map((entry) => (
                                <div key={entry.id} className="flex gap-4 items-end max-w-sm">
                                    <div className="w-24">
                                        <label className={inputLabelClass}>YEAR</label>
                                        <input 
                                            type="number"
                                            placeholder="2024"
                                            value={entry.year}
                                            onChange={e => updateUsageEntry(entry.id, 'year', e.target.value)}
                                            className="w-full border border-gray-300 p-2.5 rounded-md text-sm" 
                                        />
                                    </div>
                                    <div className="flex-grow">
                                        <label className={inputLabelClass}>USAGE</label>
                                        <input 
                                            type="number"
                                            placeholder="0"
                                            value={entry.usage}
                                            onChange={e => updateUsageEntry(entry.id, 'usage', e.target.value)}
                                            className="w-full border border-gray-300 p-2.5 rounded-md text-sm font-bold" 
                                        />
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveUsageYear(entry.id)}
                                        className="p-2.5 text-slate-400 hover:text-red-600"
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
                                <label className={inputLabelClass}>CALCULATED AVG USAGE</label>
                                <input 
                                    readOnly 
                                    value={calculatedAvgUsage}
                                    className="w-full border border-gray-200 p-2.5 rounded-md text-sm font-bold bg-slate-50 text-slate-500 cursor-not-allowed" 
                                />
                            </div>
                            <div>
                                <label className={inputLabelClass}>LOW ALERT QTY</label>
                                <input 
                                    type="number"
                                    value={lowAlertQty}
                                    onChange={e => setLowAlertQty(e.target.value)}
                                    className="w-full border border-gray-300 p-2.5 rounded-md text-sm font-bold focus:ring-1 focus:ring-em-red outline-none" 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-3 shrink-0 bg-slate-50/50">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
