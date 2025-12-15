
import React, { useState, useRef, useEffect } from 'react';
import { PlusIcon } from './icons/PlusIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { CameraIcon } from './icons/CameraIcon';
import { Bars3Icon } from './icons/Bars3Icon';

interface HeaderProps {
    onAddItemClick: () => void;
    onImportClick: () => void;
    onExportClick: () => void;
    onReportClick: () => void;
    onPrintBatchClick: () => void;
    onSearchClick: () => void;
    onScanClick: () => void;
    onMenuClick: () => void; 
}

const Header: React.FC<HeaderProps> = ({ 
    onAddItemClick, onImportClick, onExportClick, onReportClick, onPrintBatchClick, onSearchClick, onScanClick, onMenuClick
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleMenuAction = (action: () => void) => {
        action();
        setIsMenuOpen(false);
    };

    const dropdownItemClass = "block w-full text-left px-4 py-3 text-sm font-bold text-neutral-800 hover:bg-em-red hover:text-white transition-colors border-b border-gray-100 last:border-0";

    return (
        <header className="bg-em-red shadow-md z-40 relative border-b border-red-950">
            {/* Desktop Header (MD+) */}
            <div className="hidden md:block fluid-container">
                <div className="flex flex-row items-center justify-between h-20 gap-4">
                    <div className="flex-shrink-0">
                        <h1 className="titlefont text-3xl lg:text-4xl text-white text-left truncate tracking-tight">
                            <span className="font-black text-white">ELECTRO-MECH</span> <span className="font-light opacity-80">INVENTORY</span>
                        </h1>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                         <button onClick={onAddItemClick} className="flex items-center px-4 py-2 text-sm font-bold text-em-red bg-white hover:bg-gray-100 rounded shadow-sm whitespace-nowrap transition-colors">
                            <PlusIcon className="h-5 w-5 mr-1" />
                            <span>ADD ITEM</span>
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center px-3 py-2 text-sm font-bold text-white bg-red-800 hover:bg-red-700 rounded transition duration-150 border border-red-700">
                                <span>ACTIONS</span>
                                <ChevronDownIcon className="ml-2 h-4 w-4" />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded shadow-sm py-1 border border-neutral-300 z-50 animate-fade-in-down overflow-hidden">
                                    <button onClick={() => handleMenuAction(onImportClick)} className={dropdownItemClass}>IMPORT DATA (CSV)</button>
                                    <button onClick={() => handleMenuAction(onExportClick)} className={dropdownItemClass}>EXPORT LISTINGS</button>
                                    <button onClick={() => handleMenuAction(onReportClick)} className={dropdownItemClass}>GENERATE REPORT</button>
                                    <button onClick={() => handleMenuAction(onPrintBatchClick)} className={dropdownItemClass}>PRINT BARCODES</button>
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

            {/* Mobile Header (Slim, Dark Red) */}
            <div className="md:hidden h-14 flex items-center justify-between px-4 bg-em-red border-b border-red-950">
                {/* Left: Hamburger (Still useful for import/export on mobile) */}
                <button onClick={onMenuClick} className="text-white p-1 hover:bg-red-800 rounded">
                    <Bars3Icon className="h-6 w-6" />
                </button>

                {/* Center: Title */}
                <h1 className="titlefont text-lg text-white font-black tracking-widest">
                    ELECTRO-MECH
                </h1>

                {/* Right: Search Only (Scan is now in footer) */}
                <div className="flex items-center">
                    <button onClick={onSearchClick} className="text-white p-1 hover:bg-red-800 rounded">
                        <MagnifyingGlassIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;
