import React, { useState, useMemo } from 'react';
import { InventoryItem } from '../types';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { TrashIcon } from './icons/TrashIcon';
import { PlusIcon } from './icons/PlusIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface CategoryDefinition {
    id: string; // This is the category name
    subCategories: string[];
}

interface CategoryManagerProps {
    items: InventoryItem[];
    definedCategories: CategoryDefinition[]; // New prop for explicit categories
    onAddCategory: (name: string) => Promise<void>;
    onAddSubCategory: (category: string, subName: string) => Promise<void>;
    onUpdateCategory: (oldName: string, newName: string) => Promise<void>;
    onDeleteCategory: (categoryName: string) => Promise<void>;
    onUpdateSubCategory: (category: string, oldSub: string, newSub: string) => Promise<void>;
    onDeleteSubCategory: (category: string, sub: string) => Promise<void>;
    onBack: () => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
    items, 
    definedCategories,
    onAddCategory,
    onAddSubCategory,
    onUpdateCategory, 
    onDeleteCategory, 
    onUpdateSubCategory,
    onDeleteSubCategory,
    onBack 
}) => {
    // --- State ---
    const [editingCat, setEditingCat] = useState<string | null>(null);
    const [catEditValue, setCatEditValue] = useState('');

    const [editingSub, setEditingSub] = useState<{ cat: string, sub: string } | null>(null);
    const [subEditValue, setSubEditValue] = useState('');

    const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

    // New Add State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSubCategoryValues, setNewSubCategoryValues] = useState<Record<string, string>>({});

    // --- Derived Data ---
    // Merge "Items in Inventory" with "Defined Categories" from DB
    const categoryTree = useMemo(() => {
        const tree: Record<string, { count: number, subs: Set<string>, subCounts: Record<string, number> }> = {};
        
        // 1. Initialize with Defined Categories (even if empty)
        definedCategories.forEach(def => {
            if (!tree[def.id]) tree[def.id] = { count: 0, subs: new Set(), subCounts: {} };
            def.subCategories.forEach(sub => tree[def.id].subs.add(sub));
        });

        // 2. Populate with actual Inventory Data
        items.forEach(i => {
            const c = i.category || 'UNCATEGORIZED';
            const s = i.subCategory;
            
            if (!tree[c]) tree[c] = { count: 0, subs: new Set(), subCounts: {} };
            
            tree[c].count++;
            
            if (s) {
                tree[c].subs.add(s);
                tree[c].subCounts[s] = (tree[c].subCounts[s] || 0) + 1;
            }
        });

        // 3. Convert to Sorted Array
        return Object.entries(tree).sort((a, b) => a[0].localeCompare(b[0])).map(([catName, data]) => ({
            name: catName,
            totalCount: data.count,
            subCategories: Array.from(data.subs).sort().map(subName => ({
                name: subName,
                count: data.subCounts[subName] || 0
            }))
        }));
    }, [items, definedCategories]);

    const toggleExpand = (cat: string) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
        });
    };

    // --- Handlers ---

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        await onAddCategory(newCategoryName.trim().toUpperCase());
        setNewCategoryName('');
    };

    const handleAddSub = async (cat: string) => {
        const val = newSubCategoryValues[cat];
        if (!val?.trim()) return;
        await onAddSubCategory(cat, val.trim().toUpperCase());
        setNewSubCategoryValues(prev => ({ ...prev, [cat]: '' }));
    };

    const startEditCat = (cat: string) => {
        setEditingCat(cat);
        setCatEditValue(cat);
    };

    const saveCat = async () => {
        if (editingCat && catEditValue.trim() !== '' && catEditValue !== editingCat) {
            await onUpdateCategory(editingCat, catEditValue.trim().toUpperCase());
        }
        setEditingCat(null);
    };

    const deleteCat = async (cat: string) => {
        if (window.confirm(`Delete Category "${cat}"? Items will be set to UNNAMED.`)) {
            await onDeleteCategory(cat);
        }
    };

    const startEditSub = (cat: string, sub: string) => {
        setEditingSub({ cat, sub });
        setSubEditValue(sub);
    };

    const saveSub = async () => {
        if (editingSub && subEditValue.trim() !== '' && subEditValue !== editingSub.sub) {
            await onUpdateSubCategory(editingSub.cat, editingSub.sub, subEditValue.trim().toUpperCase());
        }
        setEditingSub(null);
    };

    const deleteSub = async (cat: string, sub: string) => {
        if (window.confirm(`Delete Sub-Category "${sub}"?`)) {
            await onDeleteSubCategory(cat, sub);
        }
    };

    return (
        <div className="animate-fade-in-down pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200 gap-4">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Manage Hierarchy</h2>
                    <p className="text-sm text-gray-500 font-bold">Create and organize product categories</p>
                </div>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 hover:bg-white transition-all">
                    Back to Dashboard
                </button>
            </div>

            {/* Add New Category Section */}
            <div className="mb-6 bg-gray-50 p-4 rounded-xl border-2 border-dashed border-gray-300 flex flex-col md:flex-row gap-3 items-center">
                <input 
                    className="form-control flex-grow uppercase font-bold"
                    placeholder="ENTER NEW CATEGORY NAME..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddCategory()}
                />
                <button 
                    onClick={handleAddCategory}
                    disabled={!newCategoryName.trim()}
                    className="bg-em-red text-white px-6 py-2 rounded-lg font-black uppercase shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap w-full md:w-auto"
                >
                    <PlusIcon className="w-5 h-5 inline mr-2"/>
                    Add Category
                </button>
            </div>

            {/* Categories List */}
            <div className="space-y-4">
                {categoryTree.map((cat) => (
                    <div key={cat.name} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                        {/* CATEGORY HEADER */}
                        <div className="p-4 flex items-center justify-between bg-white border-b border-gray-100">
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
                                    <div className={`transition-transform duration-200 p-1 rounded-full hover:bg-gray-100 ${expandedCats.has(cat.name) ? 'rotate-180 bg-gray-100' : ''}`}>
                                        <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-gray-900 uppercase">{cat.name}</h3>
                                        <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                            <span>{cat.totalCount} ITEMS</span>
                                            <span>•</span>
                                            <span>{cat.subCategories.length} SUB-CATS</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {editingCat !== cat.name && (
                                <div className="flex gap-1">
                                    <button onClick={() => startEditCat(cat.name)} className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"><PencilSquareIcon className="w-5 h-5"/></button>
                                    <button onClick={() => deleteCat(cat.name)} className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"><TrashIcon className="w-5 h-5"/></button>
                                </div>
                            )}
                        </div>

                        {/* EXPANDED CONTENT */}
                        {expandedCats.has(cat.name) && (
                            <div className="p-4 bg-gray-50 border-t border-gray-100 animate-fade-in-down">
                                
                                {/* Add Sub-Category Input */}
                                <div className="flex gap-2 mb-4 max-w-md">
                                    <input 
                                        className="form-control text-sm uppercase font-bold bg-white"
                                        placeholder={`ADD SUB-CATEGORY TO ${cat.name}...`}
                                        value={newSubCategoryValues[cat.name] || ''}
                                        onChange={e => setNewSubCategoryValues(p => ({ ...p, [cat.name]: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && handleAddSub(cat.name)}
                                    />
                                    <button 
                                        onClick={() => handleAddSub(cat.name)}
                                        className="bg-white border border-gray-300 text-gray-700 px-3 rounded-lg hover:bg-gray-100 hover:text-black transition-colors"
                                    >
                                        <PlusIcon className="w-5 h-5"/>
                                    </button>
                                </div>

                                {/* Sub-Categories Grid */}
                                {cat.subCategories.length === 0 ? (
                                    <div className="text-xs font-bold text-gray-400 text-center italic py-2">No sub-categories defined</div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {cat.subCategories.map((sub) => (
                                            <div key={sub.name} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-all group">
                                                {editingSub?.cat === cat.name && editingSub?.sub === sub.name ? (
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
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-800 uppercase">{sub.name}</div>
                                                            <div className="text-[9px] font-bold text-gray-400">{sub.count} Items</div>
                                                        </div>
                                                        <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => startEditSub(cat.name, sub.name)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><PencilSquareIcon className="w-4 h-4"/></button>
                                                            <button onClick={() => deleteSub(cat.name, sub.name)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><TrashIcon className="w-4 h-4"/></button>
                                                        </div>
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
