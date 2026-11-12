import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { HomeIcon } from './icons/HomeIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { TagIcon } from './icons/TagIcon';
import { ExclamationTriangleIcon } from './icons/ExclamationTriangleIcon';
import { PrinterIcon } from './icons/PrinterIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
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
    | 'cycle-count'
    | 'inventory-management';

type DesktopMenu = 'categories' | 'locations' | 'admin' | null;
type MobileDrawerSection = 'categories' | 'locations';

interface NavigationViewProps {
    currentView: View;
    isAdmin: boolean;
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
    // Admin shortcuts that open full-screen tools
    onOpenInventoryManagement?: () => void;
    onOpenImportExport?: () => void;
    onOpenEmDigitSync?: () => void;
}

/** "LED MODULES" -> "Led modules" for display; data keeps its original casing. */
const toTitle = (value: string) => {
    const lower = value.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const SideGroup: React.FC<{ label: string }> = ({ label }) => (
    <div className="px-2.5 pb-1.5 pt-5 text-xs font-semibold text-neutral-400">{label}</div>
);

interface SideItemProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick: () => void;
    expandable?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
}

const SideItem: React.FC<SideItemProps> = ({ icon, label, active, onClick, expandable, expanded, onToggle }) => (
    <div className={`group flex items-center rounded-md ${active ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#d12129]' : 'hover:bg-white/5 hover:text-white'}`}>
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left text-sm font-medium"
        >
            {icon}
            <span className="truncate">{label}</span>
        </button>
        {expandable && (
            <button
                type="button"
                onClick={onToggle}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
                aria-expanded={expanded}
                className="mr-1 rounded p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white"
            >
                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${expanded ? '' : '-rotate-90'}`} />
            </button>
        )}
    </div>
);

const NavigationView: React.FC<NavigationViewProps> = ({ 
    currentView, isAdmin, onViewChange, onCategoryNavigate, onLocationNavigate, onOpenBarcodeLabels, onClearFilters, items, categoryHierarchyDoc, locations,
    activeCategoryLink, activeLocationLink,
    isMobileMenuOpen, onCloseMobileMenu,
    onOpenInventoryManagement, onOpenImportExport, onOpenEmDigitSync,
}) => {
    const [expandedSide, setExpandedSide] = useState<'categories' | 'locations' | null>(null);
    // Open the matching list in the sidebar when the user lands on that view.
    useEffect(() => {
        if (currentView === 'categories') setExpandedSide('categories');
        else if (currentView === 'locations') setExpandedSide('locations');
    }, [currentView]);
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
    const adminViewSet = new Set<View>(['admin-hub', 'admin-categories', 'admin-locations', 'admin-audit']);

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

    const linkBase = "px-6 py-4 text-lg font-bold text-center transition-colors duration-200 cursor-pointer whitespace-nowrap  flex items-center gap-2 h-full border-b-4 border-transparent hover:border-neutral-200";
    const dropdownContainer = "absolute top-full left-0 bg-white shadow-sm border border-neutral-300 min-w-[240px] z-50 rounded-b-lg animate-fade-in-down";
    const dropdownItem = "block w-full text-left px-5 py-3 text-base font-medium text-neutral-700 hover:bg-em-red hover:text-white transition-colors border-b border-neutral-50 last:border-0 relative";
    const subDropdownContainer = "absolute top-0 left-full bg-white shadow-sm border border-neutral-300 min-w-[200px] rounded-lg z-50 animate-fade-in-down";

    const renderCategoryTree = () => (
        <div className="mb-1 ml-6 flex flex-col border-l border-white/10 pl-2">
            {categoryTree.orderedMain.map(cat => {
                const isActive = activeCategoryLink === cat || Boolean(activeCategoryLink?.startsWith(`${cat}|`));
                const subValues = categoryTree.tree[cat] || [];
                const isBranchOpen = openMobileCategoryBranches.has(cat);
                return (
                    <div key={cat}>
                        <div className={`flex items-center rounded-md ${isActive ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}>
                            <button type="button" onClick={() => handleCategoryNavigation(cat)} className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px] ${isActive ? 'font-semibold' : ''}`}>
                                {toTitle(cat)}
                            </button>
                            {subValues.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => toggleMobileCategoryBranch(cat)}
                                    aria-label={`${isBranchOpen ? 'Hide' : 'Show'} ${toTitle(cat)} sub-categories`}
                                    aria-expanded={isBranchOpen}
                                    className="rounded p-1 text-neutral-500 hover:text-white"
                                >
                                    <ChevronDownIcon className={`h-3 w-3 transition-transform ${isBranchOpen ? '' : '-rotate-90'}`} />
                                </button>
                            )}
                        </div>
                        {isBranchOpen && subValues.length > 0 && (
                            <div className="ml-2 flex flex-col border-l border-white/10 pl-2">
                                {subValues.map(sub => {
                                    const value = `${cat}|${sub}`;
                                    const isSelected = activeCategoryLink === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => handleCategoryNavigation(value)}
                                            className={`truncate rounded-md px-2 py-1 text-left text-xs ${isSelected ? 'bg-white/10 font-semibold text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                                        >
                                            {toTitle(sub)}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );

    const renderLocationList = () => (
        <div className="mb-1 ml-6 flex flex-col border-l border-white/10 pl-2">
            {locations.map(loc => (
                <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleLocationNavigation(loc.id)}
                    className={`truncate rounded-md px-2 py-1.5 text-left text-[13px] ${activeLocationLink === loc.id ? 'bg-white/10 font-semibold text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
                >
                    {loc.name}
                </button>
            ))}
        </div>
    );

    // One list of destinations, shared by the desktop sidebar and the phone menu.
    const renderNavItems = () => (
        <>
            <SideItem icon={<HomeIcon className="h-4 w-4" />} label="Home" active={dashboardViewSet.has(currentView)} onClick={() => handleViewChange('dashboard')} />
            <SideItem icon={<ListBulletIcon className="h-4 w-4" />} label="All inventory" active={currentView === 'all'} onClick={() => handleViewChange('all')} />
            <SideItem
                icon={<TagIcon className="h-4 w-4" />}
                label="Categories"
                active={currentView === 'categories' && !activeCategoryLink}
                onClick={() => handleViewChange('categories')}
                expandable
                expanded={expandedSide === 'categories'}
                onToggle={() => setExpandedSide(prev => (prev === 'categories' ? null : 'categories'))}
            />
            {expandedSide === 'categories' && renderCategoryTree()}
            <SideItem
                icon={<MapPinIcon className="h-4 w-4" />}
                label="Locations"
                active={currentView === 'locations' && !activeLocationLink}
                onClick={() => handleViewChange('locations')}
                expandable
                expanded={expandedSide === 'locations'}
                onToggle={() => setExpandedSide(prev => (prev === 'locations' ? null : 'locations'))}
            />
            {expandedSide === 'locations' && renderLocationList()}

            <SideGroup label="Operations" />
            <SideItem icon={<CheckIcon className="h-4 w-4" />} label="Cycle count" active={currentView === 'cycle-count'} onClick={() => handleViewChange('cycle-count')} />
            <SideItem icon={<ExclamationTriangleIcon className="h-4 w-4" />} label="Exceptions" active={currentView === 'exceptions'} onClick={() => handleViewChange('exceptions')} />
            <SideItem icon={<PrinterIcon className="h-4 w-4" />} label="Print labels" onClick={handleOpenBarcodeLabels} />
            {isAdmin && onOpenImportExport && (
                <SideItem icon={<ArrowDownTrayIcon className="h-4 w-4" />} label="Import / export" onClick={() => { onCloseMobileMenu(); onOpenImportExport(); }} />
            )}

            {isAdmin && (
                <>
                    <SideGroup label="Admin" />
                    <SideItem
                        icon={<PencilSquareIcon className="h-4 w-4" />}
                        label="Inventory management"
                        active={currentView === 'inventory-management' || currentView === 'admin-categories' || currentView === 'admin-locations'}
                        onClick={() => handleViewChange('inventory-management')}
                    />
                    {onOpenEmDigitSync && (
                        <SideItem icon={<ArrowRightLeftIcon className="h-4 w-4" />} label="EM Sheet sync" onClick={() => { onCloseMobileMenu(); onOpenEmDigitSync(); }} />
                    )}
                    <SideItem icon={<DocumentChartBarIcon className="h-4 w-4" />} label="Database tools" active={currentView === 'admin-audit'} onClick={() => handleViewChange('admin-audit')} />
                </>
            )}
        </>
    );

    return (
        <>
            <aside className="hidden md:block w-60 shrink-0 self-stretch bg-em-ink text-neutral-300" aria-label="Main navigation">
                <nav className="sticky top-0 flex max-h-screen flex-col gap-0.5 overflow-y-auto px-3 py-4">
                    {renderNavItems()}
                </nav>
            </aside>

            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[90] flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
                    <div className="fixed inset-0 bg-black/50" onClick={onCloseMobileMenu}></div>
                    <div className="relative flex h-full w-[300px] max-w-[85%] flex-col overflow-y-auto bg-em-ink px-3 pb-6 pt-4 text-neutral-300 shadow-2xl animate-fade-in-down">
                        <div className="mb-3 flex items-center gap-2.5 px-2.5">
                            <img src="/brand/electro-mech-mark.png" alt="" className="h-8 w-8" />
                            <img src="/brand/electro-mech-wordmark-white.png" alt="Electro-Mech" className="h-[13px] w-auto" />
                            <button onClick={onCloseMobileMenu} aria-label="Close menu" className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-neutral-400 hover:bg-white/10 hover:text-white">
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <nav className="flex flex-col gap-0.5">{renderNavItems()}</nav>
                    </div>
                </div>
            )}
        </>
    );
};

export default NavigationView;