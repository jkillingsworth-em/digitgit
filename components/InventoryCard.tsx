// components/InventoryCard.tsx
import React from 'react';
import { InventoryItemUI } from '../types';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';

interface InventoryCardProps {
    item: InventoryItemUI;
    isSelected: boolean;
    onToggleSelect: (itemId: string) => void;
    onClick: () => void;
    onMove: () => void;
    onAction: (item: InventoryItemUI) => void;
}

export const InventoryCard: React.FC<InventoryCardProps> = ({ item, isSelected, onToggleSelect, onClick, onAction, onMove }) => {
    // Dynamic styles based on stock status
    const statusColor = item.isLowStock ? 'border-l-red-600 bg-red-50/10' : 'border-l-blue-300 bg-blue-50/10';
    const textColor = item.isLowStock ? 'text-red-700' : 'text-neutral-900';

    return (
        <div
            onClick={onClick}
            className={`
 relative flex flex-col p-4 mb-3 bg-white rounded-2xl shadow-sm border border-neutral-200
 border-l-[6px] ${statusColor} ${isSelected ? 'ring-2 ring-em-red shadow-md' : ''} active:scale-[0.99] transition-all
            `}
        >
            <div onClick={e => e.stopPropagation()} className="mb-2 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500">
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect(item.id);
                        }}
                        className="w-4 h-4 rounded border-neutral-300 text-em-red focus:ring-em-red"
                    />
                    Select
                </label>
                {isSelected && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-em-red">Selected</span>}
            </div>

            {/* Top Row: Title and Qty */}
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900 leading-snug line-clamp-2">
                        <button type="button" className="text-left" onClick={event => { event.stopPropagation(); onClick(); }}>{item.description}</button>
                    </h3>
                    <span className="mt-1 inline-flex max-w-full rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-em-red truncate">{item.id}</span>
                </div>

                <div className="text-right shrink-0">
                    <span className={`text-2xl font-bold ${textColor} leading-none block`}>
                        {item.totalQuantity}
                    </span>
                    <span className="text-xs font-medium text-neutral-500">
                        UNITS
                    </span>
                </div>
            </div>

            {/* Bottom Row: Tags and Action */}
            <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-100/70">
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="inline-block px-2 py-1 rounded text-xs font-bold bg-neutral-100 text-neutral-600 tracking-wide truncate max-w-[120px]">
                        {item.category}
                    </span>
                    {item.isLowStock && (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                            <ExclamationTriangleIcon className="w-3 h-3" /> LOW
                        </span>
                    )}
                </div>

                <div className="flex shrink-0 gap-2">
                <button className="min-h-11 rounded-lg bg-red-50 px-3 text-sm font-semibold text-red-800" onClick={e => { e.stopPropagation(); onMove(); }}>Move</button>
                <button aria-label={`More actions for ${item.id}`}
                    onClick={(e) => {
                        e.stopPropagation(); // Stop the card click from firing
                        onAction(item);
                    }}
                    className="p-2 -mr-2 text-neutral-400 hover:text-neutral-800 rounded-full hover:bg-neutral-100 transition-colors"
                >
                    <span className="text-sm font-semibold">More</span>
                </button>
                </div>
            </div>
        </div>
    );
};
