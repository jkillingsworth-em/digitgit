import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon } from './icons/PlusIcon';
import { Bars3Icon } from './icons/Bars3Icon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { CameraIcon } from './icons/CameraIcon';

interface HeaderProps {
    onHomeClick: () => void;
    onAddItemClick: () => void;
    onMoveClick: () => void;
    onAuditClick: () => void;
    onPrintBatchClick: () => void;
    onImportClick: () => void;
    onQuickExportClick: () => void;
    onSmartExportClick: () => void;
    onSearchClick: () => void;
    onScanClick: () => void;
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onHomeClick,
    onAddItemClick, 
    onMoveClick,
    onAuditClick,
    onPrintBatchClick, 
    onImportClick,
    onQuickExportClick,
    onSmartExportClick,
    onSearchClick, 
    onScanClick, 
    onMenuClick,
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeSubMenu, setActiveSubMenu] = useState<'import' | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
                setActiveSubMenu(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMenuAction = (action: () => void) => {
        action();
        setIsMenuOpen(false);
        setActiveSubMenu(null);
    };

    const dropdownItemClass = "block w-full text-left px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-em-red hover:text-white transition-colors border-b border-gray-100";

    return (
        <header className="bg-em-red shadow-md z-40 relative border-b border-red-950">
            {/* Desktop Header (MD+) */}
            <div className="hidden md:block fluid-container">
                <div className="flex flex-row items-center justify-between h-20 gap-4">
                    <div className="flex-shrink-0">
                        <button onClick={onHomeClick} className="text-left">
                            <h1 className="titlefont text-3xl lg:text-4xl text-white text-left truncate tracking-tight">
                                <span className="font-black text-white">ELECTRO-MECH</span> <span className="font-light opacity-80">INVENTORY</span>
                            </h1>
                        </button>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                         <button onClick={onAddItemClick} className="flex items-center px-4 py-2 text-sm font-bold text-em-red bg-white hover:bg-gray-100 rounded shadow-sm whitespace-nowrap transition-colors">
                            <PlusIcon className="h-5 w-5 mr-1" />
                            <span>ADD ITEM</span>
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center px-3 py-2 text-sm font-bold text-white bg-red-800 hover:bg-red-700 rounded transition duration-150 border border-red-700">
                                <span>ADMIN OPTIONS</span>
                                <ChevronDownIcon className={`ml-2 h-4 w-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-64 bg-white rounded shadow-sm border border-neutral-300 z-50 animate-fade-in-down overflow-hidden">
                                    <button onClick={() => handleMenuAction(onMoveClick)} className={`${dropdownItemClass} uppercase`}>MOVE STOCK</button>
                                    <button onClick={() => handleMenuAction(onAuditClick)} className={`${dropdownItemClass} uppercase`}>AUDIT INVENTORY</button>
                                    <button onClick={() => handleMenuAction(onPrintBatchClick)} className={`${dropdownItemClass} uppercase`}>BARCODE LABELS</button>
                                    <div className="border-b border-gray-100">
                                        <button
                                            onClick={() => setActiveSubMenu(prev => prev === 'import' ? null : 'import')}
                                            className={`${dropdownItemClass} flex items-center justify-between uppercase border-b-0`}
                                        >
                                            <span>IMPORT / EXPORT</span>
                                            <ChevronDownIcon className={`w-4 h-4 text-neutral-500 transition-transform ${activeSubMenu === 'import' ? 'rotate-180' : ''}`} />
                                        </button>
                                        {activeSubMenu === 'import' && (
                                            <div className="bg-gray-50">
                                                <button onClick={() => handleMenuAction(onImportClick)} className="block w-full text-left px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-em-red hover:text-white transition-colors border-t border-gray-100">
                                                    Import Data (CSV)
                                                </button>
                                                <button onClick={() => handleMenuAction(onQuickExportClick)} className="block w-full text-left px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-em-red hover:text-white transition-colors border-t border-gray-100">
                                                    Quick Export
                                                </button>
                                                <button onClick={() => handleMenuAction(onSmartExportClick)} className="block w-full text-left px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-em-red hover:text-white transition-colors border-t border-gray-100">
                                                    Smart Export
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <button onClick={onSearchClick} className="p-2 text-sm font-medium text-white bg-red-800 hover:bg-red-700 rounded transition duration-150 border border-red-700" title="Search Inventory">
                           <MagnifyingGlassIcon className="h-5 w-5"/>
                        </button>
                         <button onClick={onScanClick} className="p-2 text-sm font-medium text-white bg-red-800 hover:bg-red-700 rounded transition duration-150 border border-red-700" title="Scan Barcode">
                           <CameraIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[80] px-4 py-3 bg-gradient-to-b from-em-red to-red-800 border-b border-red-900 shadow-sm">
                <div className="flex items-center justify-between">
                    <div>
                        <button onClick={onHomeClick} className="text-left">
                            <h1 className="titlefont text-lg text-white font-black tracking-widest leading-none">
                                ELECTRO-MECH
                            </h1>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">Mobile Inventory Console</p>
                        </button>
                    </div>

                    <div className="flex items-center">
                        <button onClick={onMenuClick} className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-sm text-white flex items-center justify-center active:scale-95">
                            <Bars3Icon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
