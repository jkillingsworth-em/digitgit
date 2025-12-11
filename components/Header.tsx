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
    onMenuClick: () => void; // Trigger for mobile sidebar
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

    return (
        <header className="bg-em-dark-blue shadow-md z-40 relative">
            {/* Desktop Header (MD+) - Keeping original layout logic for desktop but refined */}
            <div className="hidden md:block fluid-container">
                <div className="flex flex-row items-center justify-between h-20 gap-4">
                    <div className="flex-shrink-0">
                        <h1 className="titlefont text-3xl lg:text-4xl xl:text-5xl text-left truncate">
                            <span className="text-em-red">ELECTRO-MECH</span> INVENTORY
                        </h1>
                    </div>
                    <div className="flex items-center justify-center space-x-3">
                         <button onClick={onAddItemClick} className="flex items-center px-3 py-2 text-sm font-medium text-white bg-em-red hover:bg-red-700 rounded-md transition duration-150 shadow-sm whitespace-nowrap">
                            <PlusIcon className="h-5 w-5 mr-1" />
                            <span>ADD ITEM</span>
                        </button>
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center px-3 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition duration-150 border border-gray-600">
                                <span>ACTIONS</span>
                                <ChevronDownIcon className="ml-2 h-4 w-4" />
                            </button>
                            {isMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-gray-200 z-50 animate-fade-in-down">
                                    <button onClick={() => handleMenuAction(onImportClick)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">IMPORT DATA (CSV)</button>
                                    <button onClick={() => handleMenuAction(onExportClick)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">EXPORT LISTINGS</button>
                                    <button onClick={() => handleMenuAction(onReportClick)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">GENERATE REPORT</button>
                                    <button onClick={() => handleMenuAction(onPrintBatchClick)} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">PRINT BARCODES</button>
                                </div>
                            )}
                        </div>
                        <button onClick={onSearchClick} className="p-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition duration-150 border border-gray-600" title="Search Inventory">
                           <MagnifyingGlassIcon className="h-5 w-5"/>
                        </button>
                         <button onClick={onScanClick} className="p-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 rounded-md transition duration-150 border border-gray-600" title="Scan Barcode">
                           <CameraIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Header (Slim, Dark Blue) */}
            <div className="md:hidden h-14 flex items-center justify-between px-4">
                {/* Left: Hamburger */}
                <button onClick={onMenuClick} className="text-white p-1">
                    <Bars3Icon className="h-6 w-6" />
                </button>

                {/* Center: Title */}
                <h1 className="titlefont text-xl text-white tracking-widest">
                    INVENTORY
                </h1>

                {/* Right: Search & Scan */}
                <div className="flex items-center space-x-4">
                    <button onClick={onSearchClick} className="text-white">
                        <MagnifyingGlassIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onScanClick} className="text-white">
                        <CameraIcon className="h-6 w-6" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Header;