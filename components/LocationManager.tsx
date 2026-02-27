import React, { useMemo, useState } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { CheckIcon } from './icons/CheckIcon';

interface LocationManagerProps {
    locations: Location[];
    items: InventoryItem[];
    stock: Stock[];
    onAddLocation: (payload: { id: string; name: string; prompt: string }) => Promise<void>;
    onUpdateLocation: (payload: { id: string; name: string; prompt: string }) => Promise<void>;
    onDeleteLocation: (id: string) => Promise<void>;
    onAddSubLocation: (locationId: string, subLocationName: string) => Promise<void>;
    onRemoveSubLocation: (locationId: string, subLocationName: string) => Promise<void>;
    onManageInventory: (locationId: string) => void;
    onPrintLocation: (locationId: string) => void;
    onBack: () => void;
}

const LocationManager: React.FC<LocationManagerProps> = ({
    locations,
    items,
    stock,
    onAddLocation,
    onUpdateLocation,
    onDeleteLocation,
    onAddSubLocation,
    onRemoveSubLocation,
    onManageInventory,
    onPrintLocation,
    onBack,
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [code, setCode] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [subLocationDrafts, setSubLocationDrafts] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'name' | 'qty-desc' | 'sku-desc'>('name');

    // Compute inventory summary metrics per location so admins can decide where to focus.
    const locationSummaries = useMemo(() => {
        const itemMap = new Map(items.map(item => [item.id, item]));
        return locations.map(location => {
            const stockEntries = stock.filter(entry => entry.locationId === location.id);
            const totalQty = stockEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            const uniqueSkus = new Set(stockEntries.map(entry => entry.itemId)).size;
            const categoryBreakdown: Record<string, number> = {};
            stockEntries.forEach(entry => {
                const category = itemMap.get(entry.itemId)?.category || 'UNCATEGORIZED';
                categoryBreakdown[category] = (categoryBreakdown[category] || 0) + entry.quantity;
            });
            const topCategories = Object.entries(categoryBreakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);

            return { location, totalQty, uniqueSkus, topCategories };
        });
    }, [items, locations, stock]);

    const visibleSummaries = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        let results = [...locationSummaries];

        if (normalizedQuery) {
            results = results.filter(({ location }) => {
                const haystack = [location.id, location.name, location.subLocationPrompt || '', ...(location.subLocations || [])]
                    .join(' ')
                    .toLowerCase();
                return haystack.includes(normalizedQuery);
            });
        }

        if (sortBy === 'qty-desc') {
            results.sort((a, b) => b.totalQty - a.totalQty || a.location.name.localeCompare(b.location.name));
        } else if (sortBy === 'sku-desc') {
            results.sort((a, b) => b.uniqueSkus - a.uniqueSkus || a.location.name.localeCompare(b.location.name));
        } else {
            results.sort((a, b) => a.location.name.localeCompare(b.location.name));
        }

        return results;
    }, [locationSummaries, searchQuery, sortBy]);

    const resetForm = () => {
        setName('');
        setPrompt('');
        setCode('');
        setIsAdding(false);
        setEditingId(null);
    };

    const startNewLocation = () => {
        resetForm();
        setIsAdding(true);
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            window.alert('Location name is required.');
            return;
        }

        setIsBusy(true);
        try {
            if (editingId) {
                await onUpdateLocation({ id: editingId, name: trimmedName, prompt: prompt.trim() });
            } else {
                await onAddLocation({ id: code.trim(), name: trimmedName, prompt: prompt.trim() });
            }
            resetForm();
        } catch (error: any) {
            window.alert(error?.message || 'Unable to save location.');
        } finally {
            setIsBusy(false);
        }
    };

    const startEdit = (loc: Location) => {
        setEditingId(loc.id);
        setName(loc.name);
        setPrompt(loc.subLocationPrompt || '');
        setCode(loc.id);
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Delete this location and detach all sub-locations?')) return;
        setIsBusy(true);
        try {
            await onDeleteLocation(id);
        } catch (error: any) {
            window.alert(error?.message || 'Unable to delete location.');
        } finally {
            setIsBusy(false);
        }
    };

    const toggleExpansion = (id: string) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSubLocationDraftChange = (id: string, value: string) => {
        setSubLocationDrafts(prev => ({ ...prev, [id]: value }));
    };

    const handleAddSubLocationClick = async (id: string) => {
        const draft = (subLocationDrafts[id] || '').trim();
        if (!draft) {
            window.alert('Sub-Location label cannot be empty.');
            return;
        }

        setIsBusy(true);
        try {
            await onAddSubLocation(id, draft);
            handleSubLocationDraftChange(id, '');
        } catch (error: any) {
            window.alert(error?.message || 'Unable to add Sub-Location.');
        } finally {
            setIsBusy(false);
        }
    };

    const handleRemoveSubLocationClick = async (id: string, subLocation: string) => {
        if (!window.confirm(`Remove ${subLocation} from this location?`)) return;
        setIsBusy(true);
        try {
            await onRemoveSubLocation(id, subLocation);
        } catch (error: any) {
            window.alert(error?.message || 'Unable to remove Sub-Location.');
        } finally {
            setIsBusy(false);
        }
    };

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Manage Locations</h2>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase">Back to Dashboard</button>
            </div>

            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <input
                    className="form-control md:col-span-2"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by ID, name, prompt, or Sub-Location"
                />
                <select className="form-control" value={sortBy} onChange={e => setSortBy(e.target.value as 'name' | 'qty-desc' | 'sku-desc')}>
                    <option value="name">Sort: Name (A–Z)</option>
                    <option value="qty-desc">Sort: Highest Quantity</option>
                    <option value="sku-desc">Sort: Most Unique SKUs</option>
                </select>
            </div>

            {visibleSummaries.length > 0 && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">
                        {visibleSummaries.length} location{visibleSummaries.length === 1 ? '' : 's'} visible
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setExpanded(new Set(visibleSummaries.map(({ location }) => location.id)))}
                            className="rounded bg-gray-100 px-3 py-2 text-[11px] font-bold uppercase text-gray-700 hover:bg-gray-200"
                        >
                            Expand All
                        </button>
                        <button
                            onClick={() => setExpanded(new Set())}
                            className="rounded bg-gray-100 px-3 py-2 text-[11px] font-bold uppercase text-gray-700 hover:bg-gray-200"
                        >
                            Collapse All
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="mb-6 bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                    <h3 className="text-sm font-black text-gray-900 uppercase mb-4">{editingId ? 'Edit Location' : 'Add New Location'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Location ID (Optional)</label>
                            <input className="form-control" value={code} onChange={e => setCode(e.target.value)} placeholder="auto-generate if blank" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Location Name</label>
                            <input className="form-control" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. WAREHOUSE A" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase">Sub-Location Prompt (Optional)</label>
                            <input className="form-control" value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="e.g. SHELF, BIN, RACK" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={resetForm} className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded">CANCEL</button>
                        <button onClick={handleSave} disabled={isBusy} className="px-6 py-2 text-sm font-bold text-white bg-em-red rounded hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">
                            {editingId ? 'UPDATE LOCATION' : 'SAVE LOCATION'}
                        </button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {!isAdding && (
                    <button onClick={startNewLocation} className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-em-red hover:text-em-red transition-colors group">
                        <PlusIcon className="w-6 h-6 group-hover:scale-110 transition-transform"/>
                        <span className="font-black uppercase">Add New Location</span>
                    </button>
                )}

                {visibleSummaries.map(({ location, totalQty, uniqueSkus, topCategories }) => {
                    const isExpanded = expanded.has(location.id);
                    const draftValue = subLocationDrafts[location.id] || '';
                    return (
                        <div key={location.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                            <button onClick={() => toggleExpansion(location.id)} className="w-full flex items-start justify-between text-left">
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-xl font-black text-gray-900 uppercase">{location.name}</h3>
                                        <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 rounded">ID: {location.id}</span>
                                        {location.subLocationPrompt && (
                                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 rounded">Prompt: {location.subLocationPrompt}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-xs font-bold uppercase text-gray-500 tracking-widest">
                                        <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                            <DocumentChartBarIcon className="w-4 h-4"/> {totalQty} Units
                                        </span>
                                        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">
                                            <CheckIcon className="w-4 h-4"/> {uniqueSkus} Unique SKUs
                                        </span>
                                        {topCategories.map(([category, quantity]) => (
                                            <span key={category} className="px-2 py-1 rounded bg-gray-100 text-gray-600">
                                                {category}: {quantity}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">{isExpanded ? 'Hide Details' : 'Show Details'}</span>
                            </button>

                            {isExpanded && (
                                <div className="mt-6 space-y-6">
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => onManageInventory(location.id)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold text-xs uppercase hover:bg-blue-100 transition-colors">
                                            Manage Inventory
                                        </button>
                                        <button onClick={() => onPrintLocation(location.id)} className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-bold text-xs uppercase hover:bg-black transition-colors">
                                            <BarcodeIcon className="w-4 h-4"/> Print Labels
                                        </button>
                                        <button onClick={() => startEdit(location)} className="flex items-center gap-2 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg font-bold text-xs uppercase hover:bg-yellow-100 transition-colors">
                                            <PencilSquareIcon className="w-4 h-4"/> Edit
                                        </button>
                                        <button onClick={() => handleDelete(location.id)} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-bold text-xs uppercase hover:bg-red-100 transition-colors">
                                            <TrashIcon className="w-4 h-4"/> Delete
                                        </button>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Sub-Locations</h4>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {(location.subLocations || []).length === 0 && (
                                                <span className="px-3 py-2 bg-gray-100 text-gray-500 text-xs font-bold uppercase rounded">No sub-locations</span>
                                            )}
                                            {(location.subLocations || []).map(sub => (
                                                <span key={sub} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-full text-xs font-bold uppercase text-gray-600">
                                                    {sub}
                                                    <button onClick={() => handleRemoveSubLocationClick(location.id, sub)} className="text-gray-400 hover:text-red-600">
                                                        <XMarkIcon className="w-4 h-4"/>
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input value={draftValue} onChange={e => handleSubLocationDraftChange(location.id, e.target.value)} className="form-control flex-1" placeholder={location.subLocationPrompt ? `Add ${location.subLocationPrompt}` : 'Add Sub-Location'} />
                                            <button onClick={() => handleAddSubLocationClick(location.id)} disabled={isBusy} className="px-4 py-2 text-sm font-bold text-white bg-em-red rounded hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">
                                                ADD
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {visibleSummaries.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
                        <div className="text-sm font-black uppercase tracking-widest text-gray-500">No locations found</div>
                        <p className="mt-2 text-sm font-medium text-gray-600">Try a different search term or clear filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationManager;
