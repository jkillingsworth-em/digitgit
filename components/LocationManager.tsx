import React, { useState } from 'react';
import { Location } from '../types';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';

interface LocationManagerProps {
    locations: Location[];
    onAddLocation: (name: string, prompt: string) => Promise<void>;
    onUpdateLocation: (id: string, name: string, prompt: string) => Promise<void>;
    onDeleteLocation: (id: string) => Promise<void>;
    onAssignItems: (locationId: string) => void;
    onBack: () => void;
}

const LocationManager: React.FC<LocationManagerProps> = ({ locations, onAddLocation, onUpdateLocation, onDeleteLocation, onAssignItems, onBack }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Form State
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');

    const resetForm = () => {
        setName('');
        setPrompt('');
        setIsAdding(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        if (editingId) {
            await onUpdateLocation(editingId, name, prompt);
        } else {
            await onAddLocation(name, prompt);
        }
        resetForm();
    };

    const startEdit = (loc: Location) => {
        setEditingId(loc.id);
        setName(loc.name);
        setPrompt(loc.subLocationPrompt || '');
        setIsAdding(true);
    };

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Manage Locations</h2>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase">Back to Dashboard</button>
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="mb-6 bg-gray-50 p-6 rounded-xl border-2 border-dashed border-gray-300">
                    <h3 className="text-sm font-black text-gray-900 uppercase mb-4">{editingId ? 'Edit Location' : 'Add New Location'}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                        <button onClick={handleSave} className="px-6 py-2 text-sm font-bold text-white bg-em-red rounded hover:bg-red-700">SAVE LOCATION</button>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {!isAdding && (
                    <button onClick={() => setIsAdding(true)} className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-em-red hover:text-em-red transition-colors group">
                        <PlusIcon className="w-6 h-6 group-hover:scale-110 transition-transform"/>
                        <span className="font-black uppercase">Add New Location</span>
                    </button>
                )}

                {locations.map(loc => (
                    <div key={loc.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-gray-900 uppercase">{loc.name}</h3>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">
                                ID: {loc.id} {loc.subLocationPrompt && `• PROMPT: ${loc.subLocationPrompt}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => onAssignItems(loc.id)} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold text-xs uppercase hover:bg-blue-100 transition-colors">
                                <ArrowRightLeftIcon className="w-4 h-4"/> Assign Products
                            </button>
                            <button onClick={() => startEdit(loc)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><PencilSquareIcon className="w-5 h-5"/></button>
                            <button onClick={() => onDeleteLocation(loc.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><TrashIcon className="w-5 h-5"/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LocationManager;
