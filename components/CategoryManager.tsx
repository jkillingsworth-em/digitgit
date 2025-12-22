import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChevronUpIcon } from './icons/ChevronUpIcon';

interface CategoryManagerProps {
    items: InventoryItem[];
    onUpdateCategory: (oldName: string, newName: string) => Promise<void>;
    onDeleteCategory: (categoryName: string) => Promise<void>;
    onUpdateSubCategory: (category: string, oldSub: string, newSub: string) => Promise<void>;
    onDeleteSubCategory: (category: string, sub: string) => Promise<void>;
    onBack: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
    items, 
    onUpdateCategory, 
    onDeleteCategory, 
    onUpdateSubCategory,
    onDeleteSubCategory,
    onBack 
}) => {
    // State for Category Edit
    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [catEditValue, setCatEditValue] = useState('');

    // State for SubCategory Edit
    const [editingSub, setEditingSub] = useState<{ cat: string, sub: string } | null>(null);
    const [subEditValue, setSubEditValue] = useState('');

    // State for Expansion
    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    // Build Hierarchy Tree: Category -> SubCategories -> Count
    const categoryTree = useMemo(() => {
        const tree: Record<string, { count: number, subs: Record<string, number> }> = {};
        
        items.forEach(i => {
            const c = i.category || 'UNCATEGORIZED';
            const s = i.subCategory || 'NO SUB-CATEGORY';
            
            if (!tree[c]) tree[c] = { count: 0, subs: {} };
            
            tree[c].count++;
            if (!tree[c].subs[s]) tree[c].subs[s] = 0;
            tree[c].subs[s]++;
        });

        // Convert to array and sort
        return Object.entries(tree).sort((a, b) => a[0].localeCompare(b[0])).map(([catName, data]) => ({
            name: catName,
            totalCount: data.count,
            subCategories: Object.entries(data.subs).sort((a, b) => a[0].localeCompare(b[0]))
        }));
    }, [items]);

    const toggleExpand = (cat: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
        });
    };

    // --- Category Handlers ---
    const startEditCat = (cat: string) => {
        setEditingCat(cat);
        setCatEditValue(cat);
    };

    const saveCat = async () => {
        if (editingCat && catEditValue.trim() !== '' && catEditValue !== editingCat) {
            await onUpdateCategory(editingCat, catEditValue.trim());
        }
        setEditingCat(null);
    };

    const deleteCat = async (cat: string) => {
        if (window.confirm(`Delete Category "${cat}"? Items will be set to UNNAMED category.`)) {
            await onDeleteCategory(cat);
        }
    };

    // --- SubCategory Handlers ---
    const startEditSub = (cat: string, sub: string) => {
        setEditingSub({ cat, sub });
        setSubEditValue(sub);
    };

    const saveSub = async () => {
        if (editingSub && subEditValue.trim() !== '' && subEditValue !== editingSub.sub) {
            await onUpdateSubCategory(editingSub.cat, editingSub.sub, subEditValue.trim());
        }
        setEditingSub(null);
    };

    const deleteSub = async (cat: string, sub: string) => {
        if (window.confirm(`Delete Sub-Category "${sub}" from "${cat}"? Items will keep the main category but lose the sub-category.`)) {
            await onDeleteSubCategory(cat, sub);
        }
    };

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Manage Hierarchy</h2>
                    <p className="text-sm text-gray-500 font-bold">Edit Categories & Sub-Categories</p>
                </div>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 hover:bg-white transition-all">
                    Back to Dashboard
                </button>
            </div>

            <div className="space-y-4">
                {categoryTree.map((cat) => (
                    <div key={cat.name} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                        {/* CATEGORY HEADER */}
                        <div className="p-4 flex items-center justify-between bg-gray-50 border-b border-gray-100">
                            {editingCat === cat.name ? (
                                <div className="flex gap-2 w-full max-w-md">
                                    <input 
                                        className="form-control uppercase font-bold" 
                                        value={catEditValue} 
                                        onChange={e => setCatEditValue(e.target.value)}
                                        autoFocus
                                    />
                                    <button onClick={saveCat} className="bg-green-600 text-white p-2 rounded hover:bg-green-700"><PlusIcon className="w-5 h-5"/></button>
                                    <button onClick={() => setEditingCat(null)} className="bg-gray-400 text-white p-2 rounded hover:bg-gray-500"><XMarkIcon className="w-5 h-5"/></button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-4 cursor-pointer flex-grow" onClick={() => toggleExpand(cat.name)}>
                                    <div className={`transition-transform duration-200 ${expandedCats.has(cat.name) ? 'rotate-180' : ''}`}>
                                        <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 uppercase">{cat.name}</h3>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{cat.totalCount} ITEMS</span>
                                    </div>
                                </div>
                            )}

                            {editingCat !== cat.name && (
                                <div className="flex gap-2">
                                    <button onClick={() => startEditCat(cat.name)} className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"><PencilSquareIcon className="w-5 h-5"/></button>
                                    <button onClick={() => deleteCat(cat.name)} className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            )}
                        </div>

                        {/* SUB-CATEGORIES LIST */}
                        {expandedCats.has(cat.name) && (
                            <div className="p-2 bg-white">
                                {cat.subCategories.length === 0 ? (
                                    <div className="text-xs font-bold text-gray-400 p-4 text-center italic">NO SUB-CATEGORIES</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {cat.subCategories.map(([subName, count]) => (
                                            <div key={subName} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition-all group">
                                                {editingSub?.cat === cat.name && editingSub?.sub === subName ? (
                                                    <div className="flex gap-2 w-full">
                                                        <input 
                                                            className="form-control text-sm uppercase font-bold" 
                                                            value={subEditValue} 
                                                            onChange={e => setSubEditValue(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <button onClick={saveSub} className="bg-green-600 text-white p-1.5 rounded"><PlusIcon className="w-4 h-4"/></button>
                                                        <button onClick={() => setEditingSub(null)} className="bg-gray-400 text-white p-1.5 rounded"><XMarkIcon className="w-4 h-4"/></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                                            <div>
                                                                <div className="text-sm font-bold text-gray-800 uppercase">{subName}</div>
                                                                <div className="text-[9px] font-bold text-gray-400">{count} Items</div>
                                                            </div>
                                                        </div>
                                                        {subName !== 'NO SUB-CATEGORY' && (
                                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={() => startEditSub(cat.name, subName)} className="p-1.5 text-blue-500 hover:text-blue-700"><PencilSquareIcon className="w-4 h-4"/></button>
                                                                <button onClick={() => deleteSub(cat.name, subName)} className="p-1.5 text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4"/></button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CategoryManager;
