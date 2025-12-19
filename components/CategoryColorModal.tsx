
import React, { useState, useMemo } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { InventoryItem, Stock, Location, PrintableLabel } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';

interface GenerateBarcodeSheetModalProps {
    onClose: () => void;
    onGenerate: (labels: PrintableLabel[]) => void;
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    selectedItemIds: Set<string>;
}

type PrintType = 'selected' | 'category' | 'location' | 'search';

const GenerateBarcodeSheetModal: React.FC<GenerateBarcodeSheetModalProps> = ({ onClose, onGenerate, items, stock, locations, selectedItemIds }) => {
    const [printType, setPrintType] = useState<PrintType>('search');
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [manualQueue, setManualQueue] = useState<InventoryItem[]>([]);

    const categories = useMemo(() => {
        const cats = new Set(items.map(item => item.category || 'Uncategorized'));
        return Array.from(cats).sort();
    }, [items]);

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

    const handleGenerate = () => {
        let labels: PrintableLabel[] = [];
        const itemsToProcess: InventoryItem[] = [];

        switch (printType) {
            case 'selected':
                items.forEach(item => {
                    if (selectedItemIds.has(item.id)) itemsToProcess.push(item);
                });
                break;
            case 'category':
                items.forEach(item => {
                    if ((item.category || 'Uncategorized') === selectedCategory) itemsToProcess.push(item);
                });
                break;
            case 'location':
                const locationObj = locations.find(l => l.id === selectedLocation);
                const locName = locationObj?.name.toLowerCase();
                const locId = selectedLocation.toLowerCase();

                const itemIdsInLocation = new Set(stock.filter(s => {
                    const sLocId = s.locationId.toLowerCase();
                    return sLocId === locId || sLocId === locName;
                }).map(s => s.itemId));
                
                items.forEach(item => {
                    if (itemIdsInLocation.has(item.id)) itemsToProcess.push(item);
                });
                break;
            case 'search':
                itemsToProcess.push(...manualQueue);
                break;
        }

        if (itemsToProcess.length === 0) {
            alert('No items found for the current selection.');
            return;
        }

        itemsToProcess.forEach(item => {
            const itemStock = stock.filter(s => {
                const sLocId = s.locationId.toLowerCase();
                if (printType === 'location') {
                    const locationObj = locations.find(l => l.id === selectedLocation);
                    const locName = locationObj?.name.toLowerCase();
                    const locId = selectedLocation.toLowerCase();
                    return s.itemId === item.id && (sLocId === locId || sLocId === locName);
                }
                return s.itemId === item.id;
            });

            if (itemStock.length > 0) {
                itemStock.forEach(s => {
                    const location = locations.find(l => l.id.toLowerCase() === s.locationId.toLowerCase() || l.name.toLowerCase() === s.locationId.toLowerCase());
                    labels.push({
                        itemId: item.id,
                        description: item.description,
                        locationName: location ? location.name : s.locationId.toUpperCase(),
                        subLocationDetail: s.subLocationDetail,
                    });
                });
            } else if (printType !== 'location') {
                 labels.push({
                    itemId: item.id,
                    description: item.description,
                    locationName: 'NO STOCK',
                });
            }
        });

        if (labels.length === 0) {
            alert('No labels to generate for the current selection.');
            return;
        }

        onGenerate(labels);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                            <div className="py-4">
                                <label className="text-[10px] font-black text-black uppercase mb-2">Select Category</label>
                                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="form-control h-12">
                                    <option value="" disabled>CHOOSE...</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        {printType === 'location' && (
                            <div className="py-4">
                                <label className="text-[10px] font-black text-black uppercase mb-2">Select Warehouse</label>
                                <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="form-control h-12">
                                    <option value="" disabled>CHOOSE...</option>
                                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                </select>
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
