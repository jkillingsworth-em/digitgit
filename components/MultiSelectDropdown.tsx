import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';

interface MultiSelectDropdownProps {
  label: string;
  options?: string[];
  selected?: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  label,
  options = [],
  selected = [],
  onChange,
  disabled = false,
  placeholder = 'Select...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeOptions = useMemo(() => Array.from(new Set(options.filter(Boolean))), [options]);
  const safeSelected = useMemo(() => selected.filter(Boolean), [selected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (!value) return;
    const exists = safeSelected.includes(value);
    const next = exists ? safeSelected.filter(v => v !== value) : [...safeSelected, value];
    onChange(next);
  };

  const removeValue = (value: string) => {
    onChange(safeSelected.filter(v => v !== value));
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-bold text-neutral-600 mb-1.5">{label}</label>

      <button
        type="button"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        className={`w-full border border-neutral-300 rounded-md px-3 py-2 text-left text-sm bg-white flex items-center justify-between ${
 disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-neutral-400'
 }`}
      >
        <span className="truncate font-medium text-neutral-700">
          {safeSelected.length > 0 ? `${safeSelected.length} selected` : placeholder}
        </span>
        <ChevronDownIcon className={`w-4 h-4 text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {safeSelected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {safeSelected.map(value => (
            <span key={value} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs font-bold text-neutral-700 ">
              {value}
              <button type="button" onClick={() => removeValue(value)} className="text-neutral-400 hover:text-red-600">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen && !disabled && (
        <div className="absolute z-40 mt-2 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {safeOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs font-medium text-neutral-500">No options</div>
          ) : (
            safeOptions.map(option => {
              const isChecked = safeSelected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggleValue(option)}
                  className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isChecked ? 'bg-red-50 text-em-red font-bold' : 'text-neutral-700 hover:bg-neutral-50'}`}
                >
                  <input type="checkbox" checked={isChecked} readOnly className="pointer-events-none" />
                  <span className="truncate ">{option}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default MultiSelectDropdown;
