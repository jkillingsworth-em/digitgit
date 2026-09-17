import React from 'react';
import { Bars3Icon } from './icons/Bars3Icon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';
import { CameraIcon } from './icons/CameraIcon';

interface HeaderProps {
    onHomeClick: () => void;
    onSearchClick: () => void;
    onScanClick: () => void;
    onMenuClick: () => void;
    userEmail?: string | null;
    onSignOut?: () => void;
}

const Header: React.FC<HeaderProps> = ({ 
    onHomeClick,
    onSearchClick, 
    onScanClick, 
    onMenuClick,
    userEmail,
    onSignOut,
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
                        {userEmail && (
                            <div className="flex items-center gap-2 mr-1">
                                <span className="text-[11px] font-bold text-white/90 normal-case tracking-normal max-w-[220px] truncate" title={userEmail}>
                                    {userEmail}
                                </span>
                                {onSignOut && (
                                    <button
                                        type="button"
                                        onClick={onSignOut}
                                        className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white bg-red-900/60 hover:bg-red-900 rounded border border-red-800 transition duration-150"
                                    >
                                        Sign out
                                    </button>
                                )}
                            </div>
                        )}
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
                    <div className="min-w-0">
                        <button onClick={onHomeClick} className="text-left">
                            <h1 className="titlefont text-lg text-white font-black tracking-widest leading-none">
                                ELECTRO-MECH
                            </h1>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/80">Mobile Inventory Console</p>
                        </button>
                        {userEmail && (
                            <p className="mt-1 text-[9px] font-bold text-white/70 normal-case tracking-normal truncate max-w-[180px]">{userEmail}</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {onSignOut && (
                            <button
                                type="button"
                                onClick={onSignOut}
                                className="h-9 px-2.5 rounded-full bg-white/15 backdrop-blur-sm text-white text-[9px] font-black uppercase tracking-wider active:scale-95"
                            >
                                Out
                            </button>
                        )}
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
