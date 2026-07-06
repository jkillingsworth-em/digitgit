import React from 'react';
import { Bars3Icon } from './icons/Bars3Icon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { CameraIcon } from './icons/CameraIcon';

interface HeaderProps {
    onHomeClick: () => void;
    onSearchClick: () => void;
    onScanClick: () => void;
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onHomeClick,
    onSearchClick, 
    onScanClick, 
    onMenuClick,
}) => {
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
