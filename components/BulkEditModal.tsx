import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
// Make sure these paths are correct for your project structure!
import { XMarkIcon } from './icons/XMarkIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { doc, getDoc } from 'firebase/firestore';
import { useDb } from '../context/DbContext';
import MultiSelectDropdown from './MultiSelectDropdown';

interface BulkEditModalProps {
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    selectedItemIds: Set<string>;
    onClose: () => void;
    onSaveChanges: (changes: { category?: string; subCategory1?: string[]; subCategory2?: string[]; subCategory3?: string[] }) => void;
    onTransfer: (transfers: { itemId: string; fromLoc: string; toLoc: string; qty: number }[]) => void;
    onUpdateQuantities: (updates: { itemId: string; locationId: string; newQty: number }[]) => void;
    onPrintLabels: (labels: PrintableLabel[]) => void;
}

type Tab = 'properties' | 'transfer' | 'quantities' | 'labels';

const BulkEditModal: React.FC<BulkEditModalProps> = ({ 
    items = [], 
    stock = [], 
    locations = [], 
    selectedItemIds = new Set(), 
    onClose, 
    onSaveChanges, 
    onTransfer, 
    onUpdateQuantities, 
    onPrintLabels 
}) => {
    const db = useDb();
    
    const [activeTab, setActiveTab] = useState<Tab>('properties');
    const [hierarchy, setHierarchy] = useState<any>({});

    // -- Tab 1: Properties State --
    const [editCat, setEditCat] = useState(false);
    const [selectedCat, setSelectedCat] = useState('');
    
    const [editSub1, setEditSub1] = useState(false);
    const [selectedSub1, setSelectedSub1] = useState<string[]>([]);
    
    const [editSub2, setEditSub2] = useState(false);
    const [selectedSub2, setSelectedSub2] = useState<string[]>([]);
    
    const [editSub3, setEditSub3] = useState(false);
    const [selectedSub3, setSelectedSub3] = useState('');

    // -- Tab 2: Transfer State --
    const [transFrom, setTransFrom] = useState('');
    const [transTo, setTransTo] = useState('');
    const [transQty, setTransQty] = useState<string>('');

    // -- Tab 3: Quantities State --
    const [qtyUpdates, setQtyUpdates] = useState<Record<string, string>>({});

    // -- Tab 4: Labels State --
    const [labelSelection, setLabelSelection] = useState<Set<string>>(new Set());

    // -- Computed Data (Safe Version) --
    const selectedItemsList = useMemo(() => {
        if (!items || !selectedItemIds) return [];
        return items.filter(i => i && selectedItemIds.has(i.id));
    }, [items, selectedItemIds]);
    
    // Load Hierarchy
    useEffect(() => {
        try {
            getDoc(doc(db, 'settings', 'categoryHierarchy')).then(snap => {
                if (snap.exists()) setHierarchy(snap.data());
            });
        } catch (err) {
            console.error("Error loading hierarchy", err);
        }
    }, [db]);

    // Hierarchy Options (Safe Version)
    const mainOptions = useMemo(() => {
        if (!hierarchy) return [];
        return Object.keys(hierarchy).sort();
    }, [hierarchy]);

    const sub1Options = useMemo(() => {
        if (!selectedCat || !hierarchy || !hierarchy[selectedCat]) return [];
        return Object.keys(hierarchy[selectedCat]).sort();
    }, [selectedCat, hierarchy]);

    const sub3Options = useMemo(() => {
        if (!selectedCat || !hierarchy || !hierarchy[selectedCat]) return [];
        const opts = new Set<string>();
        const catData = hierarchy[selectedCat] || {};
        
        // Safety check for Object.values
        if (catData) {
            Object.values(catData).forEach((sub2Obj: any) => {
                if (sub2Obj && typeof sub2Obj === 'object') {
                    Object.values(sub2Obj).forEach((sub3Arr: any) => {
                        if (Array.isArray(sub3Arr)) sub3Arr.forEach(s => opts.add(s));
                    });
                }
            });
        }
        return Array.from(opts).sort();
    }, [selectedCat, hierarchy]);

    // -- Handlers --

    const handlePropertiesSave = () => {
        const changes: any = {};
        if (editCat) changes.category = selectedCat;
        if (editSub1) changes.subCategory1 = selectedSub1;
        if (editSub2) changes.subCategory2 = selectedSub2;
        if (editSub3) changes.subCategory3 = selectedSub3;
        
        if (Object.keys(changes).length === 0) return alert("No changes selected.");
        onSaveChanges(changes);
    };

    const handleTransferSubmit = () => {
        const qty = parseInt(transQty);
        if (!transFrom || !transTo || isNaN(qty) || qty <= 0) return alert("Invalid transfer details.");
        if (transFrom === transTo) return alert("Source and Destination cannot be the same.");

        const transfers = selectedItemsList.map(item => ({
            itemId: item.id,
            fromLoc: transFrom,
            toLoc: transTo,
            qty: qty
        }));
        onTransfer(transfers);
    };

    const handleQuantitySave = () => {
        const updates = Object.entries(qtyUpdates).map(([key, val]) => {
            const parts = key.split('__');
            // Safe destructuring
            const itemId = parts[0];
            const locationId = parts[1];
            return { itemId, locationId, newQty: parseInt(val) || 0 };
        });
        if (updates.length === 0) return alert("No quantities changed.");
        onUpdateQuantities(updates);
    };

    const handlePrintSubmit = () => {
        const labelsToPrint: PrintableLabel[] = [];
        selectedItemsList.forEach(item => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            itemStock.forEach(s => {
                const key = `${item.id}__${s.locationId}`;
                if (labelSelection.has(key)) {
                    const locName = locations.find(l => l.id === s.locationId)?.name || s.locationId;
                    labelsToPrint.push({
                        itemId: item.id,
                        description: item.description,
                        locationName: locName,
                        subLocationDetail: s.subLocationDetail
                    });
                }
            });
        });
        
        if (labelsToPrint.length === 0) return alert("Select at least one location to print.");
        onPrintLabels(labelsToPrint);
    };

    const toggleLabelSelection = (itemId: string, locationId: string) => {
        const key = `${itemId}__${locationId}`;
        setLabelSelection(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-container bg-white w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex shrink-0">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-gray-50 border-r border-gray-200 flex flex-col pt-4">
                        <div className="px-4 mb-4 font-black text-lg text-gray-800 uppercase">Bulk Actions</div>
                        <div className="flex flex-col gap-1 px-2">
                            {[
                                { id: 'properties', label: 'Edit Properties', icon: PencilSquareIcon },
                                { id: 'transfer', label: 'Transfer Stock', icon: ArrowRightLeftIcon },
                                { id: 'quantities', label: 'Update Qty', icon: DocumentChartBarIcon },
                                { id: 'labels', label: 'Print Labels', icon: BarcodeIcon },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as Tab)}
                                    className={`flex items-center gap-3 px-3 py-3 text-sm font-bold rounded-lg text-left transition-colors uppercase ${activeTab === tab.id ? 'bg-em-red text-white' : 'text-gray-600 hover:bg-gray-200'}`}
                                >
                                    {/* Defensive check if icon exists */}
                                    {tab.icon && <tab.icon className="w-5 h-5" />}
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-grow flex flex-col h-full overflow-hidden">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase">
                                    {activeTab === 'properties' && 'Edit Properties'}
                                    {activeTab === 'transfer' && 'Bulk Transfer'}
                                    {activeTab === 'quantities' && 'Update Quantities'}
                                    {activeTab === 'labels' && 'Print Labels'}
                                </h2>
                                <p className="text-sm text-gray-500 font-bold mt-1">
                                    APPLYING TO <span className="text-em-red">{selectedItemIds ? selectedItemIds.size : 0}</span> SELECTED ITEMS
                                </p>
                            </div>
                            <button onClick={onClose} className="bg-gray-100 text-gray-500 p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-8 overflow-y-auto flex-grow bg-white">
                            
                            {/* --- TAB: PROPERTIES --- */}
                            {activeTab === 'properties' && (
                                <div className="space-y-6 max-w-lg">
                                    {/* Main Category */}
                                    <div className="flex items-start gap-3 p-4 border rounded-xl bg-gray-50">
                                        <input type="checkbox" checked={editCat} onChange={e => setEditCat(e.target.checked)} className="mt-1.5 w-5 h-5 text-em-red rounded focus:ring-em-red" />
                                        <div className="flex-grow">
                                            <label className="text-xs font-black text-gray-500 uppercase block mb-1">Main Category</label>
                                            <select 
                                                disabled={!editCat} 
                                                value={selectedCat} 
                                                onChange={e => setSelectedCat(e.target.value)} 
                                                className="form-control"
                                            >
                                                <option value="">Select Category...</option>
                                                {(mainOptions || []).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Sub 1 */}
                                    <div className="flex items-start gap-3 p-4 border rounded-xl bg-gray-50">
                                        <input type="checkbox" checked={editSub1} onChange={e => setEditSub1(e.target.checked)} className="mt-1.5 w-5 h-5 text-em-red rounded focus:ring-em-red" />
                                        <div className="flex-grow">
                                            {/* Ensure MultiSelectDropdown exists and props are safe */}
                                            <MultiSelectDropdown 
                                                label="Sub Category 1 (Tags)"
                                                options={sub1Options || []}
                                                selected={selectedSub1 || []}
                                                onChange={setSelectedSub1}
                                                disabled={!editSub1 || !selectedCat}
                                                placeholder={!selectedCat ? "Select Main Category First" : "Select Tags..."}
                                            />
                                        </div>
                                    </div>

                                    {/* Sub 3 */}
                                    <div className="flex items-start gap-3 p-4 border rounded-xl bg-gray-50">
                                        <input type="checkbox" checked={editSub3} onChange={e => setEditSub3(e.target.checked)} className="mt-1.5 w-5 h-5 text-em-red rounded focus:ring-em-red" />
                                        <div className="flex-grow">
                                            <label className="text-xs font-black text-gray-500 uppercase block mb-1">Sub Category 3 (Leaf)</label>
                                            <select 
                                                disabled={!editSub3 || !selectedCat} 
                                                value={selectedSub3} 
                                                onChange={e => setSelectedSub3(e.target.value)} 
                                                className="form-control"
                                            >
                                                <option value="">Select Sub-Category...</option>
                                                {(sub3Options || []).map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB: TRANSFER --- */}
                            {activeTab === 'transfer' && (
                                <div className="space-y-6 max-w-lg">
                                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm font-medium">
                                        This will attempt to move the specified quantity from the Source to the Destination for <strong>EVERY</strong> selected item.
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-black text-gray-500 uppercase block mb-1">From Source</label>
                                            <select value={transFrom} onChange={e => setTransFrom(e.target.value)} className="form-control">
                                                <option value="">Select Location...</option>
                                                {(locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-gray-500 uppercase block mb-1">To Destination</label>
                                            <select value={transTo} onChange={e => setTransTo(e.target.value)} className="form-control">
                                                <option value="">Select Location...</option>
                                                {(locations || []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-black text-gray-500 uppercase block mb-1">Quantity to Move</label>
                                        <input 
                                            type="number" 
                                            value={transQty} 
                                            onChange={e => setTransQty(e.target.value)} 
                                            className="form-control font-bold text-lg" 
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* --- TAB: QUANTITIES --- */}
                            {activeTab === 'quantities' && (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-100 rounded-lg text-xs font-black text-gray-500 uppercase tracking-widest mb-2">
                                        <div className="col-span-4">Item</div>
                                        <div className="col-span-4">Location</div>
                                        <div className="col-span-4 text-center">Quantity</div>
                                    </div>
                                    {selectedItemsList.map(item => {
                                        if(!item) return null;
                                        const itemStock = (stock || []).filter(s => s.itemId === item.id);
                                        if (itemStock.length === 0) return null;
                                        return (
                                            <div key={item.id} className="contents">
                                                {itemStock.map(s => {
                                                    const key = `${item.id}__${s.locationId}`;
                                                    const currentVal = qtyUpdates[key] !== undefined ? qtyUpdates[key] : s.quantity;
                                                    const locName = locations.find(l => l.id === s.locationId)?.name || s.locationId;
                                                    
                                                    return (
                                                        <div key={key} className="grid grid-cols-12 gap-4 items-center p-3 border-b border-gray-100 hover:bg-gray-50">
                                                            <div className="col-span-4">
                                                                <div className="font-bold text-gray-900 text-sm truncate">{item.description}</div>
                                                                <div className="text-[10px] text-gray-500 font-bold">{item.id}</div>
                                                            </div>
                                                            <div className="col-span-4">
                                                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase">{locName}</span>
                                                            </div>
                                                            <div className="col-span-4">
                                                                <input 
                                                                    type="number" 
                                                                    className="form-control text-center font-bold"
                                                                    value={currentVal}
                                                                    onChange={(e) => setQtyUpdates(p => ({ ...p, [key]: e.target.value }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* --- TAB: LABELS --- */}
                            {activeTab === 'labels' && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="text-sm font-bold text-gray-500">Select specific locations to print for each item.</div>
                                        <button 
                                            onClick={() => {
                                                const allKeys = new Set<string>();
                                                selectedItemsList.forEach(i => {
                                                    stock.filter(s => s.itemId === i.id).forEach(s => allKeys.add(`${i.id}__${s.locationId}`));
                                                });
                                                setLabelSelection(allKeys);
                                            }}
                                            className="text-xs font-bold text-em-red uppercase hover:underline"
                                        >
                                            Select All Available
                                        </button>
                                    </div>
                                    {selectedItemsList.map(item => {
                                        if(!item) return null;
                                        const itemStock = (stock || []).filter(s => s.itemId === item.id);
                                        return (
                                            <div key={item.id} className="border border-gray-200 rounded-xl p-4">
                                                <div className="font-bold text-gray-900 mb-3 flex justify-between">
                                                    <span>{item.description} <span className="text-gray-400 font-normal">({item.id})</span></span>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {itemStock.length > 0 ? itemStock.map(s => {
                                                        const locName = locations.find(l => l.id === s.locationId)?.name || s.locationId;
                                                        const key = `${item.id}__${s.locationId}`;
                                                        const isChecked = labelSelection.has(key);
                                                        return (
                                                            <label key={key} className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${isChecked ? 'bg-red-50 border-em-red' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
                                                                <input 
                                                                    type="checkbox" 
                                                                    checked={isChecked}
                                                                    onChange={() => toggleLabelSelection(item.id, s.locationId)}
                                                                    className="w-4 h-4 text-em-red rounded focus:ring-em-red"
                                                                />
                                                                <div className="ml-3">
                                                                    <div className="text-xs font-black uppercase text-gray-800">{locName}</div>
                                                                    <div className="text-[10px] font-bold text-gray-500">Qty: {s.quantity}</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    }) : <span className="text-xs text-red-500 font-bold italic">No Stock Locations</span>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                            <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 uppercase">
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    if (activeTab === 'properties') handlePropertiesSave();
                                    if (activeTab === 'transfer') handleTransferSubmit();
                                    if (activeTab === 'quantities') handleQuantitySave();
                                    if (activeTab === 'labels') handlePrintSubmit();
                                }}
                                className="px-8 py-3 text-sm font-bold text-white bg-em-red rounded-lg shadow-md hover:bg-red-700 uppercase"
                            >
                                {activeTab === 'properties' && 'Apply Changes'}
                                {activeTab === 'transfer' && 'Execute Transfer'}
                                {activeTab === 'quantities' && 'Save Quantities'}
                                {activeTab === 'labels' && 'Generate Labels'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
