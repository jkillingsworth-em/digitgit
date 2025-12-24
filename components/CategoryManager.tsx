import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { PlusIcon } from './icons/PlusIcon';
import { TrashIcon } from './icons/TrashIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

// The Hierarchy is stored in a single document: 'settings/categoryHierarchy'
// Structure: { "Main": { "Sub1": { "Sub2": ["Sub3A", "Sub3B"] } } }

interface CategoryManagerProps {
    onBack: () => void;
    // These props are legacy from the old manager but kept to satisfy TypeScript if parent passes them
    items?: any[];
    definedCategories?: any[];
    onAddCategory?: any;
    onAddSubCategory?: any;
    onUpdateCategory?: any;
    onDeleteCategory?: any;
    onUpdateSubCategory?: any;
    onDeleteSubCategory?: any;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ onBack }) => {
    const [hierarchy, setHierarchy] = useState<any>({});
    const [isLoading, setIsLoading] = useState(true);
    
    // Selection State
    const [selectedMain, setSelectedMain] = useState<string | null>(null);
    const [selectedSub1, setSelectedSub1] = useState<string | null>(null);
    const [selectedSub2, setSelectedSub2] = useState<string | null>(null);

    // Input State
    const [newInputs, setNewInputs] = useState({ main: '', sub1: '', sub2: '', sub3: '' });

    useEffect(() => {
        loadHierarchy();
    }, []);

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

    // --- Actions ---

    const addMain = async () => {
        if (!newInputs.main.trim()) return;
        const name = newInputs.main.trim().toUpperCase();
        if (hierarchy[name]) return alert("Category exists");
        
        const next = { ...hierarchy, [name]: {} };
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, main: '' }));
    };

    const deleteMain = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm(`Delete ${name} and all sub-categories?`)) return;
        const next = { ...hierarchy };
        delete next[name];
        await saveHierarchy(next);
        if (selectedMain === name) { setSelectedMain(null); setSelectedSub1(null); setSelectedSub2(null); }
    };

    const addSub1 = async () => {
        if (!selectedMain || !newInputs.sub1.trim()) return;
        const name = newInputs.sub1.trim().toUpperCase();
        
        const mainData = hierarchy[selectedMain] || {};
        if (mainData[name]) return alert("Sub-category exists");

        const next = { 
            ...hierarchy, 
            [selectedMain]: { ...mainData, [name]: {} } 
        };
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub1: '' }));
    };

    const deleteSub1 = async (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!selectedMain) return;
        if (!window.confirm(`Delete ${name}?`)) return;
        
        const next = { ...hierarchy };
        const mainData = { ...next[selectedMain] };
        delete mainData[name];
        next[selectedMain] = mainData;
        
        await saveHierarchy(next);
        if (selectedSub1 === name) { setSelectedSub1(null); setSelectedSub2(null); }
    };

    const addSub2 = async () => {
        if (!selectedMain || !selectedSub1 || !newInputs.sub2.trim()) return;
        const name = newInputs.sub2.trim().toUpperCase();
        
        const sub1Data = hierarchy[selectedMain][selectedSub1] || {};
        if (sub1Data[name]) return alert("Sub-category 2 exists");

        const next = { ...hierarchy };
        // Deep copy path
        next[selectedMain] = { ...next[selectedMain] };
        next[selectedMain][selectedSub1] = { ...next[selectedMain][selectedSub1], [name]: [] }; // Sub2 holds array of Sub3s
        
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub2: '' }));
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

    const addSub3 = async () => {
        if (!selectedMain || !selectedSub1 || !selectedSub2 || !newInputs.sub3.trim()) return;
        const name = newInputs.sub3.trim().toUpperCase();
        
        const currentList = hierarchy[selectedMain][selectedSub1][selectedSub2] || [];
        if (currentList.includes(name)) return alert("Sub-category 3 exists");

        const next = { ...hierarchy };
        next[selectedMain] = { ...next[selectedMain] };
        next[selectedMain][selectedSub1] = { ...next[selectedMain][selectedSub1] };
        next[selectedMain][selectedSub1][selectedSub2] = [...currentList, name];
        
        await saveHierarchy(next);
        setNewInputs(p => ({ ...p, sub3: '' }));
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

    // --- Render Helpers ---

    const Column = ({ title, items, selected, onSelect, onAdd, onDelete, value, onChange, placeholder, disabled }: any) => (
        <div className={`flex-1 flex flex-col min-w-[250px] border-r border-gray-200 last:border-0 h-[600px] ${disabled ? 'bg-gray-50 opacity-50 pointer-events-none' : 'bg-white'}`}>
            <div className="p-3 bg-gray-100 border-b border-gray-200 font-black text-gray-700 text-xs uppercase tracking-widest sticky top-0 flex justify-between items-center">
                {title}
                <span className="text-[9px] text-gray-400">{items.length} items</span>
            </div>
            <div className="flex-grow overflow-y-auto p-2 space-y-1">
                {items.map((item: string) => (
                    <div 
                        key={item} 
                        onClick={() => onSelect && onSelect(item)}
                        className={`
                            px-3 py-2 text-sm font-bold rounded cursor-pointer flex justify-between items-center group transition-colors
                            ${selected === item ? 'bg-em-red text-white' : 'text-gray-700 hover:bg-gray-100'}
                        `}
                    >
                        <span className="truncate mr-2">{item}</span>
                        <div className="flex items-center gap-1">
                            {selected === item && <ChevronDownIcon className="w-4 h-4 -rotate-90"/>}
                            {onDelete && (
                                <button 
                                    onClick={(e) => onDelete(item, e)} 
                                    className={`p-1 rounded ${selected === item ? 'text-white hover:bg-red-800' : 'text-gray-300 hover:text-red-600 hover:bg-white'}`}
                                >
                                    <TrashIcon className="w-4 h-4"/>
                                </button>
                            )}
                        </div>
                    </div>
                ))}
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

    const mainList = Object.keys(hierarchy).sort();
    const sub1List = selectedMain ? Object.keys(hierarchy[selectedMain] || {}).sort() : [];
    const sub2List = selectedMain && selectedSub1 ? Object.keys(hierarchy[selectedMain][selectedSub1] || {}).sort() : [];
    const sub3List = selectedMain && selectedSub1 && selectedSub2 ? (hierarchy[selectedMain][selectedSub1][selectedSub2] || []).sort() : [];

    return (
        <div className="animate-fade-in-down pb-20">
            <div className="flex justify-between items-center mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Hierarchy Editor</h2>
                    <p className="text-xs font-bold text-gray-500 mt-1 uppercase">Define category structure: Main {'>'} Sub1 {'>'} Sub2 {'>'} Sub3</p>
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
                            title="Main (Level 0)" 
                            items={mainList} 
                            selected={selectedMain} 
                            onSelect={(id: string) => { setSelectedMain(id); setSelectedSub1(null); setSelectedSub2(null); }}
                            onAdd={addMain}
                            onDelete={deleteMain}
                            value={newInputs.main}
                            onChange={(v: string) => setNewInputs(p => ({...p, main: v}))}
                            placeholder="ADD MAIN..."
                        />
                        <Column 
                            title="Sub 1 (Multi)" 
                            items={sub1List} 
                            selected={selectedSub1} 
                            onSelect={(id: string) => { setSelectedSub1(id); setSelectedSub2(null); }}
                            onAdd={addSub1}
                            onDelete={deleteSub1}
                            value={newInputs.sub1}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub1: v}))}
                            placeholder={selectedMain ? "ADD SUB 1..." : "SELECT MAIN"}
                            disabled={!selectedMain}
                        />
                        <Column 
                            title="Sub 2 (Multi)" 
                            items={sub2List} 
                            selected={selectedSub2} 
                            onSelect={(id: string) => setSelectedSub2(id)}
                            onAdd={addSub2}
                            onDelete={deleteSub2}
                            value={newInputs.sub2}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub2: v}))}
                            placeholder={selectedSub1 ? "ADD SUB 2..." : "SELECT SUB 1"}
                            disabled={!selectedSub1}
                        />
                        <Column 
                            title="Sub 3 (Single)" 
                            items={sub3List} 
                            selected={null} 
                            onSelect={null}
                            onAdd={addSub3}
                            onDelete={deleteSub3}
                            value={newInputs.sub3}
                            onChange={(v: string) => setNewInputs(p => ({...p, sub3: v}))}
                            placeholder={selectedSub2 ? "ADD SUB 3..." : "SELECT SUB 2"}
                            disabled={!selectedSub2}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;
