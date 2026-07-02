import React, { useState, useMemo } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';

interface BulkTransferModalProps {
    items: InventoryItem[];
    locations: Location[];
    stock: Stock[];
    onClose: () => void;
    onTransfer: (transfers: { itemId: string; fromLoc: string; toLoc: string; qty: number; }[]) => void;
}

const BulkTransferModal: React.FC<BulkTransferModalProps> = ({ items, locations, stock, onClose, onTransfer }) => {
    const [fromLoc, setFromLoc] = useState('');
    const [toLoc, setToLoc] = useState('');
    const [transferList, setTransferList] = useState<{ itemId: string; qty: number; key: number }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const fromStock = useMemo(() => {
        if (!fromLoc) return [];
        return stock.filter(s => s.locationId === fromLoc);
    }, [fromLoc, stock]);

    const filteredOptions = useMemo(() => {
        if (searchQuery.length < 2) return [];
        const lower = searchQuery.toLowerCase();
        return fromStock
            .map(s => {
                const item = items.find(i => i.id === s.itemId);
                return { ...s, description: item?.description || '' };
            })
            .filter(s => s.itemId.toLowerCase().includes(lower) || s.description.toLowerCase().includes(lower))
            .slice(0, 5);
    }, [searchQuery, fromStock, items]);

    const addTransfer = (itemId: string, maxQty: number) => {
        if (transferList.some(t => t.itemId === itemId)) return;
        setTransferList([...transferList, { itemId, qty: 1, key: Date.now() }]);
        setSearchQuery('');
    };

    const removeTransfer = (key: number) => setTransferList(transferList.filter(t => t.key !== key));

    const updateQty = (key: number, q: number) => {
        const avail = fromStock.find(s => s.itemId === transferList.find(t => t.key === key)?.itemId)?.quantity ?? 0;
        const clamped = Math.min(Math.max(1, q), avail);
        setTransferList(transferList.map(t => t.key === key ? { ...t, qty: clamped } : t));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-fade-in-down flex flex-col max-h-[90vh]">
                <div className="bg-white p-6 text-black flex justify-between items-center shrink-0 border-b border-gray-100">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-black">
                        <ArrowRightLeftIcon className="w-6 h-6 text-em-red" />
                        Batch Stock Transfer
                    </h2>
                    <button onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6 text-white"/>
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-xs font-black text-black uppercase tracking-widest mb-1 block">From Source</label>
                            <select value={fromLoc} onChange={e => { setFromLoc(e.target.value); setTransferList([]); }} className="form-control">
                                <option value="">Select Warehouse...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-black text-black uppercase tracking-widest mb-1 block">To Destination</label>
                            <select value={toLoc} onChange={e => setToLoc(e.target.value)} className="form-control">
                                <option value="">Select Warehouse...</option>
                                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {fromLoc && (
                        <div className="relative">
                            <label className="text-xs font-black text-black uppercase tracking-widest mb-1 block">Search Item to Add</label>
                            <input 
                                type="text" 
                                className="form-control" 
                                placeholder="Type SKU or Description..." 
                                value={searchQuery} 
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {filteredOptions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white shadow-xl border border-gray-100 rounded-b-lg mt-1 z-10">
                                    {filteredOptions.map(opt => (
                                        <button 
                                            key={opt.itemId}
                                            onClick={() => addTransfer(opt.itemId, opt.quantity)}
                                            className="w-full text-left p-4 hover:bg-gray-50 flex justify-between items-center border-b last:border-0"
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm font-black text-gray-900 uppercase">{opt.itemId}</div>
                                                <div className="text-[10px] font-bold text-gray-700 truncate uppercase">{opt.description}</div>
                                            </div>
                                            <div className="text-xs font-black text-em-red shrink-0">{opt.quantity} AVAILABLE</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Items Ready for Transfer</h4>
                        {transferList.length === 0 ? (
                            <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl text-center text-xs font-black text-gray-700">
                                SEARCH AND ADD ITEMS TO BEGIN BATCH
                            </div>
                        ) : (
                            transferList.map(t => {
                                const avail = fromStock.find(s => s.itemId === t.itemId)?.quantity || 0;
                                return (
                                    <div key={t.key} className="flex items-center gap-4 bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                                        <div className="flex-grow min-w-0">
                                            <div className="text-sm font-black text-gray-900 uppercase truncate">{t.itemId}</div>
                                            <div className="text-[9px] font-bold text-gray-700 uppercase">Available: {avail}</div>
                                        </div>
                                        <div className="w-24">
                                            <input 
                                                type="number" 
                                                className="form-control text-center font-black" 
                                                value={t.qty} 
                                                min="1" 
                                                max={avail}
                                                onChange={e => updateQty(t.key, parseInt(e.target.value) || 0)}
                                            />
                                        </div>
                                        <button onClick={() => removeTransfer(t.key)} className="text-red-400 hover:text-red-600 p-2"><TrashIcon className="w-5 h-5"/></button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100 shrink-0">
                    <button onClick={onClose} className="px-6 py-3 text-xs font-black text-gray-700 hover:text-gray-900 uppercase">Cancel</button>
                    <button
                        disabled={transferList.length === 0 || !fromLoc || !toLoc || fromLoc === toLoc || transferList.some(t => t.qty > (fromStock.find(s => s.itemId === t.itemId)?.quantity ?? 0) || t.qty < 1)}
                        onClick={() => onTransfer(transferList.map(t => ({ ...t, fromLoc, toLoc })))}
                        className="px-8 py-3 bg-em-red disabled:bg-gray-700 text-white text-xs font-black rounded-lg shadow-lg hover:bg-red-700 transition-colors uppercase"
                    >
                        Execute Transfer
                    </button>
                </div>
            </div>
        </div>
    );
};

// Fix: Added missing default export for BulkTransferModal component
export default BulkTransferModal;