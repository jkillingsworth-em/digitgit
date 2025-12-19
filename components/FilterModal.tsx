
import React from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { Location } from '../types';
import { CheckIcon } from './icons/CheckIcon'; 

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { category: string; location: string }) => void;
    onClear: () => void;
    locations: Location[];
    categoryHierarchy: Record<string, Set<string>>;
    currentCategory: string;
    currentLocation: string;
    // Updated view type to include 'dashboard'
    view: 'all' | 'categories' | 'locations' | 'dashboard';
}

const FilterModal: React.FC<FilterModalProps> = ({
    isOpen, onClose, onApply, onClear, locations, categoryHierarchy, currentCategory, currentLocation, view
}) => {
    
    if (!isOpen) return null;

    const handleCategoryClick = (val: string) => {
        // When selecting a category, clear location to ensure a valid view
        onApply({ category: val, location: '' });
        onClose();
    };

    const handleLocationClick = (val: string) => {
        // When selecting a location, clear category
        onApply({ category: '', location: val });
        onClose();
    };

    const handleClearAll = () => {
        onClear();
        onClose();
    };

    const CategorySection = (
        <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
                    <h3 className="text-lg font-black text-black uppercase tracking-wide">Category</h3>
                    {currentCategory && <button onClick={() => handleCategoryClick('')} className="text-xs font-bold text-em-red hover:underline mb-1">RESET</button>}
            </div>
            
            <div className="space-y-1">
                <button 
                    onClick={() => handleCategoryClick('')} 
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${currentCategory === '' ? 'bg-gray-100 text-gray-900 ring-2 ring-gray-200' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                    ALL CATEGORIES
                </button>
                
                {Object.keys(categoryHierarchy).sort().map(cat => (
                    <div key={cat} className="space-y-1">
                        <button 
                            onClick={() => handleCategoryClick(cat)} 
                            className={`
                                w-full flex justify-between items-center px-4 py-3 rounded-lg text-sm font-bold transition-all
                                ${currentCategory === cat ? 'bg-em-red text-white shadow-md' : 'text-gray-800 hover:bg-gray-50 border border-transparent'}
                            `}
                        >
                            {cat}
                            {currentCategory === cat && <CheckIcon className="w-4 h-4" />}
                        </button>
                        
                        {/* Sub Categories */}
                        {Array.from(categoryHierarchy[cat]).sort().map(sub => {
                            const val = `${cat}|${sub}`;
                            const isActive = currentCategory === val;
                            return (
                                <button 
                                    key={val} 
                                    onClick={() => handleCategoryClick(val)} 
                                    className={`
                                        w-[calc(100%-1.5rem)] ml-6 flex justify-between items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                                        ${isActive ? 'bg-red-50 text-em-red border border-red-100' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}
                                    `}
                                >
                                    <span>{sub}</span>
                                    {isActive && <div className="w-2 h-2 rounded-full bg-em-red"></div>}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );

    const LocationSection = (
        <div className="space-y-3">
            <div className="flex justify-between items-end mb-2">
                    <h3 className="text-lg font-black text-black uppercase tracking-wide">Location</h3>
                    {currentLocation && <button onClick={() => handleLocationClick('')} className="text-xs font-bold text-em-red hover:underline mb-1">RESET</button>}
            </div>
            
            <div className="grid grid-cols-1 gap-2">
                <button 
                    onClick={() => handleLocationClick('')} 
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all ${currentLocation === '' ? 'bg-gray-100 text-gray-900 ring-2 ring-gray-200' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                    ALL LOCATIONS
                </button>
                {locations.map(loc => (
                    <button 
                        key={loc.id} 
                        onClick={() => handleLocationClick(loc.id)} 
                        className={`
                            w-full flex justify-between items-center px-4 py-3 rounded-lg text-sm font-bold transition-all
                            ${currentLocation === loc.id ? 'bg-em-red text-white shadow-md' : 'text-gray-800 hover:bg-gray-50 border border-gray-200'}
                        `}
                    >
                        {loc.name}
                        {currentLocation === loc.id && <CheckIcon className="w-4 h-4" />}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end md:items-stretch md:justify-end animate-fade-in" onClick={onClose}>
            <div 
                className="
                    w-full bg-white shadow-2xl flex flex-col
                    rounded-t-2xl max-h-[85vh] 
                    md:max-h-full md:h-full md:w-96 md:rounded-none
                    transform transition-transform duration-300 ease-out
                "
                onClick={(e) => e.stopPropagation()}
                style={{ animation: 'slideIn 0.3s ease-out forwards' }}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-2xl md:rounded-none shrink-0">
                    <h2 className="text-lg font-bold text-gray-900 tracking-wide uppercase">Filters</h2>
                    <button type="button" onClick={onClose} className="bg-em-red text-white p-1.5 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-grow overflow-y-auto p-6 space-y-8 bg-white">
                    {view === 'locations' ? (
                        <>
                            {LocationSection}
                            <div className="h-px bg-gray-200"></div>
                            {CategorySection}
                        </>
                    ) : (
                        <>
                            {CategorySection}
                            <div className="h-px bg-gray-200"></div>
                            {LocationSection}
                        </>
                    )}
                    
                    {/* Spacer for bottom scrolling */}
                    <div className="h-4"></div>
                </div>

                {/* Footer */}
                <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50 shrink-0">
                     <button 
                        type="button" 
                        onClick={handleClearAll} 
                        className="w-full px-4 py-3 text-sm font-bold text-gray-800 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:text-black transition-colors uppercase"
                    >
                        Clear All Filters
                    </button>
                </div>
            </div>
             <style>{`
                @keyframes slideIn {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @media (min-width: 768px) {
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                }
            `}</style>
        </div>
    );
};

export default FilterModal;
