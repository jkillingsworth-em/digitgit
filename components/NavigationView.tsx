import React, { useMemo } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { HomeIcon } from './icons/HomeIcon';
import { InventoryItem, Location } from '../types';

type View = 'all' | 'categories' | 'locations' | 'dashboard' | 'admin-hub' | 'admin-categories' | 'admin-locations' | 'admin-purge';

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
    // Extra actions for sidebar
    onImportClick: () => void;
    onExportClick: () => void;
    onReportClick: () => void;
    onPrintBatchClick: () => void;
    // Admin actions
    onInventoryManagement: () => void;
    onSmartExport: () => void;
}

const NavigationView: React.FC<NavigationViewProps> = ({
    currentView, onViewChange, onFilterChange, onClearFilters, items, locations,
    isMobileMenuOpen, onCloseMobileMenu,
    onImportClick, onExportClick, onReportClick, onPrintBatchClick,
    onInventoryManagement, onSmartExport
}) => {
    const isAdminView = currentView.startsWith('admin');

    const categoryTree = useMemo(() => {
        const tree: Record<string, Set<string>> = {};
        items.forEach(item => {
            const cat = item.category || 'UNCATEGORIZED';
            if (!tree[cat]) tree[cat] = new Set();
            if (item.subCategory) tree[cat].add(item.subCategory);
        });
        return tree;
    }, [items]);

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
                                    className={`${linkBase} ${isAdminView ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    ADMIN
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>

                                <div className={dropdownContainer}>
                                    <button onClick={() => { onInventoryManagement(); onCloseMobileMenu(); }} className={dropdownItem}>
                                        INVENTORY MANAGEMENT
                                    </button>
                                    <button onClick={() => handleViewChange('admin-categories')} className={dropdownItem}>
                                        CATEGORY MANAGEMENT
                                    </button>
                                    <button onClick={() => handleViewChange('admin-locations')} className={dropdownItem}>
                                        LOCATION MANAGEMENT
                                    </button>
                                    <button onClick={() => handleViewChange('admin-purge')} className={dropdownItem}>
                                        DATABASE MANAGEMENT
                                    </button>
                                    <button onClick={() => { onImportClick(); onCloseMobileMenu(); }} className={dropdownItem}>
                                        IMPORT DATA
                                    </button>
                                    <button onClick={() => { onSmartExport(); onCloseMobileMenu(); }} className={dropdownItem}>
                                        SMART EXPORT
                                    </button>
                                    <button onClick={() => { onPrintBatchClick(); onCloseMobileMenu(); }} className={dropdownItem}>
                                        PRINT BARCODES
                                    </button>
                                </div>
                            </div>
                        </nav>
                    </div>
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-50 flex md:hidden">
                    <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onCloseMobileMenu}></div>
                    <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white h-full shadow-xl overflow-y-auto animate-fade-in-right">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-em-red text-white">
                            <h2 className="text-lg font-bold tracking-wider">MENU</h2>
                            <button onClick={onCloseMobileMenu} className="text-white hover:text-gray-300">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-6">
                            <div className="space-y-2">
                                <h3 className="text-xs font-normal text-gray-700 uppercase tracking-widest">Views</h3>
                                <button onClick={() => handleViewChange('all')} className={`block w-full text-left py-2 text-sm font-bold ${currentView === 'all' ? 'text-em-red' : 'text-gray-800'}`}>
                                    ALL INVENTORY
                                </button>
                                <button onClick={() => handleViewChange('categories')} className={`block w-full text-left py-2 text-sm font-bold ${currentView === 'categories' ? 'text-em-red' : 'text-gray-800'}`}>
                                    CATEGORIES
                                </button>
                                <button onClick={() => handleViewChange('locations')} className={`block w-full text-left py-2 text-sm font-bold ${currentView === 'locations' ? 'text-em-red' : 'text-gray-800'}`}>
                                    LOCATIONS
                                </button>
                                <button onClick={() => handleViewChange('admin-hub')} className={`block w-full text-left py-2 text-sm font-bold ${isAdminView ? 'text-em-red' : 'text-gray-800'}`}>
                                    ADMIN
                                </button>
                            </div>
                             <div className="space-y-2 pt-4 border-t border-gray-100">
                                <h3 className="text-xs font-normal text-gray-700 uppercase tracking-widest">Actions</h3>
                                <button onClick={() => { onImportClick(); onCloseMobileMenu(); }} className="block w-full text-left py-2 text-sm font-medium text-gray-700">Import Data</button>
                                <button onClick={() => { onExportClick(); onCloseMobileMenu(); }} className="block w-full text-left py-2 text-sm font-medium text-gray-700">Quick Export</button>
                                <button onClick={() => { onReportClick(); onCloseMobileMenu(); }} className="block w-full text-left py-2 text-sm font-medium text-gray-700">Generate Report</button>
                                <button onClick={() => { onPrintBatchClick(); onCloseMobileMenu(); }} className="block w-full text-left py-2 text-sm font-medium text-gray-700">Print Barcodes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NavigationView;
