
import React, { useState, useMemo, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { CheckIcon } from './icons/CheckIcon';

interface GenerateBarcodeSheetModalProps {
    onClose: () => void;
    onGenerate: (labels: PrintableLabel[]) => void;
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    selectedItemIds: Set<string>;
    initialPrintType?: PrintType;
    zIndexClassName?: string;
}

type PrintType = 'selected' | 'category' | 'location' | 'search';

const GenerateBarcodeSheetModal: React.FC<GenerateBarcodeSheetModalProps> = ({ onClose, onGenerate, items, stock, locations, selectedItemIds, initialPrintType = 'search', zIndexClassName }) => {
    const [printType, setPrintType] = useState<PrintType>(initialPrintType);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [manualQueue, setManualQueue] = useState<InventoryItem[]>([]);
    
    // Selection state for Location/Category sub-lists
    const [subsetSelection, setSubsetSelection] = useState<Set<string>>(new Set());

    const categories = useMemo(() => {
        const cats = new Set(items.map(item => item.category || 'Uncategorized'));
        return Array.from(cats).sort();
    }, [items]);

    // Items available in the currently selected location
    const itemsInLocation = useMemo(() => {
        if (!selectedLocation || printType !== 'location') return [];
        const locationStock = stock.filter(s => s.locationId === selectedLocation);
        const itemIds = new Set(locationStock.map(s => s.itemId));
        return items.filter(i => itemIds.has(i.id)).sort((a, b) => a.description.localeCompare(b.description));
    }, [selectedLocation, stock, items, printType]);

    // Locations that have items of the currently selected category
    const locationsForCategory = useMemo(() => {
        if (!selectedCategory || printType !== 'category') return [];
        const catItems = items.filter(i => (i.category || 'Uncategorized') === selectedCategory);
        const catItemIds = new Set(catItems.map(i => i.id));
        const relevantStock = stock.filter(s => catItemIds.has(s.itemId));
        const locationIds = new Set(relevantStock.map(s => s.locationId));
        return locations.filter(l => locationIds.has(l.id));
    }, [selectedCategory, items, stock, locations, printType]);

    // Reset subset selection when main selection changes
    useEffect(() => {
        setSubsetSelection(new Set());
    }, [printType, selectedCategory, selectedLocation]);

    // Auto-select all when list populates
    useEffect(() => {
        if (printType === 'location' && itemsInLocation.length > 0) {
            setSubsetSelection(new Set(itemsInLocation.map(i => i.id)));
        }
    }, [itemsInLocation, printType]);

    useEffect(() => {
        if (printType === 'category' && locationsForCategory.length > 0) {
            setSubsetSelection(new Set(locationsForCategory.map(l => l.id)));
        }
    }, [locationsForCategory, printType]);

    const searchResults = useMemo(() => {
        if (searchQuery.length < 2) return [];
        const lower = searchQuery.toLowerCase();
        return items
            .filter(i => 
                i.id.toLowerCase().includes(lower) || 
                i.description.toLowerCase().includes(lower)
            )
            .filter(i => !manualQueue.some(q => q.id === i.id))
            .slice(0, 5);
    }, [searchQuery, items, manualQueue]);

    const addToQueue = (item: InventoryItem) => {
        setManualQueue([...manualQueue, item]);
        setSearchQuery('');
    };

    const removeFromQueue = (id: string) => {
        setManualQueue(manualQueue.filter(i => i.id !== id));
    };

    const toggleSubset = (id: string) => {
        const next = new Set(subsetSelection);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSubsetSelection(next);
    };

    const toggleAllSubset = (ids: string[]) => {
        if (subsetSelection.size === ids.length) {
            setSubsetSelection(new Set());
        } else {
            setSubsetSelection(new Set(ids));
        }
    };

    const handleGenerate = () => {
        let labels: PrintableLabel[] = [];

        switch (printType) {
            case 'selected':
                items.filter(i => selectedItemIds.has(i.id)).forEach(item => {
                    const itemStock = stock.filter(s => s.itemId === item.id);
                    if (itemStock.length > 0) {
                        itemStock.forEach(s => {
                            const loc = locations.find(l => l.id === s.locationId);
                            labels.push({ itemId: item.id, description: item.description, locationName: loc?.name || s.locationId, subLocationDetail: s.subLocationDetail });
                        });
                    } else {
                        labels.push({ itemId: item.id, description: item.description, locationName: 'PRODUCT SKU' });
                    }
                });
                break;

            case 'category':
                if (!selectedCategory) return alert("Select a category.");
                if (subsetSelection.size === 0) return alert("Select at least one location.");
                
                items.filter(i => (i.category || 'Uncategorized') === selectedCategory).forEach(item => {
                    const itemStock = stock.filter(s => s.itemId === item.id && subsetSelection.has(s.locationId));
                    itemStock.forEach(s => {
                        const loc = locations.find(l => l.id === s.locationId);
                        labels.push({ itemId: item.id, description: item.description, locationName: loc?.name || s.locationId, subLocationDetail: s.subLocationDetail });
                    });
                });
                break;

            case 'location':
                if (!selectedLocation) return alert("Select a warehouse.");
                if (subsetSelection.size === 0) return alert("Select at least one product.");
                
                itemsInLocation.filter(i => subsetSelection.has(i.id)).forEach(item => {
                    const s = stock.find(st => st.itemId === item.id && st.locationId === selectedLocation);
                    const loc = locations.find(l => l.id === selectedLocation);
                    if (s) {
                        labels.push({ itemId: item.id, description: item.description, locationName: loc?.name || selectedLocation, subLocationDetail: s.subLocationDetail });
                    }
                });
                break;

            case 'search':
                manualQueue.forEach(item => {
                    const itemStock = stock.filter(s => s.itemId === item.id);
                    if (itemStock.length > 0) {
                        itemStock.forEach(s => {
                            const loc = locations.find(l => l.id === s.locationId);
                            labels.push({ itemId: item.id, description: item.description, locationName: loc?.name || s.locationId, subLocationDetail: s.subLocationDetail });
                        });
                    } else {
                        labels.push({ itemId: item.id, description: item.description, locationName: 'PRODUCT SKU' });
                    }
                });
                break;
        }

        if (labels.length === 0) {
            alert('No labels to generate based on current selection.');
            return;
        }

        onGenerate(labels);
    };

    return (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center ${zIndexClassName || 'z-50'} p-4`}>
            <div className="modal-container max-w-xl overflow-hidden flex flex-col max-h-[90vh] bg-white rounded-2xl shadow-2xl">
                <div className="modal-header border-b border-gray-100 bg-white p-6">
                    <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                        <BarcodeIcon className="w-6 h-6 text-em-red" />
                        Label Batching Hub
                    </h2>
                    <button type="button" onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="modal-body overflow-y-auto space-y-6 p-6">
                    <div>
                        <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest mb-3">SELECT METHOD</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['search', 'selected', 'category', 'location'] as PrintType[]).map(t => (
                                <button 
                                    key={t}
                                    onClick={() => setPrintType(t)}
                                    className={`py-3 px-1 text-[11px] font-black uppercase rounded border-2 transition-all ${printType === t ? 'border-em-red bg-red-50 text-em-red' : 'border-gray-100 text-gray-700 hover:border-gray-200'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 md:p-6 rounded-xl border border-gray-100">
                        {printType === 'search' && (
                            <div className="space-y-4">
                                <div className="relative">
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-700" />
                                    <input 
                                        type="text" 
                                        className="form-control pl-10 h-12" 
                                        placeholder="SEARCH SKU OR NAME..." 
                                        value={searchQuery} 
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 bg-white shadow-xl rounded-b-lg border border-gray-200 mt-1 z-10 overflow-hidden">
                                            {searchResults.map(res => (
                                                <button 
                                                    key={res.id} 
                                                    onClick={() => addToQueue(res)}
                                                    className="w-full text-left p-4 hover:bg-red-50 flex items-center justify-between border-b last:border-0"
                                                >
                                                    <div className="min-w-0 pr-4">
                                                        <div className="text-sm font-black text-gray-900 uppercase truncate">{res.id}</div>
                                                        <div className="text-[10px] font-bold text-gray-700 uppercase truncate">{res.description}</div>
                                                    </div>
                                                    <PlusIcon className="w-6 h-6 text-em-red" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-widest">BATCH QUEUE ({manualQueue.length})</h4>
                                    {manualQueue.length === 0 ? (
                                        <p className="text-xs text-gray-700 font-bold italic text-center py-4">Search items to add them to your print queue</p>
                                    ) : (
                                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                                            {manualQueue.map(item => (
                                                <div key={item.id} className="bg-white p-3 rounded-lg border border-gray-200 flex items-center justify-between shadow-sm">
                                                    <div className="min-w-0 pr-4 text-left">
                                                        <span className="text-xs font-black text-gray-900 uppercase truncate block">{item.id}</span>
                                                        <span className="text-[9px] font-bold text-gray-700 uppercase truncate block">{item.description}</span>
                                                    </div>
                                                    <button onClick={() => removeFromQueue(item.id)} className="text-red-400 hover:text-red-600 transition-colors p-2"><TrashIcon className="w-5 h-5" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {printType === 'selected' && (
                            <div className="text-center py-8">
                                <div className="text-4xl font-black text-gray-900 mb-2">{selectedItemIds.size}</div>
                                <div className="text-xs font-bold text-gray-700 uppercase tracking-widest">ITEMS SELECTED FROM TABLE</div>
                            </div>
                        )}

                        {printType === 'category' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-black uppercase mb-2">Select Category</label>
                                    <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="form-control h-12">
                                        <option value="" disabled>CHOOSE...</option>
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {selectedCategory && locationsForCategory.length > 0 && (
                                    <div className="border rounded-lg border-gray-200 bg-white overflow-hidden flex flex-col max-h-64">
                                        <div className="bg-gray-100 p-3 border-b border-gray-200 flex items-center cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleAllSubset(locationsForCategory.map(l => l.id))}>
                                            <div className={`w-5 h-5 rounded border border-gray-400 bg-white flex items-center justify-center ${subsetSelection.size === locationsForCategory.length ? 'bg-em-red border-em-red' : ''}`}>
                                                {subsetSelection.size === locationsForCategory.length && <CheckIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="ml-3 text-xs font-black uppercase text-gray-700">SELECT ALL LOCATIONS</span>
                                        </div>
                                        <div className="overflow-y-auto p-2 space-y-1">
                                            {locationsForCategory.map(loc => (
                                                <div key={loc.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => toggleSubset(loc.id)}>
                                                    <div className={`w-5 h-5 rounded border border-gray-300 flex items-center justify-center transition-colors ${subsetSelection.has(loc.id) ? 'bg-em-red border-em-red' : 'bg-white'}`}>
                                                        {subsetSelection.has(loc.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="ml-3 text-sm font-bold text-gray-800 uppercase">{loc.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedCategory && locationsForCategory.length === 0 && (
                                    <p className="text-xs text-red-600 font-bold text-center">No stock found for this category.</p>
                                )}
                            </div>
                        )}

                        {printType === 'location' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-black uppercase mb-2">Select Warehouse</label>
                                    <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="form-control h-12">
                                        <option value="" disabled>CHOOSE...</option>
                                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                    </select>
                                </div>
                                {selectedLocation && itemsInLocation.length > 0 && (
                                    <div className="border rounded-lg border-gray-200 bg-white overflow-hidden flex flex-col max-h-64">
                                        <div className="bg-gray-100 p-3 border-b border-gray-200 flex items-center cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => toggleAllSubset(itemsInLocation.map(i => i.id))}>
                                            <div className={`w-5 h-5 rounded border border-gray-400 bg-white flex items-center justify-center ${subsetSelection.size === itemsInLocation.length ? 'bg-em-red border-em-red' : ''}`}>
                                                {subsetSelection.size === itemsInLocation.length && <CheckIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="ml-3 text-xs font-black uppercase text-gray-700">SELECT ALL PRODUCTS ({itemsInLocation.length})</span>
                                        </div>
                                        <div className="overflow-y-auto p-2 space-y-1">
                                            {itemsInLocation.map(item => (
                                                <div key={item.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer" onClick={() => toggleSubset(item.id)}>
                                                    <div className={`w-5 h-5 rounded border border-gray-300 flex items-center justify-center transition-colors shrink-0 ${subsetSelection.has(item.id) ? 'bg-em-red border-em-red' : 'bg-white'}`}>
                                                        {subsetSelection.has(item.id) && <CheckIcon className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="ml-3 min-w-0">
                                                        <div className="text-sm font-bold text-gray-900 uppercase truncate">{item.description}</div>
                                                        <div className="text-[10px] font-bold text-gray-500 uppercase">{item.id}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {selectedLocation && itemsInLocation.length === 0 && (
                                    <p className="text-xs text-red-600 font-bold text-center">No products found in this location.</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="modal-footer border-t border-gray-100 bg-gray-50 p-6 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-6 py-3 text-sm font-bold text-black uppercase hover:text-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleGenerate}
                        className="px-8 py-3 bg-em-red text-white text-sm font-bold rounded-lg shadow-lg hover:bg-red-700 transition-colors uppercase"
                    >
                        Generate
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GenerateBarcodeSheetModal;
