// components/InventoryCard.tsx
import React from 'react';
import { InventoryItemUI } from '../types';
import { EllipsisVerticalIcon } from './icons/EllipsisVerticalIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface InventoryCardProps {
    item: InventoryItemUI;
    onClick: () => void;
    onAction: (item: InventoryItemUI) => void;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, onClick, onAction }) => {
    // Dynamic styles based on stock status
    const statusColor = item.isLowStock ? 'border-l-red-600 bg-red-50/10' : 'border-l-gray-300';
    const textColor = item.isLowStock ? 'text-red-700' : 'text-gray-900';

    return (
        <div 
            onClick={onClick}
            className={`
                relative flex flex-col p-4 mb-3 bg-white rounded-lg shadow-sm border border-gray-200 
                border-l-[6px] ${statusColor} active:scale-[0.99] transition-all
            `}
        >
            {/* Top Row: Title and Qty */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-gray-800 uppercase leading-tight truncate">
                        {item.description}
                    </h3>
                    <p className="text-[10px] font-bold text-gray-500 mt-1 uppercase tracking-wider">
                        {item.id}
                    </p>
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
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100/50">
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
