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
    // State to track which categories are expanded in the facet list
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Auto-expand parent if a sub-category is currently active
    useEffect(() => {
        if (isOpen && currentCategory && currentCategory.includes('|')) {
            const parent = currentCategory.split('|')[0];
            setExpandedCategories(prev => new Set(prev).add(parent));
        }
    }, [isOpen, currentCategory]);
    
    if (!isOpen) return null;

    const handleCategoryClick = (val: string) => {
        onApply({ category: val, location: currentLocation });
    };

    const handleLocationClick = (val: string) => {
        onApply({ category: currentCategory, location: val });
    };

    const toggleExpand = (cat: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    // --- Segment: Category Facet ---
    const CategoryFacet = (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Category</h3>
                {currentCategory && (
                    <button onClick={() => handleCategoryClick('')} className="text-[10px] font-bold text-em-red hover:underline">
                        CLEAR
                    </button>
                )}
            </div>
            
            <div className="space-y-1">
                {Object.keys(categoryHierarchy).sort().map(cat => {
                    const hasSubcats = categoryHierarchy[cat].size > 0;
                    const isExpanded = expandedCategories.has(cat);
                    const isSelected = currentCategory === cat;
                    const isChildSelected = currentCategory.startsWith(cat + '|');

                    return (
                        <div key={cat} className="group">
                            <div className={`flex items-center w-full rounded-xl transition-all border ${isSelected || isChildSelected ? 'border-em-red bg-red-50/30' : 'border-transparent hover:bg-slate-100'}`}>
                                <button 
                                    onClick={() => handleCategoryClick(cat)} 
                                    className={`flex-grow text-left px-4 py-3 text-sm flex items-center justify-between ${isSelected ? 'font-black text-em-red' : 'font-bold text-slate-700'}`}
                                >
                                    <span>{cat}</span>
                                    {isSelected && <CheckIcon className="w-4 h-4 text-em-red" />}
                                </button>

                                {hasSubcats && (
                                    <button 
                                        onClick={(e) => toggleExpand(cat, e)}
                                        className="p-3 border-l border-slate-200/50 hover:bg-slate-200/50 rounded-r-xl transition-colors"
                                    >
                                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                )}
                            </div>
                            
                            {/* Nested Sub-facets */}
                            {hasSubcats && isExpanded && (
                                <div className="pl-6 pr-2 py-1 space-y-1 animate-fade-in-down">
                                    {Array.from(categoryHierarchy[cat]).sort().map(sub => {
                                        const val = `${cat}|${sub}`;
                                        const isActive = currentCategory === val;
                                        return (
                                            <button 
                                                key={val} 
                                                onClick={() => handleCategoryClick(val)} 
                                                className={`w-full flex justify-between items-center px-4 py-2 rounded-lg text-xs transition-all ${isActive ? 'bg-white border border-em-red font-black text-em-red shadow-sm' : 'text-slate-500 font-bold hover:text-slate-800'}`}
                                            >
                                                <span>{sub}</span>
                                                {isActive && <CheckIcon className="w-3 h-3 text-em-red" />}
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

    // --- Segment: Location Facet ---
    const LocationFacet = (
        <div className="space-y-3">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Warehouse Location</h3>
                {currentLocation && (
                    <button onClick={() => handleLocationClick('')} className="text-[10px] font-bold text-em-red hover:underline">
                        CLEAR
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 gap-1.5">
                {locations.map(loc => {
                    const isSelected = currentLocation === loc.id;
                    return (
                        <button 
                            key={loc.id} 
                            onClick={() => handleLocationClick(loc.id)} 
                            className={`w-full flex justify-between items-center px-4 py-3 rounded-xl text-sm transition-all border ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-md font-black' : 'bg-white border-slate-200 text-slate-700 font-bold hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                            {loc.name}
                            {isSelected && <CheckIcon className="w-4 h-4 text-white" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-end md:items-stretch md:justify-end animate-fade-in" onClick={onClose}>
            <div 
                className="w-full bg-white shadow-2xl flex flex-col rounded-t-[2.5rem] md:rounded-none max-h-[90vh] md:h-full md:w-[400px] transform transition-transform duration-500 ease-out"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: 'facetSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}
            >
                {/* Header Tray */}
                <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Filters</h2>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Refine Inventory View</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-slate-100 text-slate-500 hover:bg-em-red hover:text-white rounded-full transition-all">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Facet Body */}
                <div className="flex-grow overflow-y-auto px-8 py-6 space-y-10">
                    {view === 'locations' ? (
                        <>
                            {LocationFacet}
                            <hr className="border-slate-100" />
                            {CategoryFacet}
                        </>
                    ) : (
                        <>
                            {CategoryFacet}
                            <hr className="border-slate-100" />
                            {LocationFacet}
                        </>
                    )}
                    <div className="h-10"></div> {/* Bottom Scroll Spacer */}
                </div>

                {/* Footer Action Bar */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 flex gap-3 shrink-0">
                    <button 
                        onClick={() => { onClear(); onClose(); }} 
                        className="flex-1 px-4 py-4 text-xs font-black text-slate-500 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 hover:text-slate-800 transition-all uppercase tracking-widest"
                    >
                        Reset All
                    </button>
                    <button 
                        onClick={onClose}
                        className="flex-[2] px-4 py-4 text-xs font-black text-white bg-em-red rounded-2xl shadow-lg shadow-red-900/20 hover:bg-red-700 transition-all active:scale-95 uppercase tracking-widest"
                    >
                        Apply & Done
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes facetSlideIn {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @media (min-width: 768px) {
                    @keyframes facetSlideIn {
                        from { transform: translateX(100%); }
                        to { transform: translateX(0); }
                    }
                }
            `}</style>
        </div>
    );
};

export default FilterModal;
