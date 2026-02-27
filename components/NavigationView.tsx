import React, { useMemo } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { TagIcon } from './icons/TagIcon';
import { InventoryItem, Location } from '../types';

type View =
    | 'all'
    | 'categories'
    | 'locations'
    | 'dashboard'
    | 'admin-hub'
    | 'admin-categories'
    | 'admin-locations'
    | 'admin-audit';

interface NavigationViewProps {
    currentView: View;
    onViewChange: (view: View) => void;
    onFilterChange: (type: 'category' | 'location', value: string) => void;
    onClearFilters: () => void;
    items: InventoryItem[];
    locations: Location[];
    // Mobile Drawer Props
    isMobileMenuOpen: boolean;
    onCloseMobileMenu: () => void;
}

const NavigationView: React.FC<NavigationViewProps> = ({ 
    currentView, onViewChange, onFilterChange, onClearFilters, items, locations,
    isMobileMenuOpen, onCloseMobileMenu
}) => {
    
    const categoryTree = useMemo(() => {
        const tree: Record<string, Set<string>> = {};
        items.forEach(item => {
            const cat = item.category || 'UNCATEGORIZED';
            if (!tree[cat]) tree[cat] = new Set();
            if (item.subCategory) tree[cat].add(item.subCategory);
        });
        return tree;
    }, [items]);

    const adminViewSet = new Set<View>(['admin-hub', 'admin-categories', 'admin-locations', 'admin-audit']);

    const handleFilterSelection = (type: 'category' | 'location', value: string) => {
        onFilterChange(type, value);
        onCloseMobileMenu();
    };

    const handleViewChange = (view: View) => {
        onClearFilters();
        onViewChange(view);
        onCloseMobileMenu();
    }

    const linkBase = "px-6 py-4 text-lg font-bold text-center transition-colors duration-200 cursor-pointer whitespace-nowrap uppercase flex items-center gap-2 h-full border-b-4 border-transparent hover:border-gray-200";
    const dropdownContainer = "absolute top-full left-0 bg-white shadow-sm border border-neutral-300 min-w-[240px] z-50 rounded-b-lg hidden group-hover:block animate-fade-in-down";
    const dropdownItem = "block w-full text-left px-5 py-3 text-base font-medium text-gray-700 hover:bg-em-red hover:text-white transition-colors border-b border-gray-50 last:border-0 relative";
    const subDropdownContainer = "absolute top-0 left-full bg-white shadow-sm border border-neutral-300 min-w-[200px] rounded-lg hidden group-hover/sub:block z-50";

    return (
        <>
            <div className="hidden md:block bg-white border-b border-gray-200">
                <div className="fluid-container">
                    <div className="bg-white rounded-lg z-30 relative">
                        <nav className="flex justify-start items-stretch" aria-label="Tabs">
                            <button
                                onClick={() => handleViewChange('dashboard')}
                                className={`${linkBase} ${currentView === 'dashboard' ? 'text-em-red border-em-red' : 'text-gray-600'}`}
                            >
                                <HomeIcon className="w-5 h-5" />
                                DASHBOARD
                            </button>

                            <button
                                onClick={() => handleViewChange('all')}
                                className={`${linkBase} ${currentView === 'all' ? 'text-em-red border-em-red' : 'text-gray-600'}`}
                            >
                                ALL INVENTORY
                            </button>

                            <div className="relative group border-l border-gray-100">
                                <button 
                                    onClick={() => onViewChange('categories')}
                                    className={`${linkBase} ${currentView === 'categories' ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    CATEGORIES
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>
                                
                                <div className={dropdownContainer}>
                                    <div className="py-0">
                                        {Object.keys(categoryTree).sort().map((cat) => (
                                            <div key={cat} className="relative group/sub">
                                                <button 
                                                    onClick={() => handleFilterSelection('category', cat)}
                                                    className={`${dropdownItem} flex justify-between items-center group/item`}
                                                >
                                                    {cat}
                                                    {categoryTree[cat].size > 0 && (
                                                        <ChevronDownIcon className="w-4 h-4 text-black transform -rotate-90 group-hover/item:text-white" />
                                                    )}
                                                </button>
                                                
                                                {categoryTree[cat].size > 0 && (
                                                    <div className={subDropdownContainer}>
                                                        {Array.from(categoryTree[cat]).sort().map(sub => (
                                                            <button
                                                                key={sub}
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); 
                                                                    handleFilterSelection('category', `${cat}|${sub}`);
                                                                }}
                                                                className={`${dropdownItem}`}
                                                            >
                                                                {sub}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="relative group border-l border-gray-100">
                                <button 
                                    onClick={() => onViewChange('locations')}
                                    className={`${linkBase} ${currentView === 'locations' ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    LOCATIONS
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>
                                
                                <div className={dropdownContainer}>
                                    {locations.map(loc => (
                                        <button
                                            key={loc.id}
                                            onClick={() => handleFilterSelection('location', loc.id)}
                                            className={dropdownItem}
                                        >
                                            {loc.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative group border-l border-gray-100">
                                <button
                                    onClick={() => handleViewChange('admin-hub')}
                                    className={`${linkBase} ${adminViewSet.has(currentView) ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    ADMIN
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>

                                <div className={dropdownContainer}>
                                    <button onClick={() => handleViewChange('admin-hub')} className={dropdownItem}>Admin Hub</button>
                                    <button onClick={() => handleViewChange('admin-categories')} className={dropdownItem}>Category Manager</button>
                                    <button onClick={() => handleViewChange('admin-locations')} className={dropdownItem}>Location Manager</button>
                                    <button onClick={() => handleViewChange('admin-audit')} className={dropdownItem}>Database Tools</button>
                                </div>
                            </div>
                        </nav>
                    </div>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onCloseMobileMenu}></div>
                    <div className="relative ml-auto flex h-full w-full max-w-sm flex-col overflow-y-auto bg-white shadow-2xl animate-fade-in-right">
                        <div className="p-4 space-y-4">
                            <div className="flex justify-end">
                                <button onClick={onCloseMobileMenu} className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200">
                                    <XMarkIcon className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                                <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.16em]">Views</h3>
                                <div className="space-y-2">
                                    <button onClick={() => handleViewChange('dashboard')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'dashboard' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><HomeIcon className="w-4 h-4" />Dashboard</button>
                                    <button onClick={() => handleViewChange('all')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'all' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><ListBulletIcon className="w-4 h-4" />All Inventory</button>
                                    <button onClick={() => handleViewChange('categories')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'categories' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><TagIcon className="w-4 h-4" />Categories</button>
                                    <button onClick={() => handleViewChange('locations')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'locations' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><MapPinIcon className="w-4 h-4" />Locations</button>
                                    <button onClick={() => handleViewChange('admin-hub')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${adminViewSet.has(currentView) ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><HomeIcon className="w-4 h-4" />Admin</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NavigationView;