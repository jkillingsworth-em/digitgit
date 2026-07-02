import React, { useState, useEffect } from 'react';
import { fetchCategoryHierarchy, saveCategoryHierarchy } from '../services/categoryService';
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
    onCancelEdit,
    // Drag & Drop
    level,
    parentMain,
    parentSub1,
    parentSub2,
    onDropItem
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
                        draggable={!!onDropItem}
                        onDragStart={(e) => {
                            try { e.dataTransfer.setData('application/json', JSON.stringify({ level, name: item, parentMain, parentSub1, parentSub2 })); } catch {}
                        }}
                        onDragOver={(e) => { if(onDropItem) e.preventDefault(); }}
                        onDrop={(e) => {
                            if (!onDropItem) return;
                            e.preventDefault();
                            try {
                                const d = JSON.parse(e.dataTransfer.getData('application/json'));
                                onDropItem(d, { level, name: item, parentMain, parentSub1, parentSub2 });
                            } catch (err) { /* ignore */ }
                        }}
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
    const [selectedSub3, setSelectedSub3] = useState<string | null>(null);

    // Input State (Adding)
    const [newInputs, setNewInputs] = useState({ main: '', sub1: '', sub2: '', sub3: '' });

    // Editing State
    const [editingTarget, setEditingTarget] = useState<{ level: 'main'|'sub1'|'sub2'|'sub3', oldName: string } | null>(null);
    const [editInputValue, setEditInputValue] = useState('');

    useEffect(() => {
        loadHierarchy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db]);

    const saveHierarchy = async (next: any) => {
        try {
            await saveCategoryHierarchy(db, next);
            setHierarchy(next);
        } catch (err) {
            console.error('Failed to save hierarchy', err);
        }
    };

    const addMain = async () => {
        const v = newInputs.main.trim();
        if (!v) return;
        const next = { ...(hierarchy || {}) };
        if (!next[v]) next[v] = {};
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, main: '' }));
        setSelectedMain(v);
    };

    const addSub1 = async () => {
        if (!selectedMain) return;
        const v = newInputs.sub1.trim();
        if (!v) return;
        const next = { ...(hierarchy || {}) };
        if (!next[selectedMain]) next[selectedMain] = {};
        if (!next[selectedMain][v]) next[selectedMain][v] = {};
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub1: '' }));
        setSelectedSub1(v);
    };

    const addSub2 = async () => {
        if (!selectedMain || !selectedSub1) return;
        const v = newInputs.sub2.trim();
        if (!v) return;
        const next = { ...(hierarchy || {}) };
        if (!next[selectedMain]) next[selectedMain] = {};
        if (!next[selectedMain][selectedSub1]) next[selectedMain][selectedSub1] = {};
        if (!next[selectedMain][selectedSub1][v]) next[selectedMain][selectedSub1][v] = [];
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub2: '' }));
        setSelectedSub2(v);
    };

    const addSub3 = async () => {
        if (!selectedMain || !selectedSub1 || !selectedSub2) return;
        const v = newInputs.sub3.trim();
        if (!v) return;
        const next = { ...(hierarchy || {}) };
        if (!Array.isArray(next[selectedMain][selectedSub1][selectedSub2])) next[selectedMain][selectedSub1][selectedSub2] = [];
        if (!next[selectedMain][selectedSub1][selectedSub2].includes(v)) next[selectedMain][selectedSub1][selectedSub2].push(v);
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub3: '' }));
        setSelectedSub3(v);
    };

    // Edit / Rename handlers
    const startEdit = (level: 'main'|'sub1'|'sub2'|'sub3', name: string) => {
        setEditingTarget({ level, oldName: name });
        setEditInputValue(name);
    };

    const cancelEdit = () => {
        setEditingTarget(null);
        setEditInputValue('');
    };

    const saveEdit = async () => {
        if (!editingTarget) return;
        const { level, oldName } = editingTarget;
        const v = editInputValue.trim();
        if (!v || v === oldName) return cancelEdit();

        const next = { ...(hierarchy || {}) };

        try {
            if (level === 'main') {
                if (next[v]) throw new Error('Name already exists');
                next[v] = next[oldName];
                delete next[oldName];
                await saveHierarchy(next);
                setSelectedMain(v);
                setSelectedSub1(null);
                setSelectedSub2(null);
                setSelectedSub3(null);
            } else if (level === 'sub1') {
                if (!selectedMain) return cancelEdit();
                if (next[selectedMain][v]) throw new Error('Name already exists');
                next[selectedMain][v] = next[selectedMain][oldName];
                delete next[selectedMain][oldName];
                await saveHierarchy(next);
                setSelectedSub1(v);
                setSelectedSub2(null);
                setSelectedSub3(null);
            } else if (level === 'sub2') {
                if (!selectedMain || !selectedSub1) return cancelEdit();
                if (next[selectedMain][selectedSub1][v]) throw new Error('Name already exists');
                next[selectedMain][selectedSub1][v] = next[selectedMain][selectedSub1][oldName];
                delete next[selectedMain][selectedSub1][oldName];
                await saveHierarchy(next);
                setSelectedSub2(v);
                setSelectedSub3(null);
            } else if (level === 'sub3') {
                if (!selectedMain || !selectedSub1 || !selectedSub2) return cancelEdit();
                const arr = next[selectedMain][selectedSub1][selectedSub2] || [];
                if (arr.includes(v)) throw new Error('Name already exists');
                const idx = arr.indexOf(oldName);
                if (idx !== -1) arr[idx] = v;
                next[selectedMain][selectedSub1][selectedSub2] = arr;
                await saveHierarchy(next);
                setSelectedSub3(v);
            }
        } catch (err: any) {
            console.error('Rename failed', err);
            // fallback: reload
            await loadHierarchy();
        } finally {
            cancelEdit();
        }
    };

    // Delete handlers
    const deleteItem = async (level: 'main'|'sub1'|'sub2'|'sub3', name: string) => {
        if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
        const next = { ...(hierarchy || {}) };
        try {
            if (level === 'main') {
                delete next[name];
                await saveHierarchy(next);
                if (selectedMain === name) { setSelectedMain(null); setSelectedSub1(null); setSelectedSub2(null); setSelectedSub3(null); }
            } else if (level === 'sub1') {
                if (!selectedMain) return;
                delete next[selectedMain][name];
                await saveHierarchy(next);
                if (selectedSub1 === name) { setSelectedSub1(null); setSelectedSub2(null); setSelectedSub3(null); }
            } else if (level === 'sub2') {
                if (!selectedMain || !selectedSub1) return;
                delete next[selectedMain][selectedSub1][name];
                await saveHierarchy(next);
                if (selectedSub2 === name) { setSelectedSub2(null); setSelectedSub3(null); }
            } else if (level === 'sub3') {
                if (!selectedMain || !selectedSub1 || !selectedSub2) return;
                const arr = next[selectedMain][selectedSub1][selectedSub2] || [];
                next[selectedMain][selectedSub1][selectedSub2] = arr.filter((a: string) => a !== name);
                await saveHierarchy(next);
                if (selectedSub3 === name) setSelectedSub3(null);
            }
        } catch (err) {
            console.error('Delete failed', err);
            await loadHierarchy();
        }
    };

    const loadHierarchy = async () => {
        try {
            setHierarchy(await fetchCategoryHierarchy(db));
        } catch (err) {
            console.error("Failed to load category hierarchy", err);
            setHierarchy({});
        } finally {
            setIsLoading(false);
        }
    };

    // Drag & Drop move handler
    const handleDragDrop = async (drag: any, dest: any) => {
        // drag: { level, name, parentMain, parentSub1, parentSub2 }
        // dest: { level, name, parentMain, parentSub1, parentSub2 }
        try {
            const next = { ...(hierarchy || {}) };
            const { level: sLevel, name: sName, parentMain: sMain, parentSub1: sSub1, parentSub2: sSub2 } = drag;
            const { level: dLevel, name: dName, parentMain: dMain, parentSub1: dSub1, parentSub2: dSub2 } = dest;

            // Move sub1 -> main (change parent)
            if (sLevel === 'sub1' && dLevel === 'main') {
                // remove from source main
                if (!sMain) return;
                const node = next[sMain] && next[sMain][sName];
                if (!node) return;
                // ensure dest container
                if (!next[dName]) next[dName] = {};
                next[dName][sName] = node;
                delete next[sMain][sName];
            }

            // Move sub2 -> sub1 (possibly cross-main)
            if (sLevel === 'sub2' && dLevel === 'sub1') {
                if (!sMain || !sSub1 || !dMain) return;
                const node = next[sMain]?.[sSub1]?.[sName];
                if (!node) return;
                if (!next[dMain]) next[dMain] = {};
                if (!next[dMain][dName]) next[dMain][dName] = {};
                next[dMain][dName][sName] = node;
                delete next[sMain][sSub1][sName];
            }

            // Move sub3 -> sub2 (array element move)
            if (sLevel === 'sub3' && dLevel === 'sub2') {
                if (!sMain || !sSub1 || !sSub2 || !dMain || !dSub1) return;
                const arr = next[sMain][sSub1][sSub2] || [];
                const idx = arr.indexOf(sName);
                if (idx === -1) return;
                // remove
                arr.splice(idx, 1);
                // ensure destination array
                if (!Array.isArray(next[dMain][dSub1][dName])) next[dMain][dSub1][dName] = [];
                next[dMain][dSub1][dName].push(sName);
            }

            await saveHierarchy(next);
            // reset selections conservatively
            setSelectedMain(null); setSelectedSub1(null); setSelectedSub2(null); setSelectedSub3(null);
        } catch (err) {
            console.error('Drag/drop failed', err);
            await loadHierarchy();
        }
    };

    // ... rest of CategoryManager implementation (unchanged) ...
    return (
        <div className="p-4">
            <button onClick={onBack} className="text-sm font-bold text-em-red mb-4">Back</button>
            {/* UI rendering using Column component */}
            <div className="flex gap-4">
                    <Column
                        title="Main Categories"
                        items={Object.keys(hierarchy || {})}
                        selected={selectedMain}
                        onSelect={(m:string) => { setSelectedMain(m); setSelectedSub1(null); setSelectedSub2(null); setSelectedSub3(null); }}
                        onAdd={addMain}
                        onDelete={(name:string,e?:any) => { e?.stopPropagation(); deleteItem('main', name); }}
                        onEdit={(name:string,e?:any) => { e?.stopPropagation(); startEdit('main', name); }}
                        level="main"
                        parentMain={null}
                        parentSub1={null}
                        parentSub2={null}
                        onDropItem={async (drag:any, dest:any) => {
                            // moving a sub1 into a main (or other moves) handled in manager
                            await (async function() { /* handled below in manager via handler */ })();
                        }}
                        editingItem={editingTarget?.level === 'main' ? editingTarget.oldName : null}
                        editValue={editingTarget?.level === 'main' ? editInputValue : ''}
                        onEditChange={(v:string) => setEditInputValue(v)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        value={newInputs.main}
                        onChange={(v:string) => setNewInputs(p=>({...p, main:v}))}
                        placeholder="Add Category..."
                    />

                    <Column
                        title="Sub 1"
                        items={selectedMain ? Object.keys(hierarchy[selectedMain] || {}) : []}
                        selected={selectedSub1}
                        onSelect={(s:string) => { setSelectedSub1(s); setSelectedSub2(null); setSelectedSub3(null); }}
                        onAdd={addSub1}
                        onDelete={(name:string,e?:any) => { e?.stopPropagation(); deleteItem('sub1', name); }}
                        onEdit={(name:string,e?:any) => { e?.stopPropagation(); startEdit('sub1', name); }}
                        level="sub1"
                        parentMain={selectedMain}
                        parentSub1={null}
                        parentSub2={null}
                        onDropItem={(drag:any, dest:any) => handleDragDrop(drag, dest)}
                        editingItem={editingTarget?.level === 'sub1' ? editingTarget.oldName : null}
                        editValue={editingTarget?.level === 'sub1' ? editInputValue : ''}
                        onEditChange={(v:string) => setEditInputValue(v)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        value={newInputs.sub1}
                        onChange={(v:string) => setNewInputs(p=>({...p, sub1:v}))}
                        placeholder="Add Sub1..."
                        disabled={!selectedMain}
                    />

                    <Column
                        title="Sub 2"
                        items={selectedSub1 && selectedMain ? Object.keys(hierarchy[selectedMain]?.[selectedSub1] || {}) : []}
                        selected={selectedSub2}
                        onSelect={(s:string) => { setSelectedSub2(s); setSelectedSub3(null); }}
                        onAdd={addSub2}
                        onDelete={(name:string,e?:any) => { e?.stopPropagation(); deleteItem('sub2', name); }}
                        onEdit={(name:string,e?:any) => { e?.stopPropagation(); startEdit('sub2', name); }}
                        level="sub2"
                        parentMain={selectedMain}
                        parentSub1={selectedSub1}
                        parentSub2={null}
                        onDropItem={(drag:any, dest:any) => handleDragDrop(drag, dest)}
                        editingItem={editingTarget?.level === 'sub2' ? editingTarget.oldName : null}
                        editValue={editingTarget?.level === 'sub2' ? editInputValue : ''}
                        onEditChange={(v:string) => setEditInputValue(v)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        value={newInputs.sub2}
                        onChange={(v:string) => setNewInputs(p=>({...p, sub2:v}))}
                        placeholder="Add Sub2..."
                        disabled={!selectedSub1}
                    />

                    <Column
                        title="Sub 3"
                        items={selectedSub2 && selectedSub1 && selectedMain ? (hierarchy[selectedMain]?.[selectedSub1]?.[selectedSub2] || []) : []}
                        selected={selectedSub3}
                        onSelect={(s:string) => setSelectedSub3(s)}
                        onAdd={addSub3}
                        onDelete={(name:string,e?:any) => { e?.stopPropagation(); deleteItem('sub3', name); }}
                        onEdit={(name:string,e?:any) => { e?.stopPropagation(); startEdit('sub3', name); }}
                        level="sub3"
                        parentMain={selectedMain}
                        parentSub1={selectedSub1}
                        parentSub2={selectedSub2}
                        onDropItem={(drag:any, dest:any) => handleDragDrop(drag, dest)}
                        editingItem={editingTarget?.level === 'sub3' ? editingTarget.oldName : null}
                        editValue={editingTarget?.level === 'sub3' ? editInputValue : ''}
                        onEditChange={(v:string) => setEditInputValue(v)}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        value={newInputs.sub3}
                        onChange={(v:string) => setNewInputs(p=>({...p, sub3:v}))}
                        placeholder="Add Sub3..."
                        disabled={!selectedSub2}
                    />
            </div>
        </div>
    );
};

export default CategoryManager;