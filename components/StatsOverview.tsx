import React, { useMemo, useState } from 'react';
import { InventoryItem, Stock, Location } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';

interface StatsOverviewProps {
    items: InventoryItem[];
    stock: Stock[];
    locations: Location[];
    currentView: string;
    onSetFilterLocation: (locationId: string) => void;
    onLowStockClick: () => void;
    onAddItemClick: () => void;
    onReportClick: () => void;
    onBarcodeClick: () => void;
    onLocationsClick: () => void;
    onActivityClick: () => void;
    // Admin Props
    onAdminCategories: () => void;
    onAdminLocations: () => void;
    onAdminPurge: () => void;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ 
    items, 
    stock, 
    locations,
    currentView,
    onSetFilterLocation,
    onLowStockClick,
    onAddItemClick,
    onReportClick,
    onBarcodeClick,
    onLocationsClick,
    onActivityClick,
    onAdminCategories,
    onAdminLocations,
    onAdminPurge
}) => {
    const [isAlertDismissed, setIsAlertDismissed] = useState(false);
    
    const lowStockCount = useMemo(() => {
        const itemStockMap = new Map<string, number>();
        stock.forEach(s => {
            itemStockMap.set(s.itemId, (itemStockMap.get(s.itemId) || 0) + s.quantity);
        });

        return items.filter(item => {
            const qty = itemStockMap.get(item.id) || 0;
            return item.lowAlertQuantity !== undefined && qty <= item.lowAlertQuantity;
        }).length;
    }, [items, stock]);

    const buttonBaseClass = "flex items-center justify-center gap-4 p-5 rounded-2xl shadow-sm active:scale-[0.98] transition-all w-full";
    const iconBaseClass = "w-8 h-8 stroke-[2]";

    return (
        <div className="flex flex-col gap-4 mb-6 md:mb-0">
            
            {/* Mobile Actions List */}
            <div className="flex flex-col gap-4 md:hidden">
                
                <button onClick={onAddItemClick} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-em-red"><PlusIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Add Item</span>
                </button>
                
                <button onClick={onLocationsClick} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-neutral-600"><MapPinIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Locations</span>
                </button>

                <button onClick={onReportClick} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-blue-600"><DocumentChartBarIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Reports</span>
                </button>

                <button onClick={onActivityClick} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-neutral-500"><ClockIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Activity</span>
                </button>
                
                <button onClick={onBarcodeClick} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-purple-600"><BarcodeIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Print Barcode</span>
                </button>

                {/* Admin Section Separator */}
                <div className="flex items-center gap-4 py-2 opacity-50">
                    <div className="h-px bg-gray-400 flex-1"></div>
                    <span className="text-xs font-black uppercase text-gray-500">ADMIN</span>
                    <div className="h-px bg-gray-400 flex-1"></div>
                </div>

                <button onClick={onAdminCategories} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-gray-800"><PencilSquareIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Edit Categories</span>
                </button>

                <button onClick={onAdminLocations} className={`${buttonBaseClass} bg-white`}>
                    <div className="text-gray-800"><MapPinIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-neutral-800 uppercase tracking-wide">Edit Locations</span>
                </button>

                <button onClick={onAdminPurge} className={`${buttonBaseClass} bg-red-50 border border-red-100`}>
                    <div className="text-red-600"><TrashIcon className={iconBaseClass} /></div>
                    <span className="text-lg font-black text-red-900 uppercase tracking-wide">Purge Items</span>
                </button>

                {lowStockCount > 0 && !isAlertDismissed && (
                    <div 
                        onClick={onLowStockClick} 
                        className={`relative ${buttonBaseClass} bg-red-50 animate-pulse cursor-pointer mt-2`}
                        role="button"
                    >
                        <ExclamationTriangleIcon className={`${iconBaseClass} text-red-600`} />
                        <span className="text-lg font-black text-red-800 uppercase tracking-wide">
                            Low Stock Alerts ({lowStockCount})
                        </span>
                        
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAlertDismissed(true);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-red-400 hover:text-red-700 hover:bg-red-100 rounded-full transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsOverview;
