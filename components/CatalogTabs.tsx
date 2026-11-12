import React from 'react';

interface CatalogTabsProps {
    section: 'categories' | 'locations';
    onOpenProducts: (mode: 'EDIT' | 'ADD') => void;
    onSelectSection: (section: 'categories' | 'locations') => void;
}

const tabClass = (active: boolean) =>
    `inline-flex items-center border-b-2 px-0.5 py-2.5 text-sm whitespace-nowrap transition-colors ${active ? 'border-em-red font-semibold text-em-ink' : 'border-transparent font-medium text-neutral-500 hover:text-em-ink'}`;

/** Page header for Inventory management's "Categories & locations" tab (admin only). */
const CatalogTabs: React.FC<CatalogTabsProps> = ({ section, onOpenProducts, onSelectSection }) => (
    <div className="mb-5 animate-fade-in-down">
        <div className="text-[13px] text-neutral-500">Admin</div>
        <h1 className="text-[26px] font-bold leading-8 tracking-tight text-em-ink">Inventory management</h1>
        <p className="text-neutral-500">Changes here affect every product in that category or location.</p>
        <nav className="mt-4 flex gap-6 overflow-x-auto border-b border-neutral-200" aria-label="Inventory management sections">
            <button type="button" onClick={() => onOpenProducts('EDIT')} className={tabClass(false)}>Edit products</button>
            <button type="button" onClick={() => onOpenProducts('ADD')} className={tabClass(false)}>Add new items</button>
            <span className={tabClass(true)} aria-current="page">Categories &amp; locations</span>
        </nav>
        <div className="mt-4 inline-flex rounded-md bg-neutral-100 p-1" role="tablist">
            {(['categories', 'locations'] as const).map(value => (
                <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={section === value}
                    onClick={() => onSelectSection(value)}
                    className={`rounded px-3.5 py-1.5 text-sm ${section === value ? 'bg-white font-semibold text-em-ink shadow-sm' : 'font-medium text-neutral-600'}`}
                >
                    {value === 'categories' ? 'Categories' : 'Locations'}
                </button>
            ))}
        </div>
    </div>
);

export default CatalogTabs;
