
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon'; // Visual arrow
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';

interface MoveStockModalProps {
    item: InventoryItem;
    locations: Location[];
    stock: Stock[];
    onClose: () => void;
    onMoveStock: (itemId: string, fromLocationId: string, toLocationId: string, quantity: number, toSubLocationDetail?: string) => void;
    initialFromLocationId?: string;
}

const MoveStockModal: React.FC<MoveStockModalProps> = ({ item, locations, stock, onClose, onMoveStock, initialFromLocationId }) => {
    // Mode state: 'remove' = Move FROM Source, 'add' = Move TO Dest
    const [mode, setMode] = useState<'remove' | 'add'>('remove');
    
    const [fromLocationId, setFromLocationId] = useState(initialFromLocationId || '');
    const [toLocationId, setToLocationId] = useState('');
    
    // Quantity as string for better typing experience in large input
    const [quantityStr, setQuantityStr] = useState('');
    const [toSubLocationDetail, setToSubLocationDetail] = useState('');
    const [error, setError] = useState('');

    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus the large input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Effect to update pre-selection if prop changes (or initial load)
    useEffect(() => {
        if (initialFromLocationId) {
            setFromLocationId(initialFromLocationId);
        }
    }, [initialFromLocationId]);

    const itemStockByLocation = useMemo(() => {
        return stock.filter(s => s.itemId === item.id);
    }, [stock, item.id]);

    const availableFromLocations = useMemo(() => {
        const locationIdsWithStock = new Set(itemStockByLocation.map(s => s.locationId));
        return locations.filter(loc => locationIdsWithStock.has(loc.id));
    }, [locations, itemStockByLocation]);

    const maxQuantity = useMemo(() => {
        const fromStock = itemStockByLocation.find(s => s.locationId === fromLocationId);
        return fromStock ? fromStock.quantity : 0;
    }, [fromLocationId, itemStockByLocation]);

    const selectedToLocation = useMemo(() => locations.find(l => l.id === toLocationId), [locations, toLocationId]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuantityStr(e.target.value);
        if (error) setError('');
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const qty = parseInt(quantityStr, 10);

        if (!fromLocationId || !toLocationId) {
            setError('Please select both a "Source" and a "Destination" location.');
            return;
        }
        if (fromLocationId === toLocationId) {
            setError('Source and Destination locations cannot be the same.');
            return;
        }
        if (isNaN(qty) || qty <= 0) {
            setError('Quantity must be greater than zero.');
            return;
        }
        if (qty > maxQuantity) {
            setError(`Cannot move more than available stock (${maxQuantity}).`);
            return;
        }
        onMoveStock(item.id, fromLocationId, toLocationId, qty, toSubLocationDetail);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in-down">
            <div className="modal-container max-w-md bg-white rounded-lg shadow-2xl overflow-hidden">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 bg-neutral-900 text-white border-b border-neutral-800">
                        <h2 className="text-lg font-black tracking-wider uppercase flex items-center gap-2">
                            <ArrowRightLeftIcon className="w-5 h-5 text-red-500" />
                            Move Stock
                        </h2>
                        <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="p-6">
                        {/* Item Info */}
                        <div className="mb-6 text-center">
                            <h3 className="text-xl font-black text-neutral-900 leading-tight">{item.description}</h3>
                            <p className="text-sm font-bold text-neutral-500 mt-1">{item.id}</p>
                        </div>

                        {/* Action Toggles */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => setMode('remove')}
                                className={`
                                    py-4 px-2 rounded-lg font-black text-sm uppercase tracking-wider border-2 transition-all
                                    ${mode === 'remove' 
                                        ? 'bg-red-700 text-white border-red-700 shadow-lg scale-[1.02]' 
                                        : 'bg-white text-neutral-400 border-neutral-200 hover:border-red-200 hover:text-red-700'}
                                `}
                            >
                                <span className="block text-2xl mb-1">-</span>
                                Remove (From)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('add')}
                                className={`
                                    py-4 px-2 rounded-lg font-black text-sm uppercase tracking-wider border-2 transition-all
                                    ${mode === 'add' 
                                        ? 'bg-green-700 text-white border-green-700 shadow-lg scale-[1.02]' 
                                        : 'bg-white text-neutral-400 border-neutral-200 hover:border-green-200 hover:text-green-700'}
                                `}
                            >
                                <span className="block text-2xl mb-1">+</span>
                                Add (To)
                            </button>
                        </div>

                        {/* Large Quantity Input */}
                        <div className="mb-8 text-center relative">
                            <label htmlFor="quantity" className="block text-xs font-bold text-neutral-500 uppercase tracking-widest mb-2">
                                Quantity to Move
                            </label>
                            <input
                                ref={inputRef}
                                type="number"
                                id="quantity"
                                value={quantityStr}
                                onChange={handleQuantityChange}
                                placeholder="0"
                                className={`
                                    w-full text-center text-5xl font-black bg-neutral-50 border-2 rounded-xl py-4 focus:outline-none focus:ring-0
                                    ${mode === 'remove' ? 'text-red-700 border-red-200 focus:border-red-600' : 'text-green-700 border-green-200 focus:border-green-600'}
                                    placeholder-gray-300
                                `}
                                min="1"
                                max={maxQuantity}
                            />
                            {fromLocationId && (
                                <p className="text-xs font-bold text-neutral-400 mt-2">
                                    AVAILABLE AT SOURCE: <span className="text-neutral-900">{maxQuantity}</span>
                                </p>
                            )}
                        </div>

                        {/* Location Selectors - Order swaps based on mode for visual logic */}
                        <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            
                            {/* If Mode is ADD, show Destination First (Target-Centric) */}
                            {mode === 'add' && (
                                <div className="animate-fade-in-down">
                                    <label htmlFor="toLocation" className="text-xs font-bold text-green-700 uppercase tracking-widest mb-1 block">
                                        Destination (Add To)
                                    </label>
                                    <select 
                                        id="toLocation" 
                                        value={toLocationId} 
                                        onChange={(e) => setToLocationId(e.target.value)} 
                                        className="form-control font-bold text-neutral-900 border-green-200 focus:border-green-600 focus:ring-green-600"
                                    >
                                        <option value="" disabled>SELECT DESTINATION...</option>
                                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                    </select>
                                    {selectedToLocation?.subLocationPrompt && (
                                        <input 
                                            type="text" 
                                            value={toSubLocationDetail} 
                                            onChange={e => setToSubLocationDetail(e.target.value)} 
                                            className="form-control mt-2 text-sm" 
                                            placeholder={selectedToLocation.subLocationPrompt} 
                                        />
                                    )}
                                </div>
                            )}

                            {/* Source Location (Always present, just shifts position) */}
                            <div>
                                <label htmlFor="fromLocation" className={`text-xs font-bold uppercase tracking-widest mb-1 block ${mode === 'remove' ? 'text-red-700' : 'text-neutral-500'}`}>
                                    {mode === 'remove' ? 'Source (Remove From)' : 'From Source'}
                                </label>
                                <select 
                                    id="fromLocation" 
                                    value={fromLocationId} 
                                    onChange={(e) => setFromLocationId(e.target.value)} 
                                    className={`form-control font-bold text-neutral-900 ${mode === 'remove' ? 'border-red-200 focus:border-red-600 focus:ring-red-600' : 'border-gray-200'}`}
                                >
                                    <option value="" disabled>SELECT SOURCE...</option>
                                    {availableFromLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name} (Qty: {itemStockByLocation.find(s=>s.locationId===loc.id)?.quantity})</option>)}
                                </select>
                            </div>

                            {/* If Mode is REMOVE, show Destination Second */}
                            {mode === 'remove' && (
                                <div className="animate-fade-in-down">
                                    <div className="flex justify-center -my-2 relative z-10">
                                        <div className="bg-gray-200 p-1 rounded-full"><ArrowDownTrayIcon className="w-4 h-4 text-gray-500" /></div>
                                    </div>
                                    <label htmlFor="toLocation" className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 block">
                                        Move To
                                    </label>
                                    <select 
                                        id="toLocation" 
                                        value={toLocationId} 
                                        onChange={(e) => setToLocationId(e.target.value)} 
                                        className="form-control font-bold text-neutral-900 border-gray-200"
                                    >
                                        <option value="" disabled>SELECT DESTINATION...</option>
                                        {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                    </select>
                                    {selectedToLocation?.subLocationPrompt && (
                                        <input 
                                            type="text" 
                                            value={toSubLocationDetail} 
                                            onChange={e => setToSubLocationDetail(e.target.value)} 
                                            className="form-control mt-2 text-sm" 
                                            placeholder={selectedToLocation.subLocationPrompt} 
                                        />
                                    )}
                                </div>
                            )}
                             {/* If Mode is ADD, Source was second, show a connecting visual */}
                             {mode === 'add' && (
                                <div className="text-center text-xs font-bold text-gray-300 pt-1">
                                    ▲ MOVING FROM
                                </div>
                             )}

                        </div>

                        {error && <p className="text-red-600 font-bold text-sm text-center mt-4 bg-red-50 p-2 rounded">{error}</p>}
                    </div>

                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="px-6 py-3 text-sm font-bold text-neutral-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors uppercase"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className={`
                                px-8 py-3 text-sm font-bold text-white rounded-lg shadow-md transition-colors uppercase flex-grow md:flex-grow-0
                                ${mode === 'remove' ? 'bg-red-700 hover:bg-red-800' : 'bg-green-700 hover:bg-green-800'}
                            `}
                        >
                            Confirm {mode === 'remove' ? 'Move' : 'Add'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MoveStockModal;
