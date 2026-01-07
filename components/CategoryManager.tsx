import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useDb } from '../context/DbContext';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XMarkIcon } from './icons/XMarkIcon';

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
    }, [db]);

    const loadHierarchy = async () => {
        try {
            const docRef = doc(db, 'settings', 'categoryHierarchy');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                setHierarchy(snap.data());
            } else {
                setHierarchy({}); // Start fresh
            }
        } catch (e) {
            console.error("Failed to load hierarchy", e);
        } finally {
            setIsLoading(false);
        }
    };

    const saveHierarchy = async (newHierarchy: any) => {
        setHierarchy(newHierarchy); // Optimistic update
        await setDoc(doc(db, 'settings', 'categoryHierarchy'), newHierarchy);
    };

    // --- Add Actions ---

    const addMain = async () => {
        if (!newInputs.main.trim()) return;
        const name = newInputs.main.trim().toUpperCase();
        if (hierarchy[name]) return alert("Category exists");
        
        const next = { ...hierarchy, [name]: {} };
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, main: '' }));
    };

    const addSub1 = async () => {
        if (!selectedMain || !newInputs.sub1.trim()) return;
        const name = newInputs.sub1.trim().toUpperCase();
        const mainData = hierarchy[selectedMain] || {};
        if (mainData[name]) return alert("Sub-category exists");

        const next = { ...hierarchy, [selectedMain]: { ...mainData, [name]: {} } };
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub1: '' }));
    };

    const addSub2 = async () => {
        if (!selectedMain || !selectedSub1 || !newInputs.sub2.trim()) return;
        const name = newInputs.sub2.trim().toUpperCase();
        const sub1Data = hierarchy[selectedMain][selectedSub1] || {};
        if (sub1Data[name]) return alert("Sub-category exists");

        const next = { ...hierarchy };
        next[selectedMain] = { ...next[selectedMain] };
        next[selectedMain][selectedSub1] = { ...sub1Data, [name]: [] }; // Sub2 holds array of Sub3s
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub2: '' }));
    };

    const addSub3 = async () => {
        if (!selectedMain || !selectedSub1 || !selectedSub2 || !newInputs.sub3.trim()) return;
        const name = newInputs.sub3.trim().toUpperCase();
        const currentList = hierarchy[selectedMain][selectedSub1][selectedSub2] || [];
        if (currentList.includes(name)) return alert("Sub-category exists");

        const next = { ...hierarchy };
        next[selectedMain] = { ...next[selectedMain] };
        next[selectedMain][selectedSub1] = { ...next[selectedMain][selectedSub1] };
        next[selectedMain][selectedSub1][selectedSub2] = [...currentList, name];
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub3: '' }));
    };

    // --- Delete Actions ---

    const deleteMain = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Delete ${name} and all sub-categories?`)) return;
        const next = { ...hierarchy };
        delete next[name];
        await saveHierarchy(next);
        if (selectedMain === name) { setSelectedMain(null); setSelectedSub1(null); setSelectedSub2(null); }
    };

    const deleteSub1 = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedMain || !window.confirm(`Delete ${name}?`)) return;
        const next = { ...hierarchy };
        const mainData = { ...next[selectedMain] };
        delete mainData[name];
        next[selectedMain] = mainData;
        await saveHierarchy(next);
        if (selectedSub1 === name) { setSelectedSub1(null); setSelectedSub2(null); }
    };

    const deleteSub2 = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedMain || !selectedSub1) return;
        const next = { ...hierarchy };
        next[selectedMain] = { ...next[selectedMain] };
        const sub1Data = { ...next[selectedMain][selectedSub1] };
        delete sub1Data[name];
        next[selectedMain][selectedSub1] = sub1Data;
        await saveHierarchy(next);
        if (selectedSub2 === name) setSelectedSub2(null);
    };

    const deleteSub3 = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedMain || !selectedSub1 || !selectedSub2) return;
        const next = { ...hierarchy };
        next[selectedMain] = { ...next[selectedMain] };
        next[selectedMain][selectedSub1] = { ...next[selectedMain][selectedSub1] };
        const list = next[selectedMain][selectedSub1][selectedSub2];
        next[selectedMain][selectedSub1][selectedSub2] = list.filter((x: string) => x !== name);
        await saveHierarchy(next);
    };

    // --- Rename Actions ---

    const startEditing = (level: 'main'|'sub1'|'sub2'|'sub3', oldName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTarget({ level, oldName });
        setEditInputValue(oldName);
    };

    const cancelEditing = () => {
        setEditingTarget(null);
        setEditInputValue('');
    };

    const saveRename = async () => {
        if (!editingTarget || !editInputValue.trim()) return cancelEditing();
        const newName = editInputValue.trim().toUpperCase();
        if (newName === editingTarget.oldName) return cancelEditing();

        const { level, oldName } = editingTarget;
        const next = { ...hierarchy };

        if (level === 'main') {
            if (next[newName]) return alert("Name exists");
            next[newName] = next[oldName];
            delete next[oldName];
            if (selectedMain === oldName) setSelectedMain(newName);
        } 
        else if (level === 'sub1' && selectedMain) {
            const parent = next[selectedMain];
            if (parent[newName]) return alert("Name exists");
            parent[newName] = parent[oldName];
            delete parent[oldName];
            if (selectedSub1 === oldName) setSelectedSub1(newName);
        } 
        else if (level === 'sub2' && selectedMain && selectedSub1) {
            // Need deep copies to avoid mutating state directly before setHierarchy
            next[selectedMain] = { ...next[selectedMain] };
            const parent = next[selectedMain][selectedSub1];
            if (parent[newName]) return alert("Name exists");
            parent[newName] = parent[oldName];
            delete parent[oldName];
            if (selectedSub2 === oldName) setSelectedSub2(newName);
        }
        else if (level === 'sub3' && selectedMain && selectedSub1 && selectedSub2) {
            next[selectedMain] = { ...next[selectedMain] };
            next[selectedMain][selectedSub1] = { ...next[selectedMain][selectedSub1] };
            const list = next[selectedMain][selectedSub1][selectedSub2];
            if (list.includes(newName)) return alert("Name exists");
            const idx = list.indexOf(oldName);
            if (idx !== -1) list[idx] = newName;
        }

        await saveHierarchy(next);
        cancelEditing();
    };

    // --- List Calculation ---
    const mainList = Object.keys(hierarchy).sort();
    const sub1List = selectedMain ? Object.keys(hierarchy[selectedMain] || {}).sort() : [];
    const sub2List = selectedMain && selectedSub1 ? Object.keys(hierarchy[selectedMain][selectedSub1] || {}).sort() : [];
    const sub3List = selectedMain && selectedSub1 && selectedSub2 ? (hierarchy[selectedMain][selectedSub1][selectedSub2] || []).sort() : [];

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Category Editor</h2>
                    <p className="text-xs font-bold text-gray-500 mt-1 uppercase">Create or modify category hierarchy</p>
                </div>
                <button onClick={onBack} className="text-sm font-bold text-gray-600 hover:text-black uppercase border border-gray-300 px-4 py-2 rounded-lg bg-gray-50 hover:bg-white transition-all">
                    Back to Dashboard
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500 font-bold animate-pulse">Loading Hierarchy...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="flex overflow-x-auto min-h-[600px]">
                        <Column 
                            title="MAIN CATEGORY" 
                            items={mainList} 
                            selected={selectedMain} 
                            onSelect={(id: string) => { setSelectedMain(id); setSelectedSub1(null); setSelectedSub2(null); }}
                            onAdd={addMain}
                            onDelete={deleteMain}
                            onEdit={(name: string, e: React.MouseEvent) => startEditing('main', name, e)}
                            value={newInputs.main}
                            onChange={(v: string) => setNewInputs(p => ({...p, main: v}))}
                            placeholder="ADD MAIN..."
                            editingItem={editingTarget?.level === 'main' ? editingTarget.oldName : null}
                            editValue={editInputValue}
                            onEditChange={setEditInputValue}
                            onSaveEdit={saveRename}
                            onCancelEdit={cancelEditing}
                        />
                        <Column 
                            title="SUB CATEGORY 1" 
                            items={sub1List} 
                            selected={selectedSub1} 
                            onSelect={(id: string) => { setSelectedSub1(id); setSelectedSub2(null); }}
                            onAdd={addSub1}
                            onDelete={deleteSub1}
                            onEdit={(name: string, e: React.MouseEvent) => startEditing('sub1', name, e)}
                            value={newInputs.sub1}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub1: v}))}
                            placeholder={selectedMain ? "ADD SUB 1..." : "SELECT MAIN"}
                            disabled={!selectedMain}
                            editingItem={editingTarget?.level === 'sub1' ? editingTarget.oldName : null}
                            editValue={editInputValue}
                            onEditChange={setEditInputValue}
                            onSaveEdit={saveRename}
                            onCancelEdit={cancelEditing}
                        />
                        <Column 
                            title="SUB CATEGORY 2" 
                            items={sub2List} 
                            selected={selectedSub2} 
                            onSelect={(id: string) => setSelectedSub2(id)}
                            onAdd={addSub2}
                            onDelete={deleteSub2}
                            onEdit={(name: string, e: React.MouseEvent) => startEditing('sub2', name, e)}
                            value={newInputs.sub2}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub2: v}))}
                            placeholder={selectedSub1 ? "ADD SUB 2..." : "SELECT SUB 1"}
                            disabled={!selectedSub1}
                            editingItem={editingTarget?.level === 'sub2' ? editingTarget.oldName : null}
                            editValue={editInputValue}
                            onEditChange={setEditInputValue}
                            onSaveEdit={saveRename}
                            onCancelEdit={cancelEditing}
                        />
                        <Column 
                            title="SUB CATEGORY 3" 
                            items={sub3List} 
                            selected={null} 
                            onSelect={null}
                            onAdd={addSub3}
                            onDelete={deleteSub3}
                            onEdit={(name: string, e: React.MouseEvent) => startEditing('sub3', name, e)}
                            value={newInputs.sub3}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub3: v}))}
                            placeholder={selectedSub2 ? "ADD SUB 3..." : "SELECT SUB 2"}
                            disabled={!selectedSub2}
                            editingItem={editingTarget?.level === 'sub3' ? editingTarget.oldName : null}
                            editValue={editInputValue}
                            onEditChange={setEditInputValue}
                            onSaveEdit={saveRename}
                            onCancelEdit={cancelEditing}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;
