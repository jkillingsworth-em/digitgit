import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PrinterIcon } from './icons/PrinterIcon';

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
            const intResult = Math.round(Number(result)); // Inventory is usually integer
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
    // Refs for focusing
    const descriptionRef = useRef<HTMLInputElement>(null);
    const categoryRef = useRef<HTMLSelectElement>(null); // CHANGED type to Select
    const quantityInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
    
    // Item details state
    const [description, setDescription] = useState(item.description);
    const [category, setCategory] = useState(item.category || '');
    const [subCategory, setSubCategory] = useState(item.subCategory || '');
    
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
    const [subCategoryColor, setSubCategoryColor] = useState(
        (item.subCategory && currentCategoryColors[item.subCategory]) || '#000000'
    );
    
    // Stock state
    const [localStock, setLocalStock] = useState<UIStock[]>(() => stock.map((s, i) => ({ ...s, uiKey: Date.now() + i })));

    // Calculator State
    const [activeCalcId, setActiveCalcId] = useState<number | null>(null);

    // Save State
    const [isSaving, setIsSaving] = useState(false);

    const locationMap = useMemo(() => new Map(locations.map(l => [l.id, l])), [locations]);
    
    const existingLocationIds = useMemo(() => new Set(localStock.map(s => s.locationId)), [localStock]);
    const availableLocations = useMemo(() => locations.filter(l => !existingLocationIds.has(l.id)), [locations, existingLocationIds]);

    const totalQuantity = useMemo(() => localStock.reduce((sum, s) => sum + s.quantity, 0), [localStock]);

    // NEW: Derive available categories
    const availableCategories = useMemo(() => {
        return Object.keys(currentCategoryColors).sort();
    }, [currentCategoryColors]);
    
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
        if (subCategory && currentCategoryColors[subCategory]) {
            setSubCategoryColor(currentCategoryColors[subCategory]);
        }
    }, [subCategory, currentCategoryColors]);
    
    useEffect(() => {
        // Auto-focus logic
        setTimeout(() => {
            switch (fieldToFocus) {
                case 'description': descriptionRef.current?.focus(); break;
                case 'category': categoryRef.current?.focus(); break;
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
        const colorsToSave: { category?: string, subCategory?: string } = {};
        if (category.trim()) colorsToSave.category = categoryColor;
        if (subCategory.trim()) colorsToSave.subCategory = subCategoryColor;
        
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
                subCategory: subCategory.trim(),
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
            <div className="modal-container max-w-2xl overflow-y-auto">
                <form onSubmit={handleSubmit}>
                    <div className="modal-header">
                        <h2>Edit Item Details</h2>
                        <button type="button" onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="modal-body">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="itemId">Item ID</label>
                                <input type="text" id="itemId" value={item.id} readOnly className="form-control mt-1 bg-gray-100 cursor-not-allowed" />
                            </div>
                            <div>
                                <label htmlFor="description">Description*</label>
                                <input ref={descriptionRef} type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="form-control mt-1" required />
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="category">Category</label>
                                    <div className="flex gap-2 items-center mt-1">
                                        {/* CHANGED: Replaced Input with Select and Add Button */}
                                        <div className="flex-grow flex items-center gap-2">
                                            <select
                                                ref={categoryRef}
                                                id="category"
                                                value={category}
                                                onChange={(e) => {
                                                    const newCat = e.target.value;
                                                    setCategory(newCat);
                                                    if (currentCategoryColors[newCat]) {
                                                        setCategoryColor(currentCategoryColors[newCat]);
                                                    }
                                                }}
                                                className="form-control bg-white"
                                            >
                                                <option value="">Select Category...</option>
                                                {availableCategories.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ))}
                                            </select>
                                            <button 
                                                type="button"
                                                onClick={() => window.location.href = '/admin/categories'}
                                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-md border border-gray-300 transition-colors"
                                                title="Manage Categories"
                                            >
                                                <PlusIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <input type="color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} className="h-9 w-12 p-0 border border-gray-300 rounded-md cursor-pointer shrink-0" title="Assign Category Color" />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="subCategory">Sub-Category</label>
                                    <div className="flex gap-2 items-center mt-1">
                                        <input type="text" id="subCategory" value={subCategory} onChange={(e) => setSubCategory(e.target.value)} className="form-control" />
                                        <input type="color" value={subCategoryColor} onChange={(e) => setSubCategoryColor(e.target.value)} className="h-9 w-12 p-0 border border-gray-300 rounded-md cursor-pointer" title="Assign Sub-Category Color" />
                                    </div>
                                </div>
                            </div>
                                                        
                            <div className="form-section">
                                <h3>Stock Levels by Location</h3>
                                <div className="mt-2 space-y-3">
                                    {localStock.length > 0 ? localStock.map(s => {
                                        const selectedLocation = locationMap.get(s.locationId);
                                        return (
                                            <div key={s.uiKey} className="info-box grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-3 items-end">
                                                <div className="sm:col-span-3 md:col-span-1">
                                                    <label htmlFor={`location-${s.uiKey}`}>Location</label>
                                                    {s.isNew ? (
                                                        <select
                                                            id={`location-${s.uiKey}`}
                                                            value={s.locationId}
                                                            onChange={e => handleStockChange(s.uiKey, 'locationId', e.target.value)}
                                                            className="form-control mt-1"
                                                        >
                                                            <option value="" disabled>Select...</option>
                                                            {availableLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                                        </select>
                                                    ) : (
                                                        <div className="form-control mt-1 bg-gray-100 text-black">{selectedLocation?.name || s.locationId}</div>
                                                    )}
                                                </div>

                                                {selectedLocation?.subLocationPrompt && (
                                                    <div className="sm:col-span-2 md:col-span-1">
                                                        <label htmlFor={`sublocation-${s.uiKey}`}>Detail</label>
                                                        <input
                                                            type="text"
                                                            id={`sublocation-${s.uiKey}`}
                                                            value={s.subLocationDetail || ''}
                                                            onChange={e => handleStockChange(s.uiKey, 'subLocationDetail', e.target.value)}
                                                            className="form-control mt-1"
                                                            placeholder={selectedLocation.subLocationPrompt}
                                                        />
                                                    </div>
                                                )}

                                                <div className="sm:col-span-2 md:col-span-1">
                                                    <label htmlFor={`locBarcode-${s.uiKey}`} className="flex items-center gap-1">
                                                        Loc Barcode
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id={`locBarcode-${s.uiKey}`}
                                                        value={s.locationBarcode || ''}
                                                        onChange={e => handleStockChange(s.uiKey, 'locationBarcode', e.target.value)}
                                                        className="form-control mt-1 text-xs"
                                                        placeholder="SCAN/TYPE"
                                                    />
                                                </div>

                                                <div className="sm:col-span-2 md:col-span-1 relative">
                                                    <label htmlFor={`quantity-${s.uiKey}`}>Quantity</label>
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            ref={el => { quantityInputRefs.current.set(s.locationId, el); }}
                                                            type="number"
                                                            id={`quantity-${s.uiKey}`}
                                                            min="0"
                                                            value={s.quantity}
                                                            onChange={(e) => handleStockChange(s.uiKey, 'quantity', parseInt(e.target.value, 10) || 0)}
                                                            className="form-control mt-1"
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => setActiveCalcId(s.uiKey)}
                                                            className="mt-1 p-2 bg-gray-200 hover:bg-gray-300 rounded text-black"
                                                            title="Calculate"
                                                        >
                                                            <span className="font-mono font-bold text-lg">=</span>
                                                        </button>
                                                    </div>
                                                    {/* Calculator Overlay */}
                                                    {activeCalcId === s.uiKey && (
                                                        <CalculatorOverlay 
                                                            initialValue={s.quantity} 
                                                            onClose={() => setActiveCalcId(null)}
                                                            onConfirm={(val) => {
                                                                handleStockChange(s.uiKey, 'quantity', val);
                                                                setActiveCalcId(null);
                                                            }}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex items-center justify-end space-x-1">
                                                    <button type="button" onClick={() => {
                                                        const location = locationMap.get(s.locationId);
                                                        if (location) {
                                                            onPrintSpecificLabel({
                                                                itemId: item.id,
                                                                description: description,
                                                                locationName: location.name,
                                                                subLocationDetail: s.subLocationDetail
                                                            });
                                                        }
                                                    }} className="text-black hover:text-gray-900 p-2" title="Print Label for this Location">
                                                        <PrinterIcon className="w-5 h-5" />
                                                    </button>
                                                    <button type="button" onClick={() => handleRemoveStockEntry(s.uiKey)} className="text-red-600 hover:text-red-800 p-2" title="Delete Stock Entry">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    }) : <p className="text-sm text-black italic text-center py-4">No stock records for this item. Add one below.</p>}

                                     <button
                                        type="button"
                                        onClick={handleAddStockEntry}
                                        disabled={availableLocations.length === 0}
                                        className="flex items-center text-sm font-medium text-em-red hover:text-red-800 disabled:text-gray-700 disabled:cursor-not-allowed"
                                    >
                                        <PlusIcon className="w-4 h-4 mr-1" />
                                        Add Stock Location
                                    </button>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3>Usage & Forecasting</h3>
                                <div className="space-y-3 mt-2">
                                    {priorUsage.map((entry) => {
                                        const selectedYears = new Set(priorUsage.filter(p => p.key !== entry.key).map(p => p.year));
                                        const availableYears = ALL_YEARS.filter(y => !selectedYears.has(String(y)));
                                        return (
                                            <div key={entry.key} className="info-box grid grid-cols-3 gap-3 items-end">
                                                <div>
                                                    <label htmlFor={`usage-year-${entry.key}`}>YEAR</label>
                                                    <select id={`usage-year-${entry.key}`} value={entry.year} onChange={e => handleUsageChange(entry.key, 'year', e.target.value)} className="form-control mt-1">
                                                        <option value="" disabled>SELECT...</option>
                                                        {entry.year && <option value={entry.year}>{entry.year}</option>}
                                                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label htmlFor={`usage-value-${entry.key}`}>USAGE</label>
                                                    <input type="number" id={`usage-value-${entry.key}`} value={entry.usage} onChange={e => handleUsageChange(entry.key, 'usage', e.target.value)} className="form-control mt-1" />
                                                </div>
                                                <div className="text-right">
                                                    <button type="button" onClick={() => handleRemoveUsage(entry.key)} className="text-red-600 hover:text-red-800 p-2" title="Remove Year">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {priorUsage.length < 3 && (
                                        <button type="button" onClick={handleAddUsage} className="flex items-center text-sm font-medium text-em-red hover:text-red-800">
                                            <PlusIcon className="w-4 h-4 mr-1" />
                                            Add Usage Year
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                                    <div>
                                        <label htmlFor="avgUsage">CALCULATED AVG USAGE</label>
                                        <input type="number" id="avgUsage" value={Math.round(averageUsage) || ''} readOnly className="form-control mt-1 bg-gray-100 cursor-not-allowed" />
                                    </div>
                                    <div>
                                        <label htmlFor="lowAlertQuantity">LOW ALERT QTY</label>
                                        <input type="number" id="lowAlertQuantity" value={lowAlertQuantity} onChange={(e) => setLowAlertQuantity(e.target.value)} className={`form-control mt-1 ${alertColorClass}`} />
                                    </div>
                                    <div className="info-box text-center !mt-1 md:!mt-auto">
                                        <label>Est. Time Remaining</label>
                                        <p className="text-xl font-bold text-em-dark-blue mt-1">{etr}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer flex justify-between items-center" style={{justifyContent: 'space-between'}}>
                        <button type="button" onClick={onDelete} disabled={isSaving} className="text-red-600 hover:text-red-800 font-bold text-sm uppercase flex items-center gap-2 px-2 py-2 rounded hover:bg-red-50 transition-colors">
                            <TrashIcon className="w-5 h-5" /> Delete Item
                        </button>
                        <div className="flex gap-3">
                            <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-medium text-black bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 uppercase disabled:opacity-50">Cancel</button>
                            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-em-red border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-em-red uppercase disabled:opacity-50 flex items-center">
                                {isSaving ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditItemModal;
