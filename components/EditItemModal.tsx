import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import MultiSelectDropdown from './MultiSelectDropdown';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useDb } from '../context/DbContext';

interface EditItemModalProps {
    item: InventoryItem;
    stock: Stock[];
    locations: Location[];
    onClose: () => void;
    onEditItem: (item: InventoryItem, stock: Stock[], expectedItem: InventoryItem, expectedStock: Stock[]) => Promise<void>;
    onDelete: () => void;
    onPrintSpecificLabel: (label: PrintableLabel) => void;
    fieldToFocus?: string | null;
}

type UIStock = Stock & { uiKey: number; isNew?: boolean };

interface PriorUsageEntry {
    key: number;
    year: string;
    usage: string;
}

const ALL_YEARS = [2025, 2024, 2023, 2022, 2021];

// --- Simple Calculator Component ---
const CalculatorOverlay: React.FC<{ 
    initialValue: number; 
    onConfirm: (val: number) => void; 
    onClose: () => void; 
}> = ({ initialValue, onConfirm, onClose }) => {
    const [display, setDisplay] = useState(String(initialValue));
    const [newCalculation, setNewCalculation] = useState(true);

    const handleNum = (num: string) => {
        if (newCalculation) {
            setDisplay(num);
            setNewCalculation(false);
        } else {
            setDisplay(prev => prev === '0' ? num : prev + num);
        }
    };

    const handleOp = (op: string) => {
        setDisplay(prev => prev + ' ' + op + ' ');
        setNewCalculation(false);
    };

    const calculate = () => {
        try {
            // Safe evaluation for basic math
            // eslint-disable-next-line no-new-func
            const result = Function('"use strict";return (' + display + ')')();
            const intResult = Math.round(Number(result));
            if (!isNaN(intResult) && isFinite(intResult)) {
                onConfirm(intResult < 0 ? 0 : intResult);
            } else {
                setDisplay('Error');
                setNewCalculation(true);
            }
        } catch (e) {
            setDisplay('Error');
            setNewCalculation(true);
        }
    };

    const clear = () => {
        setDisplay('0');
        setNewCalculation(true);
    };

    return (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white rounded-lg shadow-2xl border border-neutral-200 p-3 animate-fade-in-down">
            <div className="mb-2 bg-neutral-100 p-2 rounded text-right font-mono text-xl font-bold text-neutral-800 overflow-x-auto">
                {display}
            </div>
            <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={clear} className="col-span-2 bg-red-100 text-red-700 font-bold p-2 rounded hover:bg-red-200">C</button>
                <button type="button" onClick={() => handleOp('/')} className="bg-neutral-200 font-bold p-2 rounded hover:bg-neutral-300">÷</button>
                <button type="button" onClick={() => handleOp('*')} className="bg-neutral-200 font-bold p-2 rounded hover:bg-neutral-300">×</button>
                
                <button type="button" onClick={() => handleNum('7')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">7</button>
                <button type="button" onClick={() => handleNum('8')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">8</button>
                <button type="button" onClick={() => handleNum('9')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">9</button>
                <button type="button" onClick={() => handleOp('-')} className="bg-neutral-200 font-bold p-2 rounded hover:bg-neutral-300">-</button>
                
                <button type="button" onClick={() => handleNum('4')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">4</button>
                <button type="button" onClick={() => handleNum('5')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">5</button>
                <button type="button" onClick={() => handleNum('6')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">6</button>
                <button type="button" onClick={() => handleOp('+')} className="bg-neutral-200 font-bold p-2 rounded hover:bg-neutral-300">+</button>
                
                <button type="button" onClick={() => handleNum('1')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">1</button>
                <button type="button" onClick={() => handleNum('2')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">2</button>
                <button type="button" onClick={() => handleNum('3')} className="bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">3</button>
                <button type="button" onClick={calculate} className="row-span-2 bg-green-600 text-white font-bold p-2 rounded hover:bg-green-700">=</button>
                
                <button type="button" onClick={() => handleNum('0')} className="col-span-2 bg-white border border-neutral-200 font-bold p-2 rounded hover:bg-neutral-50">0</button>
                <button type="button" onClick={onClose} className="bg-neutral-100 text-black font-bold p-2 rounded hover:bg-neutral-200 text-xs">X</button>
            </div>
        </div>
    );
};

const EditItemModal: React.FC<EditItemModalProps> = ({ item, stock, locations, onClose, onEditItem, onDelete, onPrintSpecificLabel, fieldToFocus }) => {
    const db = useDb();
    const initialItem = useRef(item);
    const initialStock = useRef(stock);
    const [saveError, setSaveError] = useState<string | null>(null);
    // Refs for focusing
    const descriptionRef = useRef<HTMLInputElement>(null);
    const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
    
    // Item details state
    const [description, setDescription] = useState(item.description);
    
    // HIERARCHY STATE
    const [hierarchy, setHierarchy] = useState<any>({});
    const [category, setCategory] = useState(item.category || '');
    const [subCat1, setSubCat1] = useState<string[]>(item.subCategory1 || []);
    const [subCat2, setSubCat2] = useState<string[]>(item.subCategory2 || []);
    const [subCat3, setSubCat3] = useState(item.subCategory3 || '');

    // Forecasting fields
    const [priorUsage, setPriorUsage] = useState<PriorUsageEntry[]>(
        () => item.priorUsage?.map((u, i) => ({
            key: Date.now() + i,
            year: String(u.year),
            usage: String(u.usage)
        })) || []
    );
    const [lowAlertQuantity, setLowAlertQuantity] = useState(String(item.lowAlertQuantity ?? ''));

    // Stock state
    const [localStock, setLocalStock] = useState<UIStock[]>(() => stock.map((s, i) => ({ ...s, uiKey: Date.now() + i })));

    // Calculator State
    const [activeCalcId, setActiveCalcId] = useState<number | null>(null);

    // Save State
    const [isSaving, setIsSaving] = useState(false);

    // Categories created from this panel; saved to the shared list together with the item.
    const [hasNewCategories, setHasNewCategories] = useState(false);

    // Load Hierarchy
    useEffect(() => {
        getDoc(doc(db, 'settings', 'categoryHierarchy')).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                setHierarchy(data && typeof data === 'object' ? data : {});
            }
        });
    }, [db]);

    const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
    
    const existingLocationIds = useMemo(() => new Set(localStock.map(s => s.locationId)), [localStock]);
    const availableLocations = useMemo(() => locations.filter(l => !existingLocationIds.has(l.id)), [locations, existingLocationIds]);

    const totalQuantity = useMemo(() => localStock.reduce((sum, s) => sum + s.quantity, 0), [localStock]);

    // Hierarchy Options Logic (Same as AddItemModal)
    const mainOptions = useMemo(() => Object.keys(hierarchy || {}).sort(), [hierarchy]);
    
    const sub1Options = useMemo(() => {
        const categoryNode = hierarchy?.[category];
        if (!category || !categoryNode || typeof categoryNode !== 'object') return [];
        return Object.keys(categoryNode).sort();
    }, [category, hierarchy]);

    const sub2Options = useMemo(() => {
        if (!category || subCat1.length === 0) return [];
        const categoryNode = hierarchy?.[category];
        if (!categoryNode || typeof categoryNode !== 'object') return [];
        const opts = new Set<string>();
        subCat1.forEach(s1 => {
            const s2Obj = categoryNode[s1];
            if (s2Obj) Object.keys(s2Obj).forEach(k => opts.add(k));
        });
        return Array.from(opts).sort();
    }, [category, subCat1, hierarchy]);

    const sub3Options = useMemo(() => {
        if (!category || subCat1.length === 0 || subCat2.length === 0) return [];
        const categoryNode = hierarchy?.[category];
        if (!categoryNode || typeof categoryNode !== 'object') return [];
        const opts = new Set<string>();
        subCat1.forEach(s1 => {
            subCat2.forEach(s2 => {
                const list = categoryNode[s1]?.[s2];
                if (Array.isArray(list)) list.forEach(k => opts.add(k));
            });
        });
        return Array.from(opts).sort();
    }, [category, subCat1, subCat2, hierarchy]);
    
    const addCategoryValue = (level: 'main' | 'sub1' | 'sub2' | 'sub3') => {
        const label = { main: 'main category', sub1: 'Sub 1 tag', sub2: 'Sub 2 tag', sub3: 'Sub 3 value' }[level];
        const value = window.prompt(`Name of the new ${label}`)?.trim();
        if (!value) return;
        const next = JSON.parse(JSON.stringify(hierarchy || {}));
        if (level === 'main') {
            if (!next[value] || typeof next[value] !== 'object') next[value] = {};
            setCategory(value); setSubCat1([]); setSubCat2([]); setSubCat3('');
        } else if (level === 'sub1') {
            if (!next[category] || typeof next[category] !== 'object') next[category] = {};
            if (!next[category][value] || typeof next[category][value] !== 'object') next[category][value] = {};
            setSubCat1(prev => (prev.includes(value) ? prev : [...prev, value])); setSubCat2([]); setSubCat3('');
        } else if (level === 'sub2') {
            subCat1.forEach(s1 => {
                if (!next[category]?.[s1] || typeof next[category][s1] !== 'object' || Array.isArray(next[category][s1])) return;
                if (!Array.isArray(next[category][s1][value])) next[category][s1][value] = [];
            });
            setSubCat2(prev => (prev.includes(value) ? prev : [...prev, value])); setSubCat3('');
        } else {
            subCat1.forEach(s1 => subCat2.forEach(s2 => {
                const list = next[category]?.[s1]?.[s2];
                if (Array.isArray(list) && !list.includes(value)) list.push(value);
            }));
            setSubCat3(value);
        }
        setHierarchy(next);
        setHasNewCategories(true);
    };

    // Deep merge: objects merge key by key, lists are combined without duplicates.
    const mergeHierarchy = (base: any, extra: any): any => {
        if (Array.isArray(base) && Array.isArray(extra)) return Array.from(new Set([...base, ...extra]));
        if (base && extra && typeof base === 'object' && typeof extra === 'object' && !Array.isArray(base) && !Array.isArray(extra)) {
            const out: any = { ...base };
            Object.keys(extra).forEach(key => { out[key] = key in base ? mergeHierarchy(base[key], extra[key]) : extra[key]; });
            return out;
        }
        return base ?? extra;
    };

    const averageUsage = useMemo(() => {
        if (priorUsage.length === 0) return 0;
        const validEntries = priorUsage
            .map(u => parseInt(u.usage, 10))
            .filter(u => !isNaN(u));
        if (validEntries.length === 0) return 0;
        const total = validEntries.reduce((sum, u) => sum + u, 0);
        return total / validEntries.length;
    }, [priorUsage]);

    const etr = useMemo(() => {
        if (averageUsage > 0 && totalQuantity > 0) {
            const monthlyAvg = averageUsage / 12;
            if (monthlyAvg > 0) {
                 return `${(totalQuantity / monthlyAvg).toFixed(1)} MONTHS`;
            }
        }
        return 'N/A';
    }, [totalQuantity, averageUsage]);

    useEffect(() => {
        setTimeout(() => {
            switch (fieldToFocus) {
                case 'description': descriptionRef.current?.focus(); break;
                case 'quantity':
                    const firstStockLocationId = stock.length > 0 ? stock[0].locationId : null;
                    if (firstStockLocationId) {
                        quantityInputRefs.current.get(firstStockLocationId)?.focus();
                    }
                    break;
                default: break;
            }
        }, 100); 
    }, [fieldToFocus, stock]);

    const handleStockChange = (uiKey: number, field: keyof Stock, value: string | number) => {
        setLocalStock(prevStock => 
            prevStock.map(s => s.uiKey === uiKey ? { ...s, [field]: value } : s)
        );
    };

    const handleAddStockEntry = () => {
        setLocalStock(prev => [
            ...prev,
            {
                uiKey: Date.now(),
                itemId: item.id,
                locationId: '',
                quantity: 0,
                subLocationDetail: '',
                source: 'OH',
                isNew: true
            }
        ]);
    };

    const handleRemoveStockEntry = (uiKey: number) => {
        setLocalStock(prev => prev.filter(s => s.uiKey !== uiKey));
    };

    const handleAddUsage = () => {
        if (priorUsage.length < 3) {
            setPriorUsage(prev => [...prev, { key: Date.now(), year: '', usage: '' }]);
        }
    };

    const handleRemoveUsage = (key: number) => {
        setPriorUsage(prev => prev.filter(u => u.key !== key));
    };

    const handleUsageChange = (key: number, field: 'year' | 'usage', value: string) => {
        setPriorUsage(prev => prev.map(u => u.key === key ? { ...u, [field]: value } : u));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving) return;

        if (!description.trim()) {
            alert('Description cannot be empty.');
            return;
        }

        const invalidNewEntry = localStock.find(s => s.isNew && (!s.locationId || s.quantity <= 0));
        if (invalidNewEntry) {
            alert('Please select a location and enter a quantity greater than 0 for all new stock entries.');
            return;
        }
        
        setIsSaving(true);
        setSaveError(null);

        const formattedUsage = priorUsage
            .map(u => ({ year: parseInt(u.year, 10), usage: parseInt(u.usage, 10) }))
            .filter(u => !isNaN(u.year) && u.year > 0 && !isNaN(u.usage));

        const lowAlertNum = parseInt(lowAlertQuantity, 10);
        const finalStock = localStock.map(({ uiKey, isNew, ...restOfStock }) => restOfStock);

        try {
        if (hasNewCategories) {
            const ref = doc(db, 'settings', 'categoryHierarchy');
            const fresh = await getDoc(ref);
            const current = fresh.exists() && fresh.data() && typeof fresh.data() === 'object' ? fresh.data() : {};
            await setDoc(ref, mergeHierarchy(current, hierarchy || {}));
        }
        await onEditItem(
            {
                ...item,
                description: description.trim(),
                category: category.trim(),
                subCategory1: subCat1,
                subCategory2: subCat2,
                subCategory3: subCat3,
                subCategory: subCat3 || (subCat2.length > 0 ? subCat2[0] : "") || (subCat1.length > 0 ? subCat1[0] : ""), // Legacy
                priorUsage: formattedUsage.length > 0 ? formattedUsage : undefined,
                lowAlertQuantity: !isNaN(lowAlertNum) ? lowAlertNum : undefined
            },
            finalStock,
            initialItem.current,
            initialStock.current
        );
        } catch (error) {
            setSaveError(error instanceof Error ? error.message : 'Could not save this item.');
        } finally {
            setIsSaving(false);
        }
    };

    const alertColorClass = useMemo(() => {
        if (lowAlertQuantity.trim() === '') return '';
        const lowAlertNum = parseInt(lowAlertQuantity, 10);
        if (isNaN(lowAlertNum)) return '';
        return totalQuantity <= lowAlertNum ? 'text-red-600 font-bold' : 'text-green-600';
    }, [lowAlertQuantity, totalQuantity]);

    // z-[110]: above Inventory Management (z-[100]) and other primary overlays; below print/barcode sheets (z-[140])
    return (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/40">
            <div className="flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl animate-fade-in-down" role="dialog" aria-modal="true" aria-label={`Edit ${item.id}`}>
                <form onSubmit={handleSubmit} className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
                        <div className="min-w-0">
                            <span className="rounded bg-neutral-100 px-2 py-0.5 font-mono text-[13px] text-em-ink">{item.id}</span>
                            <h2 className="!mb-0 mt-1.5 truncate text-lg font-semibold text-em-ink">{item.description || 'Edit item'}</h2>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-em-ink">
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto p-6">
                        {saveError && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm font-bold text-red-800">{saveError}</div>}
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Item ID</label>
                                <input type="text" value={item.id} readOnly className="form-control bg-neutral-100 cursor-not-allowed font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 mb-1.5">Description*</label>
                                <input ref={descriptionRef} type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="form-control font-medium" required />
                            </div>
                            
                            {/* Hierarchy Grid */}
                            <div className="bg-neutral-50 p-5 rounded-xl border border-neutral-100">
                                <h3 className="text-sm font-bold text-neutral-800 tracking-wide mb-4">Categorization</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-600 mb-1.5">Main category</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={category}
                                                onChange={(e) => {
                                                    setCategory(e.target.value);
                                                    setSubCat1([]); setSubCat2([]); setSubCat3('');
                                                }}
                                                className="flex-grow border border-neutral-300 p-2 rounded-md text-sm font-bold focus:ring-1 focus:ring-em-red outline-none bg-white"
                                            >
                                                <option value="">Select...</option>
                                                {mainOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <MultiSelectDropdown 
                                            label="Sub 1 (tags)" 
                                            options={sub1Options} 
                                            selected={subCat1} 
                                            onChange={val => { setSubCat1(val); setSubCat2([]); setSubCat3(''); }}
                                            disabled={!category}
                                        />
                                    </div>

                                    <div>
                                        <MultiSelectDropdown 
                                            label="Sub 2 (tags)" 
                                            options={sub2Options} 
                                            selected={subCat2} 
                                            onChange={val => { setSubCat2(val); setSubCat3(''); }}
                                            disabled={subCat1.length === 0}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-neutral-600 mb-1.5">Sub 3 (specific)</label>
                                        <select 
                                            value={subCat3} 
                                            onChange={e => setSubCat3(e.target.value)}
                                            className="w-full border border-neutral-300 p-2 rounded-md text-sm font-bold focus:ring-1 focus:ring-em-red outline-none bg-white disabled:bg-neutral-100 disabled:text-neutral-400"
                                            disabled={subCat2.length === 0}
                                        >
                                            <option value="">Select...</option>
                                            {sub3Options.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-3 text-xs">
                                    <span className="font-semibold text-neutral-600">Missing one? Create a new</span>
                                    {([
                                        ['main', 'Main category', false],
                                        ['sub1', 'Sub 1 tag', !category],
                                        ['sub2', 'Sub 2 tag', subCat1.length === 0],
                                        ['sub3', 'Sub 3 value', subCat2.length === 0],
                                    ] as const).map(([level, text, disabled]) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => addCategoryValue(level)}
                                            disabled={disabled}
                                            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-neutral-400 px-2.5 font-medium text-neutral-700 hover:border-em-red hover:text-em-red disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            <PlusIcon className="h-3.5 w-3.5" />{text}
                                        </button>
                                    ))}
                                    {hasNewCategories && <span className="w-full text-amber-800">New categories are added to the shared list when you save.</span>}
                                </div>
                            </div>
                                                        
                            <div className="form-section pt-4 border-t border-neutral-100">
                                <h3 className="text-sm font-bold text-neutral-800 mb-3">Stock Levels by Location</h3>
                                <div className="space-y-3">
                                    {localStock.length > 0 ? localStock.map(s => {
                                        const selectedLocation = locationMap.get(s.locationId);
                                        return (
                                            <div key={s.uiKey} className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                                                <div className="sm:col-span-1">
                                                    <label className="text-xs font-bold text-neutral-500 ">Location</label>
                                                    {s.isNew ? (
                                                        <select
                                                            value={s.locationId}
                                                            onChange={e => handleStockChange(s.uiKey, 'locationId', e.target.value)}
                                                            className="form-control text-sm py-1 mt-1"
                                                        >
                                                            <option value="" disabled>Select...</option>
                                                            {availableLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                                        </select>
                                                    ) : (
                                                        <div className="text-sm font-bold text-neutral-800 mt-1 ">{selectedLocation?.name || s.locationId}</div>
                                                    )}
                                                </div>

                                                <div className="sm:col-span-1">
                                                    <label className="text-xs font-bold text-neutral-500 ">Sub-Location</label>
                                                    <input
                                                        type="text"
                                                        value={s.subLocationDetail || ''}
                                                        onChange={e => handleStockChange(s.uiKey, 'subLocationDetail', e.target.value)}
                                                        className="form-control text-sm py-1 mt-1"
                                                        placeholder={selectedLocation?.subLocationPrompt || '-'}
                                                    />
                                                    <p className="mt-1 text-xs font-medium text-neutral-500 normal-case">Use for exact storage position (shelf/bin/rack).</p>
                                                </div>

                                                <div className="sm:col-span-1 relative">
                                                    <label className="text-xs font-bold text-neutral-500 ">Quantity</label>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            ref={el => { quantityInputRefs.current.set(s.locationId, el); }}
                                                            type="number"
                                                            min="0"
                                                            value={s.quantity}
                                                            onChange={(e) => handleStockChange(s.uiKey, 'quantity', parseInt(e.target.value, 10) || 0)}
                                                            className="form-control text-sm py-1 mt-1 font-bold"
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setActiveCalcId(s.uiKey)}
                                                            className="mt-1 p-1 bg-neutral-200 hover:bg-neutral-300 rounded text-black text-xs font-bold"
                                                        >
                                                            =
                                                        </button>
                                                    </div>
                                                    {activeCalcId === s.uiKey && (
                                                        <CalculatorOverlay 
                                                            initialValue={s.quantity} 
                                                            onClose={() => setActiveCalcId(null)}
                                                            onConfirm={(val) => { handleStockChange(s.uiKey, 'quantity', val); setActiveCalcId(null); }}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-end gap-1 pb-1">
                                                    <button type="button" onClick={() => {
                                                        const location = locationMap.get(s.locationId);
                                                        if (location) onPrintSpecificLabel({ itemId: item.id, description: description, locationName: location.name, subLocationDetail: s.subLocationDetail });
                                                    }} className="text-neutral-400 hover:text-black p-1" title="Print Label">
                                                        <PrinterIcon className="w-5 h-5" />
                                                    </button>
                                                    <button type="button" onClick={() => handleRemoveStockEntry(s.uiKey)} className="text-red-400 hover:text-red-600 p-1" title="Delete">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    }) : <p className="text-xs text-neutral-400 italic text-center py-2">No stock records. Add one below.</p>}

                                     <button
                                        type="button"
                                        onClick={handleAddStockEntry}
                                        disabled={availableLocations.length === 0}
                                        className="flex items-center text-xs font-bold text-em-red hover:text-red-800 disabled:text-neutral-400 disabled:cursor-not-allowed mt-2"
                                    >
                                        <PlusIcon className="w-4 h-4 mr-1" />
                                        ADD STOCK LOCATION
                                    </button>
                                </div>
                            </div>

                            <div className="form-section pt-4 border-t border-neutral-100">
                                <h3 className="text-sm font-bold text-neutral-800 mb-3">Usage & Forecasting</h3>
                                <div className="space-y-2">
                                    {priorUsage.map((entry) => {
                                        const selectedYears = new Set(priorUsage.filter(p => p.key !== entry.key).map(p => p.year));
                                        const availableYears = ALL_YEARS.filter(y => !selectedYears.has(String(y)));
                                        return (
                                            <div key={entry.key} className="flex gap-3 items-end max-w-sm">
                                                <div className="w-24">
                                                    <label className="text-xs font-bold text-neutral-500 ">Year</label>
                                                    <select value={entry.year} onChange={e => handleUsageChange(entry.key, 'year', e.target.value)} className="form-control text-sm py-1 mt-1">
                                                        <option value="" disabled>...</option>
                                                        {entry.year && <option value={entry.year}>{entry.year}</option>}
                                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-grow">
                                                    <label className="text-xs font-bold text-neutral-500 ">Usage</label>
                                                    <input type="number" value={entry.usage} onChange={e => handleUsageChange(entry.key, 'usage', e.target.value)} className="form-control text-sm py-1 mt-1" />
                                                </div>
                                                <button type="button" onClick={() => handleRemoveUsage(entry.key)} className="text-red-400 hover:text-red-600 p-2 mb-0.5">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {priorUsage.length < 3 && (
                                        <button type="button" onClick={handleAddUsage} className="flex items-center text-xs font-bold text-em-red hover:text-red-800 mt-2">
                                            <PlusIcon className="w-3 h-3 mr-1" /> Add Year
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 ">Avg usage</label>
                                        <input type="number" value={Math.round(averageUsage) || ''} readOnly className="form-control mt-1 bg-neutral-100 cursor-not-allowed font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-neutral-500 ">Low alert</label>
                                        <input type="number" value={lowAlertQuantity} onChange={(e) => setLowAlertQuantity(e.target.value)} className={`form-control mt-1 font-bold ${alertColorClass}`} />
                                    </div>
                                    <div className="bg-neutral-50 p-2 rounded text-center flex flex-col justify-center">
                                        <span className="text-xs font-bold text-neutral-500 ">Est. Remaining</span>
                                        <span className="text-lg font-bold text-neutral-900">{etr}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-neutral-200 bg-em-page px-6 py-3.5">
                        <button type="button" onClick={onDelete} disabled={isSaving} className="text-red-600 hover:text-red-800 font-bold text-xs flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 transition-colors">
                            <TrashIcon className="w-4 h-4" /> Delete item
                        </button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} disabled={isSaving} className="h-10 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">Cancel</button>
                            <button type="submit" disabled={isSaving} className="flex h-10 items-center rounded-md bg-em-red px-5 text-sm font-semibold text-white hover:bg-em-red-dark disabled:opacity-70">
                                {isSaving ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditItemModal;
