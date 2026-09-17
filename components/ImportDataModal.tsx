import React, { useMemo, useRef, useState } from 'react';
import { InventoryItem, Stock } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import {
  looksLikeEmDigitInventoryCsv,
  mapEmDigitInventoryCsv,
} from '../utils/emDigitInventoryMap';

interface ImportDataModalProps {
  onClose: () => void;
  onImport: (items: InventoryItem[], stock: Stock[]) => Promise<void>;
}

type ImportMode = 'standard' | 'em-digit';

const parseCsvLine = (line: string): string[] => {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
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

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-bold border border-slate-200 mr-1.5 mb-1">
    {children}
  </span>
);

const ImportDataModal: React.FC<ImportDataModalProps> = ({ onClose, onImport }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<ImportMode>('standard');
  const [preview, setPreview] = useState<{ items: number; stock: number; warnings: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const modeHelp = useMemo(() => {
    if (mode === 'em-digit') {
      return {
        required: ['ITEM CODE / ID', 'DESCRIPTION', 'C / K / J / PRODUCTION SHELF (at least one)'],
        optional: ['COLOR', 'CATEGORY (defaults to DIGITS)', '3 YEAR AVG', 'SAGE', 'SAGE AS OF'],
      };
    }
    return {
      required: ['ID', 'DESCRIPTION', 'CATEGORY', 'LOCATION', 'SOURCE'],
      optional: [
        'SUB_CATEGORY',
        'LOW_ALERT_QTY',
        'USAGE_2021-2025',
        'SUB_LOCATION',
        'QTY',
        'PO_NUMBER',
        'DATE_RECEIVED',
      ],
    };
  }, [mode]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] || null;
    setFile(next);
    setError('');
    setPreview(null);
    if (!next) return;

    try {
      const text = await next.text();
      if (looksLikeEmDigitInventoryCsv(text)) {
        setMode('em-digit');
        const mapped = mapEmDigitInventoryCsv(text);
        setPreview({
          items: mapped.items.length,
          stock: mapped.stock.length,
          warnings: mapped.warnings.length,
        });
      } else {
        setMode('standard');
      }
    } catch {
      // Preview is best-effort; import will surface real errors.
    }
  };

  const parseStandardCsv = (csvText: string): { items: InventoryItem[]; stock: Stock[] } => {
    const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) throw new Error('CSV must include a header row and at least one data row.');

    const header = parseCsvLine(lines[0]).map(h => h.trim().toUpperCase());
    const requiredHeaders = ['ID', 'DESCRIPTION', 'CATEGORY', 'LOCATION', 'SOURCE'];
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
      date: header.indexOf('DATE_RECEIVED'),
    };

    const itemsMap = new Map<string, InventoryItem>();
    const stockList: Stock[] = [];
    const errors: string[] = [];
    const seenStockRows = new Set<string>();

    const isValidDate = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsed = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
    };

    for (let i = 1; i < lines.length; i++) {
      const values = parseCsvLine(lines[i]);
      const rowNumber = i + 1;
      if (values.length < 4) {
        errors.push(`Row ${rowNumber}: insufficient columns.`);
        continue;
      }

      const idRaw = values[h.id]?.trim() || '';
      const id = idRaw.toUpperCase();
      if (!id) {
        errors.push(`Row ${rowNumber}: ID is required.`);
        continue;
      }
      if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(id)) {
        errors.push(`Row ${rowNumber}: ID "${idRaw}" contains invalid characters.`);
        continue;
      }

      const description = values[h.desc]?.trim() || '';
      if (!description) {
        errors.push(`Row ${rowNumber}: DESCRIPTION is required for SKU ${id}.`);
        continue;
      }

      const locationRaw = values[h.loc]?.trim() || '';
      const locId = locationRaw.toLowerCase();
      if (!locId) {
        errors.push(`Row ${rowNumber}: LOCATION is required for SKU ${id}.`);
        continue;
      }

      const category = values[h.cat]?.trim() || '';
      if (!category) {
        errors.push(`Row ${rowNumber}: CATEGORY is required for SKU ${id}.`);
        continue;
      }

      const qtyRaw = h.qty !== -1 ? values[h.qty]?.trim() || '' : '';
      const qty = qtyRaw === '' ? 0 : Number(qtyRaw);
      if (!Number.isFinite(qty) || qty < 0) {
        errors.push(`Row ${rowNumber}: QTY must be a non-negative number for SKU ${id}.`);
        continue;
      }

      const sourceRaw = values[h.src]?.trim().toUpperCase() || '';
      if (!sourceRaw) {
        errors.push(`Row ${rowNumber}: SOURCE is required for SKU ${id}.`);
        continue;
      }
      if (sourceRaw !== 'OH' && sourceRaw !== 'PO') {
        errors.push(`Row ${rowNumber}: SOURCE must be OH or PO for SKU ${id}.`);
        continue;
      }
      const sourceVal: 'OH' | 'PO' = sourceRaw === 'PO' ? 'PO' : 'OH';

      const dateReceived = h.date !== -1 ? values[h.date]?.trim() || '' : '';
      if (dateReceived && !isValidDate(dateReceived)) {
        errors.push(`Row ${rowNumber}: DATE_RECEIVED must use YYYY-MM-DD for SKU ${id}.`);
        continue;
      }

      const stockKey = `${id}|${locId}`;
      if (seenStockRows.has(stockKey)) {
        errors.push(`Row ${rowNumber}: duplicate stock row for SKU ${id} at location ${locId}.`);
        continue;
      }
      seenStockRows.add(stockKey);

      if (!itemsMap.has(id)) {
        const priorUsage: { year: number; usage: number }[] = [];
        (
          [
            [2021, h.u21],
            [2022, h.u22],
            [2023, h.u23],
            [2024, h.u24],
            [2025, h.u25],
          ] as const
        ).forEach(([year, colIndex]) => {
          if (colIndex !== -1 && values[colIndex]) {
            const val = Number(values[colIndex]);
            if (!Number.isNaN(val)) priorUsage.push({ year, usage: val });
          }
        });

        itemsMap.set(id, {
          id,
          name: description || id,
          description,
          category,
          subCategory: h.subCat !== -1 ? values[h.subCat]?.trim() : '',
          lowAlertQuantity: h.lowStock !== -1 ? Number(values[h.lowStock]) || 0 : 0,
          priorUsage: priorUsage.length > 0 ? priorUsage : undefined,
        });
      } else {
        const existing = itemsMap.get(id)!;
        if (existing.description !== description) {
          errors.push(`Row ${rowNumber}: conflicting DESCRIPTION for SKU ${id}.`);
          continue;
        }
        if ((existing.category || '') !== category) {
          errors.push(`Row ${rowNumber}: conflicting CATEGORY for SKU ${id}.`);
          continue;
        }
      }

      stockList.push({
        itemId: id,
        locationId: locId,
        quantity: qty,
        subLocationDetail: h.subLoc !== -1 ? values[h.subLoc]?.trim() : '',
        source: sourceVal,
        poNumber: h.po !== -1 ? values[h.po]?.trim() : '',
        dateReceived,
      });
    }

    if (errors.length > 0) {
      const maxErrors = 12;
      const visibleErrors = errors.slice(0, maxErrors).join('\n');
      const remaining = errors.length - maxErrors;
      throw new Error(
        `CSV validation failed:\n${visibleErrors}${remaining > 0 ? `\n...and ${remaining} more issue(s).` : ''}`,
      );
    }

    return { items: Array.from(itemsMap.values()), stock: stockList };
  };

  const handleImportClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsProcessing(true);
    setError('');

    try {
      const text = await file.text();
      if (!text.trim()) throw new Error('The selected file is empty.');

      let items: InventoryItem[] = [];
      let stock: Stock[] = [];

      if (mode === 'em-digit') {
        const mapped = mapEmDigitInventoryCsv(text);
        items = mapped.items;
        stock = mapped.stock;
        setPreview({
          items: mapped.items.length,
          stock: mapped.stock.length,
          warnings: mapped.warnings.length,
        });
      } else {
        const parsed = parseStandardCsv(text);
        items = parsed.items;
        stock = parsed.stock;
      }

      if (items.length === 0) throw new Error('No valid data rows found in CSV.');
      await onImport(items, stock);
    } catch (err: any) {
      console.error('Import Error:', err);
      setError(err?.message || 'An error occurred during import.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 font-sans">
      <div className="bg-white w-full max-w-lg rounded-lg shadow-xl overflow-hidden animate-fade-in-down">
        <div className="border-b border-gray-200 px-6 py-4 flex justify-between items-center bg-white">
          <h2 className="font-bold uppercase tracking-wide text-lg text-slate-800">IMPORT FROM CSV</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <p className="text-[15px] text-slate-600 leading-relaxed">
            Select a CSV file to import inventory data. Data is merged into your existing inventory.
          </p>

          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`flex-1 px-3 py-2 text-xs font-black uppercase tracking-wide ${
                mode === 'standard' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'
              }`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setMode('em-digit')}
              className={`flex-1 px-3 py-2 text-xs font-black uppercase tracking-wide ${
                mode === 'em-digit' ? 'bg-em-red text-white' : 'bg-white text-slate-600'
              }`}
            >
              EM Digit Inventory
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <span className="text-[13px] font-bold text-slate-800 mr-2">Required:</span>
              {modeHelp.required.map(label => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
            <div className="leading-relaxed">
              <span className="text-[13px] font-bold text-slate-800 mr-2">Optional:</span>
              {modeHelp.optional.map(label => (
                <Badge key={label}>{label}</Badge>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-[12px] font-black text-slate-500 uppercase tracking-widest mb-2">
              CSV FILE
            </label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept=".csv,text/csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-em-red text-white px-6 py-2.5 rounded-md font-black text-sm uppercase tracking-wide shadow-sm hover:bg-red-700 transition-colors shrink-0"
              >
                Choose File
              </button>
              <span className="text-sm font-bold text-slate-700 truncate">
                {file ? file.name : 'NO FILE CHOSEN'}
              </span>
            </div>
          </div>

          {preview && mode === 'em-digit' && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs font-bold space-y-1">
              <div>
                Preview: {preview.items} items · {preview.stock} stock rows
              </div>
              {preview.warnings > 0 && (
                <div className="text-amber-700">{preview.warnings} warning(s) during map</div>
              )}
              <div className="font-medium text-slate-500">
                Warehouses map to wh-c / wh-k / wh-j / prod. Missing category defaults to DIGITS.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs font-bold whitespace-pre-wrap">
              {error}
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={!file || isProcessing}
            className={`px-6 py-2.5 text-sm font-bold text-white rounded-md shadow-sm transition-colors ${
              !file || isProcessing ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900'
            }`}
          >
            {isProcessing ? 'Processing...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportDataModal;
