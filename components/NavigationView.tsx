import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CheckIcon } from './icons/CheckIcon';
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
    | 'dashboard-sku'
    | 'dashboard-warehouse-load'
    | 'dashboard-critical-alerts'
    | 'admin-hub'
    | 'admin-categories'
    | 'admin-locations'
    | 'admin-audit'
    | 'exceptions'
    | 'cycle-count';

type DesktopMenu = 'categories' | 'locations' | 'admin' | null;
type MobileDrawerSection = 'categories' | 'locations';

interface NavigationViewProps {
    currentView: View;
    onViewChange: (view: View) => void;
    onCategoryNavigate: (value: string | null) => void;
    onLocationNavigate: (value: string | null) => void;
    onOpenBarcodeLabels: () => void;
    onClearFilters: () => void;
    items: InventoryItem[];
    categoryHierarchyDoc: Record<string, any>;
    locations: Location[];
    activeCategoryLink: string | null;
    activeLocationLink: string | null;
    // Mobile Drawer Props
    isMobileMenuOpen: boolean;
    onCloseMobileMenu: () => void;
}

const NavigationView: React.FC<NavigationViewProps> = ({ 
    currentView, onViewChange, onCategoryNavigate, onLocationNavigate, onOpenBarcodeLabels, onClearFilters, items, categoryHierarchyDoc, locations,
    activeCategoryLink, activeLocationLink,
    isMobileMenuOpen, onCloseMobileMenu
}) => {
    const [openDesktopMenu, setOpenDesktopMenu] = useState<DesktopMenu>(null);
    const [openCategorySubmenu, setOpenCategorySubmenu] = useState<string | null>(null);
    const [openMobileSections, setOpenMobileSections] = useState<Set<MobileDrawerSection>>(new Set());
    const [openMobileCategoryBranches, setOpenMobileCategoryBranches] = useState<Set<string>>(new Set());
    
    const categoryTree = useMemo(() => {
        const orderedMain: string[] = [];
        const mainSeen = new Set<string>();
        const treeMap = new Map<string, Set<string>>();
        const hierarchyEntries =
            categoryHierarchyDoc && typeof categoryHierarchyDoc === 'object'
                ? Object.entries(categoryHierarchyDoc).filter(([main]) => (main || '').trim().length > 0)
                : [];
        const hasHierarchyDoc = hierarchyEntries.length > 0;

        const ensureMainCategory = (raw: string) => {
            const cat = (raw || '').trim();
            if (!cat) return null;
            if (!mainSeen.has(cat)) {
                mainSeen.add(cat);
                orderedMain.push(cat);
            }
            if (!treeMap.has(cat)) treeMap.set(cat, new Set<string>());
            return cat;
        };

        const addSubValue = (cat: string, value?: string | null) => {
            const sub = (value || '').trim();
            if (!sub) return;
            treeMap.get(cat)?.add(sub);
        };

        const ingestHierarchyNode = (main: string, node: any) => {
            if (!node || typeof node !== 'object') return;
            Object.entries(node).forEach(([sub1, sub1Node]) => {
                addSubValue(main, sub1);
                if (!sub1Node || typeof sub1Node !== 'object') return;

                if (Array.isArray(sub1Node)) {
                    sub1Node.forEach((leaf: any) => addSubValue(main, typeof leaf === 'string' ? leaf : ''));
                    return;
                }

                Object.entries(sub1Node as Record<string, any>).forEach(([sub2, sub2Node]) => {
                    addSubValue(main, sub2);
                    if (Array.isArray(sub2Node)) {
                        sub2Node.forEach((leaf: any) => addSubValue(main, typeof leaf === 'string' ? leaf : ''));
                    }
                });
            });
        };

        if (hasHierarchyDoc) {
            hierarchyEntries.forEach(([main, node]) => {
                const normalized = ensureMainCategory(main);
                if (!normalized) return;
                ingestHierarchyNode(normalized, node);
            });
        }

        items.forEach(item => {
            const itemCategory = (item.category || '').trim();
            if (!itemCategory) return;
            if (hasHierarchyDoc && !mainSeen.has(itemCategory)) return;

            const cat = ensureMainCategory(itemCategory);
            if (!cat) return;
            addSubValue(cat, item.subCategory);
            addSubValue(cat, item.subCategory3);
            if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(v => addSubValue(cat, v));
            if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(v => addSubValue(cat, v));
        });

        const tree: Record<string, string[]> = {};
        orderedMain.forEach(cat => {
            tree[cat] = Array.from(treeMap.get(cat) || []);
        });

        return { orderedMain, tree };
    }, [items, categoryHierarchyDoc]);

    const dashboardViewSet = new Set<View>(['dashboard', 'dashboard-sku', 'dashboard-warehouse-load', 'dashboard-critical-alerts']);
    const adminViewSet = new Set<View>(['admin-hub', 'admin-categories', 'admin-locations', 'admin-audit', 'exceptions', 'cycle-count']);

    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const nextSections = new Set<MobileDrawerSection>();
        if (currentView === 'categories' || Boolean(activeCategoryLink)) nextSections.add('categories');
        if (currentView === 'locations' || Boolean(activeLocationLink)) nextSections.add('locations');
        setOpenMobileSections(nextSections);

        const nextBranches = new Set<string>();
        if (activeCategoryLink?.includes('|')) {
            nextBranches.add(activeCategoryLink.split('|')[0]);
        }
        setOpenMobileCategoryBranches(nextBranches);
    }, [isMobileMenuOpen, currentView, activeCategoryLink, activeLocationLink]);

    const closeDesktopMenus = () => {
        setOpenDesktopMenu(null);
        setOpenCategorySubmenu(null);
    };

    const toggleMobileSection = (section: MobileDrawerSection) => {
        setOpenMobileSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) next.delete(section);
            else next.add(section);
            return next;
        });
    };

    const toggleMobileCategoryBranch = (category: string) => {
        setOpenMobileCategoryBranches(prev => {
            const next = new Set(prev);
            if (next.has(category)) next.delete(category);
            else next.add(category);
            return next;
        });
    };

    const handleCategoryNavigation = (value: string | null) => {
        onCategoryNavigate(value);
        closeDesktopMenus();
        onCloseMobileMenu();
    };

    const handleLocationNavigation = (value: string | null) => {
        onLocationNavigate(value);
        closeDesktopMenus();
        onCloseMobileMenu();
    };

    const handleViewChange = (view: View) => {
        onClearFilters();
        onViewChange(view);
        closeDesktopMenus();
        onCloseMobileMenu();
    };

    const handleOpenBarcodeLabels = () => {
        onOpenBarcodeLabels();
        closeDesktopMenus();
        onCloseMobileMenu();
    };

    const linkBase = "px-6 py-4 text-lg font-bold text-center transition-colors duration-200 cursor-pointer whitespace-nowrap uppercase flex items-center gap-2 h-full border-b-4 border-transparent hover:border-gray-200";
    const dropdownContainer = "absolute top-full left-0 bg-white shadow-sm border border-neutral-300 min-w-[240px] z-50 rounded-b-lg animate-fade-in-down";
    const dropdownItem = "block w-full text-left px-5 py-3 text-base font-medium text-gray-700 hover:bg-em-red hover:text-white transition-colors border-b border-gray-50 last:border-0 relative";
    const subDropdownContainer = "absolute top-0 left-full bg-white shadow-sm border border-neutral-300 min-w-[200px] rounded-lg z-50 animate-fade-in-down";

    return (
        <>
            <div className="hidden md:block sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
                <div className="fluid-container">
                    <div className="bg-white rounded-lg z-30 relative">
                        <nav className="flex justify-start items-stretch" aria-label="Tabs">
                            <button
                                onClick={() => handleViewChange('dashboard')}
                                className={`${linkBase} ${dashboardViewSet.has(currentView) ? 'text-em-red border-em-red' : 'text-gray-600'}`}
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

                            <div
                                className="relative border-l border-gray-100"
                                onMouseEnter={() => setOpenDesktopMenu('categories')}
                                onMouseLeave={closeDesktopMenus}
                            >
                                <button 
                                    onClick={() => handleViewChange('categories')}
                                    className={`${linkBase} ${currentView === 'categories' ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    CATEGORIES
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>
                                
                                {openDesktopMenu === 'categories' && (
                                <div className={dropdownContainer}>
                                    <div className="py-0">
                                        {categoryTree.orderedMain.map((cat) => {
                                            const isCatSelected = activeCategoryLink === cat;
                                            const hasSelectedChild = Boolean(activeCategoryLink?.startsWith(`${cat}|`));
                                            const isCategoryActive = isCatSelected || hasSelectedChild;

                                            return (
                                            <div
                                                key={cat}
                                                className="relative"
                                                onMouseEnter={() => setOpenCategorySubmenu(cat)}
                                                onMouseLeave={() => setOpenCategorySubmenu(current => (current === cat ? null : current))}
                                            >
                                                <button 
                                                    onClick={() => handleCategoryNavigation(cat)}
                                                    className={`${dropdownItem} flex justify-between items-center ${isCategoryActive ? 'bg-red-50 text-em-red font-bold' : ''}`}
                                                >
                                                    <span>{cat}</span>
                                                    <div className="flex items-center gap-2">
                                                        {isCategoryActive && <CheckIcon className="w-4 h-4" />}
                                                        {categoryTree.tree[cat].length > 0 && (
                                                            <ChevronDownIcon className="w-4 h-4 transform -rotate-90" />
                                                        )}
                                                    </div>
                                                </button>
                                                
                                                {categoryTree.tree[cat].length > 0 && openCategorySubmenu === cat && (
                                                    <div className={subDropdownContainer}>
                                                        {categoryTree.tree[cat].map(sub => {
                                                            const value = `${cat}|${sub}`;
                                                            const isSelected = activeCategoryLink === value;

                                                            return (
                                                                <button
                                                                    key={sub}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation(); 
                                                                        handleCategoryNavigation(value);
                                                                    }}
                                                                    className={`${dropdownItem} flex items-center justify-between ${isSelected ? 'bg-red-50 text-em-red font-bold' : ''}`}
                                                                >
                                                                    <span>{sub}</span>
                                                                    {isSelected && <CheckIcon className="w-4 h-4" />}
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
                                )}
                            </div>

                            <div
                                className="relative border-l border-gray-100"
                                onMouseEnter={() => setOpenDesktopMenu('locations')}
                                onMouseLeave={closeDesktopMenus}
                            >
                                <button 
                                    onClick={() => handleViewChange('locations')}
                                    className={`${linkBase} ${currentView === 'locations' ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    LOCATIONS
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>
                                
                                {openDesktopMenu === 'locations' && (
                                <div className={dropdownContainer}>
                                    {locations.map(loc => (
                                        <button
                                            key={loc.id}
                                            onClick={() => handleLocationNavigation(loc.id)}
                                            className={`${dropdownItem} flex items-center justify-between ${activeLocationLink === loc.id ? 'bg-red-50 text-em-red font-bold' : ''}`}
                                        >
                                            <span>{loc.name}</span>
                                            {activeLocationLink === loc.id && <CheckIcon className="w-4 h-4" />}
                                        </button>
                                    ))}
                                </div>
                                )}
                            </div>

                            <div
                                className="relative border-l border-gray-100"
                                onMouseEnter={() => setOpenDesktopMenu('admin')}
                                onMouseLeave={closeDesktopMenus}
                            >
                                <button
                                    onClick={() => handleViewChange('admin-hub')}
                                    className={`${linkBase} ${adminViewSet.has(currentView) ? 'text-em-red border-em-red' : 'text-gray-600 group-hover:text-em-red'}`}
                                >
                                    ADMIN
                                    <ChevronDownIcon className="w-4 h-4 text-black transition-transform group-hover:rotate-180" />
                                </button>

                                {openDesktopMenu === 'admin' && (
                                <div className={dropdownContainer}>
                                    <button onClick={() => handleViewChange('admin-hub')} className={dropdownItem}>Admin Hub</button>
                                    <button onClick={handleOpenBarcodeLabels} className={dropdownItem}>Barcode Labels</button>
                                    <button onClick={() => handleViewChange('admin-categories')} className={dropdownItem}>Category Manager</button>
                                    <button onClick={() => handleViewChange('admin-locations')} className={dropdownItem}>Location Manager</button>
                                    <button onClick={() => handleViewChange('admin-audit')} className={dropdownItem}>Database Tools</button>
                                    <button onClick={() => handleViewChange('exceptions')} className={dropdownItem}>Exceptions</button>
                                    <button onClick={() => handleViewChange('cycle-count')} className={dropdownItem}>Cycle Count</button>
                                </div>
                                )}
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
                                    <button onClick={() => handleViewChange('dashboard')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${dashboardViewSet.has(currentView) ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><HomeIcon className="w-4 h-4" />Dashboard</button>
                                    <button onClick={() => handleViewChange('all')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'all' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><ListBulletIcon className="w-4 h-4" />All Inventory</button>
                                    <button onClick={() => handleViewChange('categories')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'categories' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><TagIcon className="w-4 h-4" />Categories</button>
                                    <button onClick={() => handleViewChange('locations')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${currentView === 'locations' ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><MapPinIcon className="w-4 h-4" />Locations</button>
                                    <button onClick={() => handleViewChange('admin-hub')} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase flex items-center gap-2 ${adminViewSet.has(currentView) ? 'bg-red-100 text-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}><HomeIcon className="w-4 h-4" />Admin</button>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => toggleMobileSection('categories')}
                                    className="w-full flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <TagIcon className="w-4 h-4 text-em-red" />
                                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.16em]">Category Tree</h3>
                                    </div>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${openMobileSections.has('categories') ? 'rotate-180' : ''}`} />
                                </button>

                                {openMobileSections.has('categories') && (
                                    <div className="space-y-2">
                                        {categoryTree.orderedMain.map(cat => {
                                            const isCatSelected = activeCategoryLink === cat;
                                            const hasSelectedChild = Boolean(activeCategoryLink?.startsWith(`${cat}|`));
                                            const isCategoryActive = isCatSelected || hasSelectedChild;
                                            const isBranchOpen = openMobileCategoryBranches.has(cat);
                                            const subValues = categoryTree.tree[cat];

                                            return (
                                                <div key={`mobile-category-${cat}`} className="space-y-1">
                                                    <div className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${isCategoryActive ? 'border-em-red bg-red-50' : 'border-gray-200 bg-white'}`}>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCategoryNavigation(cat)}
                                                            className={`flex-1 text-left text-sm font-black uppercase tracking-wide ${isCategoryActive ? 'text-em-red' : 'text-gray-800'}`}
                                                        >
                                                            {cat}
                                                        </button>
                                                        {isCategoryActive && <CheckIcon className="w-4 h-4 text-em-red" />}
                                                        {subValues.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleMobileCategoryBranch(cat)}
                                                                className={`rounded-lg p-1.5 transition-colors ${isCategoryActive ? 'text-em-red hover:bg-red-100' : 'text-gray-500 hover:bg-gray-100'}`}
                                                                aria-label={`${isBranchOpen ? 'Collapse' : 'Expand'} ${cat} categories`}
                                                            >
                                                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isBranchOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {subValues.length > 0 && isBranchOpen && (
                                                        <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-3">
                                                            {subValues.map(sub => {
                                                                const value = `${cat}|${sub}`;
                                                                const isSelected = activeCategoryLink === value;

                                                                return (
                                                                    <button
                                                                        key={`mobile-category-${value}`}
                                                                        type="button"
                                                                        onClick={() => handleCategoryNavigation(value)}
                                                                        className={`w-full rounded-lg px-3 py-2 text-left text-xs font-black uppercase tracking-wide flex items-center justify-between ${isSelected ? 'bg-red-50 text-em-red' : 'bg-white text-gray-600 border border-gray-200'}`}
                                                                    >
                                                                        <span>{sub}</span>
                                                                        {isSelected && <CheckIcon className="w-4 h-4" />}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => toggleMobileSection('locations')}
                                    className="w-full flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-2">
                                        <MapPinIcon className="w-4 h-4 text-em-red" />
                                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.16em]">Location Tree</h3>
                                    </div>
                                    <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${openMobileSections.has('locations') ? 'rotate-180' : ''}`} />
                                </button>

                                {openMobileSections.has('locations') && (
                                    <div className="space-y-2">
                                        {locations.map(loc => {
                                            const isSelected = activeLocationLink === loc.id;

                                            return (
                                                <button
                                                    key={`mobile-location-${loc.id}`}
                                                    type="button"
                                                    onClick={() => handleLocationNavigation(loc.id)}
                                                    className={`w-full rounded-xl px-3 py-2 text-left text-sm font-black uppercase tracking-wide flex items-center justify-between ${isSelected ? 'bg-red-50 text-em-red border border-em-red' : 'bg-white text-gray-800 border border-gray-200'}`}
                                                >
                                                    <span>{loc.name}</span>
                                                    {isSelected && <CheckIcon className="w-4 h-4" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NavigationView;