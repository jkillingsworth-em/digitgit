import React from 'react';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { CameraIcon } from './icons/CameraIcon';
import { Bars3Icon } from './icons/Bars3Icon';

interface HeaderProps {
    onSearchClick: () => void;
    onScanClick: () => void;
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onSearchClick, onScanClick, onMenuClick }) => {
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
                <button onClick={onMenuClick} className="text-white p-1 hover:bg-red-800 rounded">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <h1 className="titlefont text-lg text-white font-black tracking-widest">
                    ELECTRO-MECH
                </h1>
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
