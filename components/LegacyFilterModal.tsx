import React, { useEffect, useState } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { Location } from '../types';
import { CheckIcon } from './icons/CheckIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { TagIcon } from './icons/TagIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';

interface LegacyFilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (filters: { categories: Set<string>; locations: Set<string> }) => void;
    onClear: () => void;
    locations: Location[];
    categoryHierarchy: Record<string, string[]>;
    currentCategories: Set<string>;
    currentLocations: Set<string>;
}

const LegacyFilterModal: React.FC<LegacyFilterModalProps> = ({
    isOpen,
    onClose,
    onApply,
    onClear,
    locations,
    categoryHierarchy,
    currentCategories,
    currentLocations,
}) => {
    const [animate, setAnimate] = useState(false);
    const [localLocations, setLocalLocations] = useState<Set<string>>(new Set());
    const [localCategories, setLocalCategories] = useState<Set<string>>(new Set());
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setAnimate(true));
            setLocalLocations(new Set(currentLocations));
            setLocalCategories(new Set(currentCategories));
            const initialExpanded = new Set<string>();
            currentCategories.forEach(cat => {
                if (cat.includes('|')) initialExpanded.add(cat.split('|')[0]);
            });
            setExpandedCategories(initialExpanded);
        } else {
            setAnimate(false);
        }
    }, [isOpen, currentCategories, currentLocations]);

    if (!isOpen) return null;

    const toggleLocation = (locId: string) => {
        const next = new Set(localLocations);
        if (next.has(locId)) next.delete(locId);
        else next.add(locId);
        setLocalLocations(next);
    };

    const toggleCategory = (cat: string) => {
        const next = new Set(localCategories);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        setLocalCategories(next);
    };

    const toggleExpanded = (cat: string) => {
        const next = new Set(expandedCategories);
        if (next.has(cat)) next.delete(cat);
        else next.add(cat);
        setExpandedCategories(next);
    };

    const handleApply = () => {
        onApply({ categories: localCategories, locations: localLocations });
        onClose();
    };

    const handleClearAll = () => {
        setLocalLocations(new Set());
        setLocalCategories(new Set());
        onClear();
    };

    const renderSelected = () => {
        if (localLocations.size === 0 && localCategories.size === 0) return null;
        return (
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Selected</h3>
                    <button onClick={handleClearAll} className="text-[10px] font-bold text-red-600 hover:text-red-800 uppercase flex items-center gap-1">
                        <TrashIcon className="w-3 h-3" /> Clear All
                    </button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Array.from(localLocations).map(locId => (
                        <span key={locId} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
                            <MapPinIcon className="w-3 h-3" />
                            {locations.find(l => l.id === locId)?.name || locId}
                            <button onClick={() => toggleLocation(locId)} className="ml-1 hover:text-red-600">
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    {Array.from(localCategories).map(cat => (
                        <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200">
                            <TagIcon className="w-3 h-3" />
                            {cat.includes('|') ? cat.split('|')[1] : cat}
                            <button onClick={() => toggleCategory(cat)} className="ml-1 hover:text-red-600">
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
            <div className={`absolute inset-0 bg-gray-900 bg-opacity-50 transition-opacity duration-300 ease-in-out backdrop-blur-sm ${animate ? 'opacity-100' : 'opacity-0'}`} onClick={onClose}></div>
            <div className={`pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-0 md:pl-10 ${animate ? 'translate-x-0' : 'translate-x-full'} transition-transform duration-300 ease-in-out`}>
                <div className="pointer-events-auto w-screen max-w-md">
                    <div className="flex h-full flex-col bg-white shadow-2xl">
                        <div className="flex h-20 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6">
                            <div>
                                <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Filter Inventory</h2>
                                <p className="text-xs font-medium text-gray-500 mt-1">Select multiple items below</p>
                            </div>
                            <button type="button" className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none" onClick={onClose}>
                                <div className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <XMarkIcon className="h-6 w-6" />
                                </div>
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-gray-50/50">
                            <div className="px-6 py-6 space-y-8">
                                {renderSelected()}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                        <MapPinIcon className="w-5 h-5 text-gray-400" />
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Locations</h3>
                                    </div>
                                    <div className="space-y-1">
                                        {locations.map(loc => {
                                            const isSelected = localLocations.has(loc.id);
                                            return (
                                                <button
                                                    key={loc.id}
                                                    onClick={() => toggleLocation(loc.id)}
                                                    className={`w-full group flex items-center justify-between px-3 py-3 rounded-lg text-sm transition-all border ${isSelected ? 'bg-em-red text-white border-em-red shadow-md font-bold' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-white border-white' : 'bg-gray-100 border-gray-300'}`}>
                                                            {isSelected && <CheckIcon className="w-3.5 h-3.5 text-em-red" />}
                                                        </div>
                                                        <span className="uppercase tracking-wide">{loc.name}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
                                        <TagIcon className="w-5 h-5 text-gray-400" />
                                        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">Categories</h3>
                                    </div>
                                    <div className="space-y-1">
                                        {Object.keys(categoryHierarchy).sort().map(cat => {
                                            const subCategories = categoryHierarchy[cat] || [];
                                            const isCatSelected = localCategories.has(cat);
                                            const isExpanded = expandedCategories.has(cat);
                                            return (
                                                <div key={cat} className="space-y-1">
                                                    <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all border ${isCatSelected ? 'bg-em-red text-white border-em-red shadow-md' : 'bg-white text-gray-700 border-gray-200'}`}>
                                                        <button className="flex items-center gap-3 flex-grow text-left" onClick={() => toggleCategory(cat)}>
                                                            <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isCatSelected ? 'bg-white border-white' : 'bg-gray-100 border-gray-300'}`}>
                                                                {isCatSelected && <CheckIcon className="w-3.5 h-3.5 text-em-red" />}
                                                            </div>
                                                            <span className="uppercase font-bold tracking-wide">{cat}</span>
                                                        </button>
                                                        {subCategories.length > 0 && (
                                                            <button onClick={e => { e.stopPropagation(); toggleExpanded(cat); }} className={`p-1.5 rounded-md transition-colors ${isCatSelected ? 'hover:bg-red-700 text-white' : 'hover:bg-gray-100 text-gray-400'}`}>
                                                                {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {subCategories.length > 0 && isExpanded && (
                                                        <div className="ml-4 pl-4 border-l-2 border-gray-200 space-y-1 py-1 animate-fade-in-down">
                                                            {subCategories.sort().map(sub => {
                                                                const value = `${cat}|${sub}`;
                                                                const isSelected = localCategories.has(value);
                                                                return (
                                                                    <button
                                                                        key={value}
                                                                        onClick={() => toggleCategory(value)}
                                                                        className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium uppercase transition-colors flex items-center gap-3 ${isSelected ? 'bg-red-50 text-em-red font-bold' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
                                                                    >
                                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-em-red border-em-red' : 'bg-white border-gray-300'}`}>
                                                                            {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                                                                        </div>
                                                                        <span>{sub}</span>
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
                            </div>
                        </div>
                        <div className="flex shrink-0 justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
                            <button type="button" className="rounded-lg bg-white border border-gray-300 px-5 py-2.5 text-xs font-black text-gray-700 shadow-sm hover:bg-gray-50 uppercase tracking-wide" onClick={handleClearAll}>
                                Reset All
                            </button>
                            <button type="button" className="rounded-lg bg-em-red px-8 py-2.5 text-xs font-black text-white shadow-sm hover:bg-red-700 uppercase tracking-wide" onClick={handleApply}>
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegacyFilterModal;
