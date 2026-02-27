// components/InventoryCard.tsx
import React from 'react';
import { InventoryItemUI } from '../types';
import { EllipsisVerticalIcon } from './icons/EllipsisVerticalIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface InventoryCardProps {
    item: InventoryItemUI;
    isSelected: boolean;
    onToggleSelect: (itemId: string) => void;
    onClick: () => void;
    onAction: (item: InventoryItemUI) => void;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, isSelected, onToggleSelect, onClick, onAction }) => {
    // Dynamic styles based on stock status
    const statusColor = item.isLowStock ? 'border-l-red-600 bg-red-50/10' : 'border-l-blue-300 bg-blue-50/10';
    const textColor = item.isLowStock ? 'text-red-700' : 'text-gray-900';

    return (
        <div 
            onClick={onClick}
            className={`
                relative flex flex-col p-4 mb-3 bg-white rounded-2xl shadow-sm border border-gray-200 
                border-l-[6px] ${statusColor} ${isSelected ? 'ring-2 ring-em-red shadow-md' : ''} active:scale-[0.99] transition-all
            `}
        >
            <div className="mb-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect(item.id);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-em-red focus:ring-em-red"
                    />
                    Select
                </label>
                {isSelected && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-em-red">Selected</span>}
            </div>

            {/* Top Row: Title and Qty */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-[13px] font-black text-blue-900 uppercase leading-tight truncate tracking-tight">
                        {item.description}
                    </h3>
                    <span className="mt-1 inline-flex max-w-full rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-black text-em-red uppercase tracking-wider truncate">{item.id}</span>
                </div>

                <div className="text-right shrink-0">
                    <span className={`text-2xl font-black ${textColor} leading-none block`}>
                        {item.totalQuantity}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        UNITS
                    </span>
                </div>
            </div>

            {/* Bottom Row: Tags and Action */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100/70">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="inline-block px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-600 uppercase tracking-wide truncate max-w-[120px]">
                        {item.category}
                    </span>
                    {item.isLowStock && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                            <ExclamationTriangleIcon className="w-3 h-3" /> LOW
                        </span>
                    )}
                </div>

                <button 
                    onClick={(e) => {
                        e.stopPropagation(); // Stop the card click from firing
                        onAction(item);
                    }}
                    className="p-2 -mr-2 text-gray-400 hover:text-gray-800 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <EllipsisVerticalIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};
