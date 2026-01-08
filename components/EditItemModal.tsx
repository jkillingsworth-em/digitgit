import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import MultiSelectDropdown from './MultiSelectDropdown';
import { doc, getDoc } from 'firebase/firestore';
import { useDb } from '../context/DbContext';

interface EditItemModalProps {
    item: InventoryItem;
    stock: Stock[];
    locations: Location[];
    onClose: () => void;
    onEditItem: (item: InventoryItem, stock: Stock[], colors?: { category?: string, subCategory?: string }) => void;
    onDelete: () => void;
    onPrintSpecificLabel: (label: PrintableLabel) => void;
    currentCategoryColors: Record<string, string>;
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
        <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white rounded-lg shadow-2xl border border-gray-200 p-3 animate-fade-in-down">
            <div className="mb-2 bg-gray-100 p-2 rounded text-right font-mono text-xl font-bold text-gray-800 overflow-x-auto">
                {display}
            </div>
            <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={clear} className="col-span-2 bg-red-100 text-red-700 font-bold p-2 rounded hover:bg-red-200">C</button>
                <button type="button" onClick={() => handleOp('/')} className="bg-gray-200 font-bold p-2 rounded hover:bg-gray-300">÷</button>
                <button type="button" onClick={() => handleOp('*')} className="bg-gray-200 font-bold p-2 rounded hover:bg-gray-300">×</button>
                
                <button type="button" onClick={() => handleNum('7')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">7</button>
                <button type="button" onClick={() => handleNum('8')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">8</button>
                <button type="button" onClick={() => handleNum('9')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">9</button>
                <button type="button" onClick={() => handleOp('-')} className="bg-gray-200 font-bold p-2 rounded hover:bg-gray-300">-</button>
                
                <button type="button" onClick={() => handleNum('4')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">4</button>
                <button type="button" onClick={() => handleNum('5')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">5</button>
                <button type="button" onClick={() => handleNum('6')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">6</button>
                <button type="button" onClick={() => handleOp('+')} className="bg-gray-200 font-bold p-2 rounded hover:bg-gray-300">+</button>
                
                <button type="button" onClick={() => handleNum('1')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">1</button>
                <button type="button" onClick={() => handleNum('2')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">2</button>
                <button type="button" onClick={() => handleNum('3')} className="bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">3</button>
                <button type="button" onClick={calculate} className="row-span-2 bg-green-600 text-white font-bold p-2 rounded hover:bg-green-700">=</button>
                
                <button type="button" onClick={() => handleNum('0')} className="col-span-2 bg-white border border-gray-200 font-bold p-2 rounded hover:bg-gray-50">0</button>
                <button type="button" onClick={onClose} className="bg-gray-100 text-black font-bold p-2 rounded hover:bg-gray-200 text-xs">X</button>
            </div>
        </div>
    );
};

const EditItemModal: React.FC<EditItemModalProps> = ({ item, stock, locations, onClose, onEditItem, onDelete, onPrintSpecificLabel, currentCategoryColors, fieldToFocus }) => {
    const db = useDb();
    
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

    // Color state
    const [categoryColor, setCategoryColor] = useState(
        (item.category && currentCategoryColors[item.category]) || '#000000'
    );
    
    // Stock state
    const [localStock, setLocalStock] = useState<UIStock[]>(() => stock.map((s, i) => ({ ...s, uiKey: Date.now() + i })));

    // Calculator State
    const [activeCalcId, setActiveCalcId] = useState<number | null>(null);

    // Save State
    const [isSaving, setIsSaving] = useState(false);

    // Load Hierarchy
    useEffect(() => {
        getDoc(doc(db, 'settings', 'categoryHierarchy')).then(snap => {
            if (snap.exists()) setHierarchy(snap.data());
        });
    }, [db]);

    const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
    
    const existingLocationIds = useMemo(() => new Set(localStock.map(s => s.locationId)), [localStock]);
    const availableLocations = useMemo(() => locations.filter(l => !existingLocationIds.has(l.id)), [locations, existingLocationIds]);

    const totalQuantity = useMemo(() => localStock.reduce((sum, s) => sum + s.quantity, 0), [localStock]);

    // Hierarchy Options Logic (Same as AddItemModal)
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
        if (category && currentCategoryColors[category]) {
            setCategoryColor(currentCategoryColors[category]);
        }
    }, [category, currentCategoryColors]);
    
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

    const handleSubmit = (e: React.FormEvent) => {
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
        const colorsToSave: { category?: string } = {};
        if (category.trim()) colorsToSave.category = categoryColor;
        
        const formattedUsage = priorUsage
            .map(u => ({ year: parseInt(u.year, 10), usage: parseInt(u.usage, 10) }))
            .filter(u => !isNaN(u.year) && u.year > 0 && !isNaN(u.usage));

        const lowAlertNum = parseInt(lowAlertQuantity, 10);
        const finalStock = localStock.map(({ uiKey, isNew, ...restOfStock }) => restOfStock);

        onEditItem(
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
            colorsToSave
        );
    };

    const alertColorClass = useMemo(() => {
        if (lowAlertQuantity.trim() === '') return '';
        const lowAlertNum = parseInt(lowAlertQuantity, 10);
        if (isNaN(lowAlertNum)) return '';
        return totalQuantity <= lowAlertNum ? 'text-red-600 font-bold' : 'text-green-600';
    }, [lowAlertQuantity, totalQuantity]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-down">
            <div className="modal-container max-w-3xl overflow-y-auto max-h-[95vh] bg-white rounded-lg shadow-2xl">
                <form onSubmit={handleSubmit}>
                    <div className="modal-header flex justify-between items-center p-4 border-b border-gray-200">
                        <h2 className="text-xl font-bold uppercase">Edit Item Details</h2>
                        <button type="button" onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="modal-body p-6 space-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1.5">Item ID</label>
                                <input type="text" value={item.id} readOnly className="form-control bg-gray-100 cursor-not-allowed font-bold" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1.5">Description*</label>
                                <input ref={descriptionRef} type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="form-control font-medium" required />
                            </div>
                            
                            {/* Hierarchy Grid */}
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-4">CATEGORIZATION</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1.5">MAIN CATEGORY</label>
                                        <div className="flex gap-2">
                                            <select
                                                value={category}
                                                onChange={(e) => {
                                                    setCategory(e.target.value);
                                                    setSubCat1([]); setSubCat2([]); setSubCat3('');
                                                    if (currentCategoryColors[e.target.value]) setCategoryColor(currentCategoryColors[e.target.value]);
                                                }}
                                                className="flex-grow border border-gray-300 p-2 rounded-md text-sm font-bold uppercase focus:ring-1 focus:ring-em-red outline-none bg-white"
                                            >
                                                <option value="">Select...</option>
                                                {mainOptions.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <input type="color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} className="w-9 h-full p-0.5 border border-gray-300 rounded cursor-pointer shrink-0" />
                                        </div>
                                    </div>

                                    <div>
                                        <MultiSelectDropdown 
                                            label="SUB 1 (TAGS)" 
                                            options={sub1Options} 
                                            selected={subCat1} 
                                            onChange={val => { setSubCat1(val); setSubCat2([]); setSubCat3(''); }}
                                            disabled={!category}
                                        />
                                    </div>

                                    <div>
                                        <MultiSelectDropdown 
                                            label="SUB 2 (TAGS)" 
                                            options={sub2Options} 
                                            selected={subCat2} 
                                            onChange={val => { setSubCat2(val); setSubCat3(''); }}
                                            disabled={subCat1.length === 0}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1.5">SUB 3 (SPECIFIC)</label>
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
                                                        
                            <div className="form-section pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 uppercase mb-3">Stock Levels by Location</h3>
                                <div className="space-y-3">
                                    {localStock.length > 0 ? localStock.map(s => {
                                        const selectedLocation = locationMap.get(s.locationId);
                                        return (
                                            <div key={s.uiKey} className="bg-gray-50 p-3 rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
                                                <div className="sm:col-span-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Location</label>
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
                                                        <div className="text-sm font-black text-gray-800 mt-1 uppercase">{selectedLocation?.name || s.locationId}</div>
                                                    )}
                                                </div>

                                                <div className="sm:col-span-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Detail</label>
                                                    <input
                                                        type="text"
                                                        value={s.subLocationDetail || ''}
                                                        onChange={e => handleStockChange(s.uiKey, 'subLocationDetail', e.target.value)}
                                                        className="form-control text-sm py-1 mt-1"
                                                        placeholder={selectedLocation?.subLocationPrompt || '-'}
                                                    />
                                                </div>

                                                <div className="sm:col-span-1">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Barcode</label>
                                                    <input
                                                        type="text"
                                                        value={s.locationBarcode || ''}
                                                        onChange={e => handleStockChange(s.uiKey, 'locationBarcode', e.target.value)}
                                                        className="form-control text-xs py-1 mt-1"
                                                        placeholder="SCAN..."
                                                    />
                                                </div>

                                                <div className="sm:col-span-1 relative">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">Quantity</label>
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
                                                            className="mt-1 p-1 bg-gray-200 hover:bg-gray-300 rounded text-black text-xs font-bold"
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
                                                    }} className="text-gray-400 hover:text-black p-1" title="Print Label">
                                                        <PrinterIcon className="w-5 h-5" />
                                                    </button>
                                                    <button type="button" onClick={() => handleRemoveStockEntry(s.uiKey)} className="text-red-400 hover:text-red-600 p-1" title="Delete">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    }) : <p className="text-xs text-gray-400 italic text-center py-2">No stock records. Add one below.</p>}

                                     <button
                                        type="button"
                                        onClick={handleAddStockEntry}
                                        disabled={availableLocations.length === 0}
                                        className="flex items-center text-xs font-bold text-em-red hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed mt-2"
                                    >
                                        <PlusIcon className="w-4 h-4 mr-1" />
                                        ADD STOCK LOCATION
                                    </button>
                                </div>
                            </div>

                            <div className="form-section pt-4 border-t border-gray-100">
                                <h3 className="text-sm font-bold text-gray-800 uppercase mb-3">Usage & Forecasting</h3>
                                <div className="space-y-2">
                                    {priorUsage.map((entry) => {
                                        const selectedYears = new Set(priorUsage.filter(p => p.key !== entry.key).map(p => p.year));
                                        const availableYears = ALL_YEARS.filter(y => !selectedYears.has(String(y)));
                                        return (
                                            <div key={entry.key} className="flex gap-3 items-end max-w-sm">
                                                <div className="w-24">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">YEAR</label>
                                                    <select value={entry.year} onChange={e => handleUsageChange(entry.key, 'year', e.target.value)} className="form-control text-sm py-1 mt-1">
                                                        <option value="" disabled>...</option>
                                                        {entry.year && <option value={entry.year}>{entry.year}</option>}
                                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                                <div className="flex-grow">
                                                    <label className="text-[10px] font-bold text-gray-500 uppercase">USAGE</label>
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
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">AVG USAGE</label>
                                        <input type="number" value={Math.round(averageUsage) || ''} readOnly className="form-control mt-1 bg-gray-100 cursor-not-allowed font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase">LOW ALERT</label>
                                        <input type="number" value={lowAlertQuantity} onChange={(e) => setLowAlertQuantity(e.target.value)} className={`form-control mt-1 font-bold ${alertColorClass}`} />
                                    </div>
                                    <div className="bg-gray-50 p-2 rounded text-center flex flex-col justify-center">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase">EST. REMAINING</span>
                                        <span className="text-lg font-black text-gray-900">{etr}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="modal-footer bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                        <button type="button" onClick={onDelete} disabled={isSaving} className="text-red-600 hover:text-red-800 font-bold text-xs uppercase flex items-center gap-2 px-3 py-2 rounded hover:bg-red-50 transition-colors">
                            <TrashIcon className="w-4 h-4" /> Delete Item
                        </button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 uppercase">Cancel</button>
                            <button type="submit" disabled={isSaving} className="px-6 py-2 text-sm font-bold text-white bg-em-red rounded shadow hover:bg-red-700 uppercase flex items-center disabled:opacity-70">
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditItemModal;
