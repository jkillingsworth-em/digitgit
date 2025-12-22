import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { Location } from '../types';
import { CheckIcon } from './icons/CheckIcon'; 
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { category: string; location: string }) => void;
    onClear: () => void;
    locations: Location[];
    categoryHierarchy: Record<string, Set<string>>;
    currentCategory: string;
    currentLocation: string;
    view: 'all' | 'categories' | 'locations' | 'dashboard';
}

const FilterModal: React.FC<FilterModalProps> = ({
    isOpen, onClose, onApply, onClear, locations, categoryHierarchy, currentCategory, currentLocation, view
}) => {
    // State to track which categories are expanded
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Auto-expand the parent category if a sub-category is currently selected
    useEffect(() => {
        if (isOpen && currentCategory && currentCategory.includes('|')) {
            const parent = currentCategory.split('|')[0];
            setExpandedCategories(prev => new Set(prev).add(parent));
        }
    }, [isOpen, currentCategory]);
    
    if (!isOpen) return null;

    const handleCategoryClick = (val: string) => {
        onApply({ category: val, location: '' });
        onClose();
    };

    const handleLocationClick = (val: string) => {
        onApply({ category: '', location: val });
        onClose();
    };

    const handleClearAll = () => {
        onClear();
        onClose();
    };

    const toggleExpand = (cat: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the category when clicking expand
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
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
                    className={`w-full text-left px-4 py-3 rounded-lg text-sm font-bold transition-all border border-transparent ${currentCategory === '' ? 'bg-gray-100 text-gray-900 ring-2 ring-gray-200' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                    ALL CATEGORIES
                </button>
                
                {Object.keys(categoryHierarchy).sort().map(cat => {
                    const hasSubcats = categoryHierarchy[cat].size > 0;
                    const isExpanded = expandedCategories.has(cat);
                    const isSelected = currentCategory === cat;
                    const isChildSelected = currentCategory.startsWith(cat + '|');

                    return (
                        <div key={cat} className="rounded-lg bg-white border border-transparent hover:border-gray-200 transition-colors">
                            <div className={`flex items-center w-full rounded-lg transition-all ${isSelected ? 'bg-em-red text-white shadow-md' : 'text-gray-800 hover:bg-gray-50'}`}>
                                {/* Main Category Selection Button */}
                                <button 
                                    onClick={() => handleCategoryClick(cat)} 
                                    className="flex-grow text-left px-4 py-3 text-sm font-bold flex items-center justify-between"
                                >
                                    <span>{cat}</span>
                                    {isSelected && <CheckIcon className="w-4 h-4" />}
                                </button>

                                {/* Accordion Toggle Button (Only if subcategories exist) */}
                                {hasSubcats && (
                                    <button 
                                        onClick={(e) => toggleExpand(cat, e)}
                                        className={`p-3 border-l h-full flex items-center justify-center ${isSelected ? 'border-red-400 hover:bg-red-700 text-white' : 'border-gray-100 hover:bg-gray-200 text-gray-400'}`}
                                    >
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>
                            
                            {/* Sub Categories Accordion Body */}
                            {hasSubcats && isExpanded && (
                                <div className="pl-4 pr-2 pb-2 space-y-1 border-l-2 border-gray-100 ml-4 my-1 animate-fade-in-down">
                                    {Array.from(categoryHierarchy[cat]).sort().map(sub => {
                                        const val = `${cat}|${sub}`;
                                        const isActive = currentCategory === val;
                                        return (
                                            <button 
                                                key={val} 
                                                onClick={() => handleCategoryClick(val)} 
                                                className={`
                                                    w-full flex justify-between items-center px-4 py-2.5 rounded-md text-sm font-medium transition-all
                                                    ${isActive ? 'bg-red-50 text-em-red font-bold' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
                                                `}
                                            >
                                                <span>{sub}</span>
                                                {isActive && <div className="w-2 h-2 rounded-full bg-em-red"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
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
