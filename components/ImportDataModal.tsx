import React, { useState, useRef } from 'react';
import { InventoryItem, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';

interface ImportDataModalProps {
    onClose: () => void;
    onImport: (items: InventoryItem[], stock: Stock[]) => Promise<void>;
}

const parseCsvLine = (line: string): string[] => {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') { // Escaped quote ("")
                current += '"';
                i++; // Skip the next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current);
    return values;
};

const ImportDataModal: React.FC<ImportDataModalProps> = ({ onClose, onImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleImport = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!file) return;

        setIsProcessing(true);
        setError('');

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target?.result as string;
                if (!text) throw new Error("The selected file is empty.");

                const { items, stock } = parseCSV(text);
                
                if (items.length === 0) throw new Error("No valid data rows found in CSV.");

                await onImport(items, stock);
            } catch (err: any) {
                console.error("Import Error:", err);
                setError(err.message || "An error occurred during import.");
                setIsProcessing(false);
            }
        };

        reader.onerror = () => {
            setError('Failed to read the local file.');
            setIsProcessing(false);
        };

        reader.readAsText(file);
    };

    const parseCSV = (csvText: string): { items: InventoryItem[], stock: Stock[] } => {
        const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) throw new Error("CSV must include a header row and at least one data row.");
        
        const header = parseCsvLine(lines[0]).map(h => h.trim().toUpperCase());
        
        const requiredHeaders = ['ID', 'DESCRIPTION', 'LOCATION', 'QTY'];
        const missing = requiredHeaders.filter(rh => !header.includes(rh));
        if (missing.length > 0) {
            throw new Error(`Missing required columns: ${missing.join(', ')}`);
        }
        
        const h = {
            id: header.indexOf('ID'),
            desc: header.indexOf('DESCRIPTION'),
            loc: header.indexOf('LOCATION'),
            qty: header.indexOf('QTY'),
            cat: header.indexOf('CATEGORY'),
            subCat: header.indexOf('SUB_CATEGORY'),
            lowStock: header.indexOf('LOW_ALERT_QTY'),
            u21: header.indexOf('USAGE_2021'),
            u22: header.indexOf('USAGE_2022'),
            u23: header.indexOf('USAGE_2023'),
            u24: header.indexOf('USAGE_2024'),
            u25: header.indexOf('USAGE_2025'),
            subLoc: header.indexOf('SUB_LOCATION'),
            src: header.indexOf('SOURCE'),
            po: header.indexOf('PO_NUMBER'),
            date: header.indexOf('DATE_RECEIVED')
        };

        const itemsMap = new Map<string, InventoryItem>();
        const stockList: Stock[] = [];

        for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]);
            if (values.length < 4) continue;

            const id = values[h.id]?.trim().toUpperCase();
            if (!id) continue;

            if (!itemsMap.has(id)) {
                // Parse usage history if columns exist
                const priorUsage: { year: number; usage: number }[] = [];
                [2021, 2022, 2023, 2024, 2025].forEach(year => {
                    const colIndex = h[`u${year % 100}` as keyof typeof h];
                    if (colIndex !== -1 && values[colIndex]) {
                        const val = Number(values[colIndex]);
                        if (!isNaN(val)) priorUsage.push({ year, usage: val });
                    }
                });

                itemsMap.set(id, {
                    id,
                    name: values[h.desc]?.trim() || id,
                    description: values[h.desc]?.trim() || "",
                    category: h.cat !== -1 ? values[h.cat]?.trim() : "",
                    subCategory: h.subCat !== -1 ? values[h.subCat]?.trim() : "",
                    lowAlertQuantity: h.lowStock !== -1 ? Number(values[h.lowStock]) || 0 : 0,
                    priorUsage: priorUsage.length > 0 ? priorUsage : undefined
                });
            }

            const qty = Number(values[h.qty]) || 0;
            const locId = values[h.loc]?.trim().toLowerCase() || "unknown";
            const sourceVal = h.src !== -1 ? (values[h.src]?.trim().toUpperCase() === 'PO' ? 'PO' : 'OH') : 'OH';

            stockList.push({
                itemId: id,
                locationId: locId,
                quantity: qty,
                subLocationDetail: h.subLoc !== -1 ? values[h.subLoc]?.trim() : "",
                source: sourceVal as 'OH' | 'PO',
                poNumber: h.po !== -1 ? values[h.po]?.trim() : "",
                dateReceived: h.date !== -1 ? values[h.date]?.trim() : ""
            });
        }
        
        return { items: Array.from(itemsMap.values()), stock: stockList };
    };

    const Badge = ({ children }: { children: string }) => (
        <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200 mr-1.5 mb-1">
            {children}
        </span>
    );

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 font-sans">
            <div className="bg-white w-full max-w-lg rounded-lg shadow-xl overflow-hidden animate-fade-in-down">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-white">
                    <h2 className="font-bold uppercase tracking-wide text-lg text-slate-800">IMPORT FROM CSV</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Body */}
                <div className="p-8 space-y-6">
                    <p className="text-[15px] text-slate-600 leading-relaxed">
                        Select a CSV file to import inventory data. The data will be added to your existing inventory.
                    </p>

                    <div className="space-y-4">
                        <div>
                            <span className="text-[13px] font-bold text-slate-800 mr-2">Required columns:</span>
                            <Badge>ID</Badge>
                            <Badge>DESCRIPTION</Badge>
                            <Badge>LOCATION</Badge>
                            <Badge>QTY</Badge>
                        </div>

                        <div className="leading-relaxed">
                            <span className="text-[13px] font-bold text-slate-800 mr-2">Optional columns:</span>
                            <Badge>CATEGORY</Badge>
                            <Badge>SUB_CATEGORY</Badge>
                            <Badge>LOW_ALERT_QTY</Badge>
                            <Badge>USAGE_2021</Badge>
                            <Badge>USAGE_2022</Badge>
                            <Badge>USAGE_2023</Badge>
                            <Badge>USAGE_2024</Badge>
                            <Badge>USAGE_2025</Badge>
                            <Badge>SUB_LOCATION</Badge>
                            <Badge>SOURCE</Badge>
                            <Badge>PO_NUMBER</Badge>
                            <Badge>DATE_RECEIVED</Badge>
                        </div>
                    </div>

                    <div className="pt-4">
                        <label className="block text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2">CSV FILE</label>
                        <div className="flex items-center gap-4">
                            <input 
                                type="file" 
                                accept=".csv" 
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <button 
                                onClick={triggerFileInput}
                                className="bg-em-red text-white px-6 py-2.5 rounded-md font-black text-sm uppercase tracking-wide shadow-sm hover:bg-red-700 transition-colors shrink-0"
                            >
                                Choose File
                            </button>
                            <span className="text-sm font-bold text-slate-700 truncate">
                                {file ? file.name : "NO FILE CHOSEN"}
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-bold">
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleImport}
                        disabled={!file || isProcessing}
                        className={`px-6 py-2.5 text-sm font-bold text-white rounded-md shadow-sm transition-colors
                            ${!file || isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'}
                        `}
                    >
                        {isProcessing ? 'Processing...' : 'Import Data'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportDataModal;