
import React, { useState, useMemo } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';

interface MassStockUpdateModalProps {
    items: InventoryItem[];
    locations: Location[];
    stock: Stock[];
    onClose: () => void;
    onUpdate: (updates: { itemId: string; locationId: string; newQty: number }[]) => void;
}

const MassStockUpdateModal: React.FC<MassStockUpdateModalProps> = ({ items, locations, stock, onClose, onUpdate }) => {
    const [filterType, setFilterType] = useState<'location' | 'category'>('location');
    const [filterValue, setFilterValue] = useState('');
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, number>>({});

    const filteredItemsForUpdate = useMemo(() => {
        if (!filterValue) return [];
        let matchingItems = [];
        if (filterType === 'location') {
            const stockInLoc = stock.filter(s => s.locationId === filterValue);
            matchingItems = stockInLoc.map(s => {
                const item = items.find(i => i.id === s.itemId);
                return { itemId: s.itemId, locationId: s.locationId, qty: s.quantity, description: item?.description || '' };
            });
        } else {
            const itemsInCat = items.filter(i => i.category === filterValue);
            matchingItems = itemsInCat.flatMap(item => {
                const itemStock = stock.filter(s => s.itemId === item.id);
                return itemStock.map(s => ({ itemId: s.itemId, locationId: s.locationId, qty: s.quantity, description: item.description }));
            });
        }
        return matchingItems;
    }, [filterType, filterValue, items, stock]);

    const categories = useMemo(() => Array.from(new Set(items.map(i => i.category || 'OTHER'))).sort(), [items]);

    const handleValueChange = (itemId: string, locId: string, val: string) => {
        const key = `${itemId}|${locId}`;
        setPendingUpdates(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
    };

    const handleConfirm = () => {
        const updates = Object.entries(pendingUpdates).map(([key, qty]) => {
            const [itemId, locationId] = key.split('|');
            return { itemId, locationId, newQty: qty };
        });
        onUpdate(updates);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in-down flex flex-col max-h-[90vh]">
                <div className="bg-white p-6 text-black flex justify-between items-center shrink-0 border-b border-gray-100">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-black">
                        <PencilSquareIcon className="w-6 h-6 text-em-red" />
                        Mass Stock Audit
                    </h2>
                    <button onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6 text-white"/>
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-6">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Filter Group By</label>
                            <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                                <button 
                                    onClick={() => { setFilterType('location'); setFilterValue(''); setPendingUpdates({}); }}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${filterType === 'location' ? 'bg-gray-100' : 'bg-white'}`}
                                >
                                    Location
                                </button>
                                <button 
                                    onClick={() => { setFilterType('category'); setFilterValue(''); setPendingUpdates({}); }}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest ${filterType === 'category' ? 'bg-gray-100' : 'bg-white border-l'}`}
                                >
                                    Category
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1 block">Select {filterType}</label>
                            <select value={filterValue} onChange={e => { setFilterValue(e.target.value); setPendingUpdates({}); }} className="form-control">
                                <option value="">Select Option...</option>
                                {filterType === 'location' 
                                    ? locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)
                                    : categories.map(c => <option key={c} value={c}>{c}</option>)
                                }
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {filteredItemsForUpdate.length === 0 ? (
                            <div className="p-12 text-center text-gray-300 font-black uppercase text-xs">Select a group to begin audit</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {filteredItemsForUpdate.map(row => {
                                    const key = `${row.itemId}|${row.locationId}`;
                                    const currentVal = pendingUpdates[key] !== undefined ? pendingUpdates[key] : row.qty;
                                    const locName = locations.find(l=>l.id===row.locationId)?.name || row.locationId;
                                    return (
                                        <div key={key} className="py-4 flex items-center justify-between group">
                                            <div className="min-w-0 pr-4">
                                                <div className="text-xs font-black text-gray-900 uppercase truncate">{row.description}</div>
                                                <div className="text-[9px] font-bold text-gray-400 uppercase">{row.itemId} • {locName}</div>
                                            </div>
                                            <div className="w-24">
                                                <input 
                                                    type="number" 
                                                    className={`form-control text-center font-black ${pendingUpdates[key] !== undefined ? 'border-em-red text-em-red' : ''}`}
                                                    value={currentVal} 
                                                    onChange={e => handleValueChange(row.itemId, row.locationId, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="px-6 py-3 text-xs font-black text-gray-400 hover:text-gray-900 uppercase">Cancel</button>
                    <button 
                        disabled={Object.keys(pendingUpdates).length === 0}
                        onClick={handleConfirm}
                        className="px-8 py-3 bg-em-red disabled:bg-gray-300 text-white text-xs font-black rounded-lg shadow-lg hover:bg-red-700 transition-colors uppercase"
                    >
                        Commit Updates ({Object.keys(pendingUpdates).length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MassStockUpdateModal;
