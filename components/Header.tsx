import React, { useEffect, useRef, useState } from 'react';
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
    isAdmin?: boolean;
    /** The home page has its own large search, so the top-bar one is hidden there. */
    showSearch?: boolean;
    /** Preview builds only: undefined hides the switch. */
    viewAsStaff?: boolean;
    onToggleViewAsStaff?: () => void;
}

const initialsFor = (email?: string | null) => {
    if (!email) return '?';
    const name = email.split('@')[0];
    const parts = name.split(/[._-]+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
    return letters.toUpperCase();
};

const Header: React.FC<HeaderProps> = ({
    onHomeClick,
    onSearchClick,
    onScanClick,
    onMenuClick,
    userEmail,
    onSignOut,
    isAdmin,
    showSearch = true,
    viewAsStaff,
    onToggleViewAsStaff,
}) => {
    const [isUserMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isUserMenuOpen) return;
        const close = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
        };
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setUserMenuOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
        };
    }, [isUserMenuOpen]);

    return (
        <header className="relative z-40 bg-white border-b border-neutral-200">
            {/* Desktop top bar (MD+) */}
            <div className="hidden md:flex h-16 items-center gap-6 px-6">
                <button type="button" onClick={onHomeClick} className="flex items-center gap-3 shrink-0" aria-label="Electro-Mech Inventory home">
                    <img src="/brand/electro-mech-mark.png" alt="" width={36} height={36} className="h-9 w-9" />
                    <img src="/brand/electro-mech-wordmark.png" alt="Electro-Mech" className="h-[15px] w-auto" />
                    <span className="h-6 w-px bg-neutral-300" aria-hidden="true" />
                    <span className="text-[15px] font-semibold text-neutral-600">Inventory</span>
                </button>

                <span className="ml-auto" />
                {showSearch && <button
                    type="button"
                    onClick={onSearchClick}
                    className="flex h-10 w-full max-w-sm items-center gap-2 rounded-md border border-neutral-300 bg-em-page px-3 text-sm text-neutral-500 hover:border-neutral-400"
                    title="Search inventory"
                >
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    <span>Search parts, descriptions or locations…</span>
                </button>}
                <button
                    type="button"
                    onClick={onScanClick}
                    className="flex h-10 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-em-ink hover:bg-neutral-50"
                    title="Scan barcode"
                >
                    <CameraIcon className="h-4 w-4" />
                    Scan
                </button>

                {userEmail && (
                    <div className="relative" ref={userMenuRef}>
                        <button
                            type="button"
                            onClick={() => setUserMenuOpen(open => !open)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-[13px] font-semibold text-em-ink hover:bg-neutral-200"
                            aria-haspopup="menu"
                            aria-expanded={isUserMenuOpen}
                            title={userEmail}
                        >
                            {initialsFor(userEmail)}
                        </button>
                        {isUserMenuOpen && (
                            <div role="menu" className="absolute right-0 top-11 w-64 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg animate-fade-in-down">
                                <div className="px-3 py-2">
                                    <div className="truncate text-sm font-semibold text-em-ink">{userEmail}</div>
                                    <div className="text-xs text-neutral-500">{isAdmin ? 'Administrator' : 'Staff'}</div>
                                </div>
                                {viewAsStaff !== undefined && onToggleViewAsStaff && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setUserMenuOpen(false); onToggleViewAsStaff(); }}
                                        className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                    >
                                        {viewAsStaff ? 'Back to admin view' : 'View as staff (preview)'}
                                    </button>
                                )}
                                {onSignOut && (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setUserMenuOpen(false); onSignOut(); }}
                                        className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-100"
                                    >
                                        Sign out
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile top bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 z-[80] flex h-16 items-center gap-3 border-b border-neutral-200 bg-white px-4">
                <button aria-label="Open navigation menu" onClick={onMenuClick} className="flex h-10 w-10 items-center justify-center rounded-md text-em-ink active:bg-neutral-100">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <button onClick={onHomeClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <img src="/brand/electro-mech-mark.png" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
                    <span className="truncate text-[15px] font-bold text-em-ink">Electro-Mech Inventory</span>
                </button>
                {viewAsStaff !== undefined && onToggleViewAsStaff && (
                    <button
                        type="button"
                        onClick={onToggleViewAsStaff}
                        className="h-9 rounded-md px-2.5 text-xs font-semibold text-neutral-600 active:bg-neutral-100"
                    >
                        {viewAsStaff ? 'Admin view' : 'Staff view'}
                    </button>
                )}
                {onSignOut && (
                    <button
                        type="button"
                        onClick={onSignOut}
                        className="h-9 rounded-md px-2.5 text-xs font-semibold text-neutral-600 active:bg-neutral-100"
                        title={userEmail ?? undefined}
                    >
                        Sign out
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;
