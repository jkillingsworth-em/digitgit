import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckIcon } from './icons/CheckIcon';

interface MultiSelectDropdownProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (selected: string[]) => void;
    placeholder?: string;
    disabled?: boolean;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ 
    label, options, selected, onChange, placeholder = "Select...", disabled = false 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (opt: string) => {
        if (selected.includes(opt)) {
            onChange(selected.filter(s => s !== opt));
        } else {
            onChange([...selected, opt]);
        }
    };

    const removeOption = (e: React.MouseEvent, opt: string) => {
        e.stopPropagation();
        onChange(selected.filter(s => s !== opt));
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-[11px] font-bold text-gray-600 uppercase mb-1.5">{label}</label>
            <div 
                className={`min-h-[42px] border rounded-md bg-white flex items-center justify-between px-2 py-1 cursor-pointer transition-colors ${isOpen ? 'border-em-red ring-1 ring-em-red' : 'border-gray-300 hover:border-gray-400'} ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-70' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex flex-wrap gap-1.5">
                    {selected.length === 0 && (
                        <span className="text-gray-400 text-sm font-medium ml-1">{placeholder}</span>
                    )}
                    {selected.map(sel => (
                        <span key={sel} className="bg-gray-100 text-gray-800 text-[11px] font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-gray-200">
                            {sel}
                            <button onClick={(e) => removeOption(e, sel)} className="hover:text-red-600"><XMarkIcon className="w-3 h-3"/></button>
                        </span>
                    ))}
                </div>
                <div className="shrink-0 ml-2">
                    <ChevronDownIcon className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}/>
                </div>
            </div>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="p-3 text-xs text-gray-500 font-bold text-center italic">No Options Available</div>
                    ) : (
                        options.map(opt => (
                            <div 
                                key={opt} 
                                className={`px-4 py-2 text-sm font-bold cursor-pointer flex items-center justify-between hover:bg-gray-50 ${selected.includes(opt) ? 'text-em-red bg-red-50/50' : 'text-gray-700'}`}
                                onClick={() => toggleOption(opt)}
                            >
                                {opt}
                                {selected.includes(opt) && <CheckIcon className="w-4 h-4 text-em-red"/>}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;
