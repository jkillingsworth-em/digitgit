
import React, { useState } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';

interface TailoredExportModalProps {
    onClose: () => void;
    onExport: (fields: string[]) => void;
}

const TailoredExportModal: React.FC<TailoredExportModalProps> = ({ onClose, onExport }) => {
    const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(['category']));

    const optionalFields = [
        { id: 'category', label: 'Item Category' },
        { id: 'subCategory', label: 'Sub-Category' },
        { id: 'price', label: 'Unit Price' },
        { id: 'usage_2025', label: '2025 Usage Data' },
        { id: 'usage_2024', label: '2024 Usage Data' },
        { id: 'usage_2023', label: '2023 Usage Data' },
        { id: 'usage_2022', label: '2022 Usage Data' },
        { id: 'usage_2021', label: '2021 Usage Data' },
    ];

    const toggleField = (id: string) => {
        const next = new Set(selectedFields);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedFields(next);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-fade-in-down">
                <div className="bg-white p-6 text-black flex justify-between items-center border-b border-gray-100">
                    <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 text-black">
                        <DocumentChartBarIcon className="w-6 h-6 text-em-red" />
                        Smart Export
                    </h2>
                    <button onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6 text-white"/>
                    </button>
                </div>
                
                <div className="p-8">
                    <p className="text-sm text-black font-medium mb-6">
                        Select which optional fields you wish to include in your Smart CSV manifest. ID, Description, Location, and Quantity are always included.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        {optionalFields.map(field => (
                            <button
                                key={field.id}
                                onClick={() => toggleField(field.id)}
                                className={`
                                    p-4 rounded-xl border-2 text-left transition-all
                                    ${selectedFields.has(field.id) 
                                        ? 'bg-red-50 border-em-red text-em-red' 
                                        : 'bg-white border-gray-100 text-gray-700 grayscale'}
                                `}
                            >
                                <div className="text-xs font-black uppercase">{field.label}</div>
                                <div className="text-[9px] font-bold mt-1 opacity-60">
                                    {selectedFields.has(field.id) ? 'INCLUDED' : 'OMITTED'}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="bg-gray-50 p-6 flex justify-end gap-3 border-t border-gray-100">
                    <button onClick={onClose} className="px-6 py-3 text-xs font-black text-gray-700 hover:text-gray-900 uppercase">Cancel</button>
                    <button 
                        onClick={() => onExport(Array.from(selectedFields))}
                        className="px-8 py-3 bg-em-red text-white text-xs font-black rounded-lg shadow-lg hover:bg-red-700 transition-colors uppercase"
                    >
                        Generate Smart CSV
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TailoredExportModal;
