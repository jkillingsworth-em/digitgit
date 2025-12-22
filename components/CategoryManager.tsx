import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface CategoryManagerProps {
    items: InventoryItem[];
    onUpdateCategory: (oldName: string, newName: string) => Promise<void>;
    onDeleteCategory: (categoryName: string) => Promise<void>;
    onBack: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ items, onUpdateCategory, onDeleteCategory, onBack }) => {
    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Derive unique categories and counts
    const categories = React.useMemo(() => {
        const counts: Record<string, number> = {};
        items.forEach(i => {
            const c = i.category || 'UNCATEGORIZED';
            counts[c] = (counts[c] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    }, [items]);

    const handleStartEdit = (cat: string) => {
        setEditingCat(cat);
        setEditValue(cat);
    };

    const handleSave = async () => {
        if (editingCat && editValue.trim() !== '' && editValue !== editingCat) {
            await onUpdateCategory(editingCat, editValue.trim());
        }
        setEditingCat(null);
    };

    const handleDelete = async (cat: string) => {
        if (window.confirm(`Are you sure you want to delete category "${cat}"? Items will be set to UNNAMED category.`)) {
            await onDeleteCategory(cat);
        }
    };

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Manage Categories</h2>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase">Back to Dashboard</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.map(([cat, count]) => (
                    <div key={cat} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center group hover:border-em-red transition-colors">
                        {editingCat === cat ? (
                            <div className="flex gap-2 w-full">
                                <input 
                                    className="form-control flex-grow" 
                                    value={editValue} 
                                    onChange={e => setEditValue(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleSave} className="bg-green-600 text-white p-2 rounded"><PlusIcon className="w-5 h-5"/></button>
                                <button onClick={() => setEditingCat(null)} className="bg-gray-400 text-white p-2 rounded"><XMarkIcon className="w-5 h-5"/></button>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <div className="text-lg font-black text-gray-900 uppercase">{cat}</div>
                                    <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">{count} ITEMS</div>
                                </div>
                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleStartEdit(cat)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><PencilSquareIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleDelete(cat)} className="p-2 text-red-600 hover:bg-red-50 rounded"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CategoryManager;
