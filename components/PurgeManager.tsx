import React, { useState } from 'react';
import InventoryTable from './InventoryTable';
import { InventoryItem, Location, Stock } from '../types';
import { TrashIcon } from './icons/TrashIcon';

interface PurgeManagerProps {
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    onBatchDelete: (ids: string[]) => Promise<void>;
    onBack: () => void;
    // Pass-through props needed for table render
    categoryColors: Record<string, string>;
}

const PurgeManager: React.FC<PurgeManagerProps> = ({ items, stock, locations, onBatchDelete, onBack, categoryColors }) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    
    // Dummy props for table read-only mode
    const noOp = () => {};

    const handlePurge = async () => {
        if (selectedIds.size === 0) return;
        
        // Warning 1
        if (!window.confirm(`WARNING: You are about to PERMANENTLY DELETE ${selectedIds.size} items.\n\nContinue?`)) return;
        
        // Warning 2
        if (!window.confirm(`FINAL WARNING: This action cannot be undone. Are you absolutely sure?`)) return;

        await onBatchDelete(Array.from(selectedIds));
        setSelectedIds(new Set());
    };

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-red-50 p-6 rounded-lg border-2 border-red-100 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-red-900 uppercase tracking-tight flex items-center gap-2">
                        <TrashIcon className="w-8 h-8"/> Purge Items
                    </h2>
                    <p className="text-sm font-bold text-red-700 mt-1">Select items below to permanently remove them from the database.</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <button onClick={onBack} className="px-6 py-3 bg-white text-gray-900 font-bold uppercase rounded-lg shadow-sm hover:bg-gray-50 flex-1 md:flex-none">Cancel</button>
                    <button 
                        onClick={handlePurge}
                        disabled={selectedIds.size === 0}
                        className="px-8 py-3 bg-red-600 text-white font-black uppercase rounded-lg shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex-1 md:flex-none"
                    >
                        Delete Selected ({selectedIds.size})
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                 <InventoryTable
                    items={items}
                    locations={locations}
                    stock={stock}
                    // Enable selection
                    selectedItemIds={selectedIds}
                    onSelectionChange={(id) => setSelectedIds(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
                        return newSet;
                    })}
                    onSelectAll={(ids, select) => setSelectedIds(prev => {
                        const newSet = new Set(prev);
                        ids.forEach(id => select ? newSet.add(id) : newSet.delete(id));
                        return newSet;
                    })}
                    // Disable other actions
                    onMoveClick={noOp}
                    onDeleteClick={noOp}
                    onDuplicateClick={noOp}
                    onEditClick={noOp}
                    onPrintBarcode={noOp}
                    onPrintSpecificLabel={noOp}
                    onGenerateReportForItem={noOp}
                    onBulkEditClick={noOp}
                    categoryColors={categoryColors}
                    // Search/Filter state (local to this view)
                    view="all"
                    searchQuery={searchQuery}
                    filterCategory=""
                    filterLocation=""
                    filterLowStock={false}
                    onSetFilterCategory={noOp}
                    onSetFilterLocation={noOp}
                    onSetFilterLowStock={noOp}
                    onViewChange={noOp}
                />
            </div>
            
            {/* Overlay Search Input for this view */}
            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t border-gray-200 md:hidden z-30">
                 <input 
                    className="form-control" 
                    placeholder="Search items to delete..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
        </div>
    );
};

export default PurgeManager;
