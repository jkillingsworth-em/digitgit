import React, { useMemo } from 'react';
import { InventoryItem, Stock } from '../types';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { CheckIcon } from './icons/CheckIcon';
import { TrashIcon } from './icons/TrashIcon';

interface DatabaseAuditProps {
    items: InventoryItem[];
    stock: Stock[];
    onFixItem: (item: InventoryItem) => Promise<void>;
    onDeleteStock: (stock: Stock) => Promise<void>;
    onBack: () => void;
    onTriggerPurge: () => void;
    onPurgeLegacyCategoryColors: () => void;
}

const DatabaseAudit: React.FC<DatabaseAuditProps> = ({ items, stock, onFixItem, onDeleteStock, onBack, onTriggerPurge, onPurgeLegacyCategoryColors }) => {
    const orphanStock = useMemo(() => {
        const itemIds = new Set(items.map(item => item.id));
        return stock.filter(entry => !itemIds.has(entry.itemId));
    }, [items, stock]);

    const invalidItems = useMemo(() => items.filter(item => !item.description || !item.category || item.description.trim() === '' || item.category.trim() === ''), [items]);

    const negativeStock = useMemo(() => stock.filter(entry => entry.quantity < 0), [stock]);
    const isHealthy = orphanStock.length === 0 && invalidItems.length === 0 && negativeStock.length === 0;

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight flex items-center gap-3">
                        {isHealthy ? <CheckIcon className="w-8 h-8 text-green-600" /> : <ExclamationTriangleIcon className="w-8 h-8 text-amber-500" />} Database Management
                    </h2>
                    <p className="text-sm font-bold text-gray-500 mt-1">Health check and advanced data operations.</p>
                </div>
                <div className="flex gap-2 mt-4 md:mt-0">
                    <button onClick={onPurgeLegacyCategoryColors} className="px-6 py-3 bg-amber-500 text-white font-bold uppercase rounded-lg hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-2">
                        <TrashIcon className="w-5 h-5" /> Purge Legacy Colors
                    </button>
                    <button onClick={onTriggerPurge} className="px-6 py-3 bg-red-600 text-white font-bold uppercase rounded-lg hover:bg-red-700 transition-colors shadow-sm flex items-center gap-2">
                        <TrashIcon className="w-5 h-5" /> Purge Database
                    </button>
                    <button onClick={onBack} className="px-6 py-3 bg-gray-100 text-gray-800 font-bold uppercase rounded-lg hover:bg-gray-200 transition-colors">
                        Back to Dashboard
                    </button>
                </div>
            </div>
            <div className="space-y-6">
                {orphanStock.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
                        <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                            <h3 className="text-red-800 font-black uppercase text-sm tracking-wide">Orphan Stock Records ({orphanStock.length})</h3>
                            <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-1 rounded border border-red-100">CRITICAL</span>
                        </div>
                        <div className="p-4">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-black text-gray-500">Missing Item ID</th>
                                            <th className="p-3 font-black text-gray-500">Location</th>
                                            <th className="p-3 font-black text-gray-500">Qty</th>
                                            <th className="p-3 font-black text-gray-500 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {orphanStock.map(entry => (
                                            <tr key={`${entry.itemId}-${entry.locationId}-${entry.docId}`}>
                                                <td className="p-3 font-mono font-bold text-red-600">{entry.itemId}</td>
                                                <td className="p-3 font-bold text-gray-700">{entry.locationId}</td>
                                                <td className="p-3 font-bold text-gray-900">{entry.quantity}</td>
                                                <td className="p-3 text-right">
                                                    <button onClick={() => onDeleteStock(entry)} className="text-red-600 hover:text-red-800 font-bold uppercase flex items-center gap-1 justify-end ml-auto">
                                                        <TrashIcon className="w-4 h-4" /> Purge
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {invalidItems.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                        <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                            <h3 className="text-amber-800 font-black uppercase text-sm tracking-wide">Incomplete Item Records ({invalidItems.length})</h3>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-1 gap-2">
                                {invalidItems.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                                        <div>
                                            <span className="font-black text-gray-900 mr-2">{item.id}</span>
                                            <span className="text-xs text-gray-500">Missing fields required for proper display</span>
                                        </div>
                                        <button onClick={() => onFixItem({ ...item, category: item.category || 'UNCATEGORIZED', description: item.description || 'UNKNOWN ITEM' })} className="text-blue-600 hover:text-blue-800 text-xs font-black uppercase border border-blue-200 px-3 py-1 rounded bg-white hover:bg-blue-50">
                                            Auto-Fill Defaults
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {negativeStock.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                        <div className="bg-amber-50 p-4 border-b border-amber-100 flex justify-between items-center">
                            <h3 className="text-amber-800 font-black uppercase text-sm tracking-wide">Negative Stock Records ({negativeStock.length})</h3>
                        </div>
                        <div className="p-4">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="p-3 font-black text-gray-500">Item ID</th>
                                            <th className="p-3 font-black text-gray-500">Location</th>
                                            <th className="p-3 font-black text-gray-500">Qty</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {negativeStock.map(entry => (
                                            <tr key={`${entry.itemId}-${entry.locationId}-${entry.docId}-neg`}>
                                                <td className="p-3 font-mono font-bold text-amber-600">{entry.itemId}</td>
                                                <td className="p-3 font-bold text-gray-700">{entry.locationId}</td>
                                                <td className="p-3 font-bold text-gray-900">{entry.quantity}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {isHealthy && (
                    <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-green-200">
                        <CheckIcon className="w-16 h-16 text-green-200 mx-auto mb-4" />
                        <h3 className="text-lg font-black text-green-800 uppercase">Database Integrity Verified</h3>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DatabaseAudit;
