import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useDb } from '../context/DbContext';
import { PlusIcon } from './icons/PlusIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { PencilSquareIcon } from './icons/PencilSquareIcon.tsx';
import { CheckIcon } from './icons/CheckIcon.tsx';
import { XMarkIcon } from './icons/XMarkIcon.tsx';
import { InventoryItem } from '../types.ts';

// The Hierarchy is stored in a single document: 'settings/categoryHierarchy'
// Structure: { "Main": { "Sub1": { "Sub2": ["Sub3A", "Sub3B"] } } }

interface CategoryManagerProps {
    onBack: () => void;
    // Legacy props (optional) to prevent type errors if passed by parent
    items?: any[];
    definedCategories?: any[];
    onAddCategory?: any;
    onAddSubCategory?: any;
    onUpdateCategory?: any;
    onDeleteCategory?: any;
    onUpdateSubCategory?: any;
    onDeleteSubCategory?: any;
}

// --- Helper Component Defined Outside to Prevent Re-Render Focus Loss ---
const Column = ({ 
    title, 
    items, 
    selected, 
    onSelect, 
    onAdd, 
    onDelete, 
    onEdit, 
    value, 
    onChange, 
    placeholder, 
    disabled,
    // Edit Mode Props
    editingItem,
    editValue,
    onEditChange,
    onSaveEdit,
    onCancelEdit
}: any) => (
    <div className={`flex-1 flex flex-col min-w-[250px] border-r border-gray-200 last:border-0 h-[600px] ${disabled ? 'bg-gray-50 opacity-50 pointer-events-none' : 'bg-white'}`}>
        <div className="p-3 bg-gray-100 border-b border-gray-200 font-black text-gray-700 text-xs uppercase tracking-widest sticky top-0 flex justify-between items-center">
            {title}
            <span className="text-[9px] text-gray-400">{items.length} items</span>
        </div>
        <div className="flex-grow overflow-y-auto p-2 space-y-1">
            {items.map((item: string) => {
                const isEditing = editingItem === item;
                const isSelected = selected === item;

                return (
                    <div 
                        key={item} 
                        onClick={() => !isEditing && onSelect && onSelect(item)}
                        className={`
                            px-3 py-2 text-sm font-bold rounded cursor-pointer flex justify-between items-center group transition-colors min-h-[40px]
                            ${isSelected ? 'bg-em-red text-white' : 'text-gray-700 hover:bg-gray-100'}
                        `}
                    >
                        {isEditing ? (
                            <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    className="w-full text-xs font-bold p-1 border border-gray-300 rounded text-black uppercase focus:outline-none focus:border-em-red"
                                    value={editValue}
                                    onChange={(e) => onEditChange(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if(e.key === 'Enter') onSaveEdit();
                                        if(e.key === 'Escape') onCancelEdit();
                                    }}
                                />
                                <button onClick={onSaveEdit} className="text-green-600 hover:text-green-800 p-1"><CheckIcon className="w-4 h-4"/></button>
                                <button onClick={onCancelEdit} className="text-red-500 hover:text-red-700 p-1"><XMarkIcon className="w-4 h-4"/></button>
                            </div>
                        ) : (
                            <>
                                <span className="truncate mr-2">{item}</span>
                                <div className="flex items-center gap-1">
                                    {/* Selection Indicator */}
                                    {isSelected && <ChevronDownIcon className="w-4 h-4 -rotate-90"/>}
                                    
                                    {/* Action Buttons (Visible on hover or selection) */}
                                    <div className={`flex items-center ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                        {onEdit && (
                                            <button 
                                                onClick={(e) => onEdit(item, e)}
                                                className={`p-1 rounded ${isSelected ? 'text-white hover:bg-red-800' : 'text-gray-400 hover:text-blue-600 hover:bg-white'}`}
                                                title="Rename"
                                            >
                                                <PencilSquareIcon className="w-4 h-4"/>
                                            </button>
                                        )}
                                        {onDelete && (
                                            <button 
                                                onClick={(e) => onDelete(item, e)} 
                                                className={`p-1 rounded ${isSelected ? 'text-white hover:bg-red-800' : 'text-gray-400 hover:text-red-600 hover:bg-white'}`}
                                                title="Delete"
                                            >
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                );
            })}
        </div>
        <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
                <input 
                    className="w-full text-xs font-bold p-2 border border-gray-300 rounded uppercase focus:ring-1 focus:ring-em-red focus:outline-none"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    onKeyDown={e => e.key === 'Enter' && onAdd()}
                />
                <button onClick={onAdd} disabled={!value.trim()} className="bg-gray-100 hover:bg-em-red hover:text-white text-gray-600 p-2 rounded transition-colors disabled:opacity-50">
                    <PlusIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
);

const CategoryManager: React.FC<CategoryManagerProps> = ({ onBack }) => {
    const db = useDb();
    const [hierarchy, setHierarchy] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Selection State
    const [selectedMain, setSelectedMain] = useState<string | null>(null);
    const [selectedSub1, setSelectedSub1] = useState<string | null>(null);
    const [selectedSub2, setSelectedSub2] = useState<string | null>(null);

    // Input State (Adding)
    const [newInputs, setNewInputs] = useState({ main: '', sub1: '', sub2: '', sub3: '' });

    // Editing State
    const [editingTarget, setEditingTarget] = useState<{ level: 'main'|'sub1'|'sub2'|'sub3', oldName: string } | null>(null);
    const [editInputValue, setEditInputValue] = useState('');

    useEffect(() => {
        loadHierarchy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    const loadHierarchy = async () => {
        try {
            const docRef = doc(db, 'settings', 'categoryHierarchy');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setHierarchy(snap.data());
            } else {
                setHierarchy({});
            }
        } catch (err) {
            console.error("Failed to load category hierarchy", err);
            setHierarchy({});
        } finally {
            setIsLoading(false);
        }
    };

    // ... rest of CategoryManager implementation (unchanged) ...
    return (
        <div className="p-4">
            <button onClick={onBack} className="text-sm font-bold text-em-red mb-4">Back</button>
            {/* UI rendering using Column component */}
            <div className="flex gap-4">
                <Column title="Main Categories" items={Object.keys(hierarchy || {})} selected={selectedMain} onSelect={(m:string) => setSelectedMain(m)} onAdd={() => {}} onDelete={() => {}} onEdit={() => {}} value={newInputs.main} onChange={(v:string) => setNewInputs(p=>({...p, main:v}))} placeholder="Add Category..." />
                <Column title="Sub 1" items={selectedMain ? Object.keys(hierarchy[selectedMain] || {}) : []} selected={selectedSub1} onSelect={(s:string) => setSelectedSub1(s)} onAdd={() => {}} onDelete={() => {}} onEdit={() => {}} value={newInputs.sub1} onChange={(v:string) => setNewInputs(p=>({...p, sub1:v}))} placeholder="Add Sub1..." disabled={!selectedMain} />
                <Column title="Sub 2" items={selectedSub1 && selectedMain ? Object.keys(hierarchy[selectedMain]?.[selectedSub1] || {}) : []} selected={selectedSub2} onSelect={(s:string) => setSelectedSub2(s)} onAdd={() => {}} onDelete={() => {}} onEdit={() => {}} value={newInputs.sub2} onChange={(v:string) => setNewInputs(p=>({...p, sub2:v}))} placeholder="Add Sub2..." disabled={!selectedSub1} />
            </div>
        </div>
    );
};

export default CategoryManager;