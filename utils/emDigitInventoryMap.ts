import { InventoryItem, Location, Stock } from '../types';

/** Default Electro-Mech digit locations — ids match App DEFAULT_LOCATIONS. */
export const DEFAULT_EM_LOCATIONS: Location[] = [
  { id: 'wh-c', name: 'WH-C' },
  { id: 'wh-k', name: 'WH-K' },
  { id: 'wh-j', name: 'WH-J', subLocationPrompt: 'SHELF or RACK' },
  { id: 'prod', name: 'PROD', subLocationPrompt: 'SHELF, OFFICE, or ROOM' },
];

export const EM_LOCATION_COLUMN_MAP: { headers: string[]; locationId: string }[] = [
  { headers: ['C WAREHOUSE', 'C_WAREHOUSE', 'WH-C', 'WH_C', 'C'], locationId: 'wh-c' },
  { headers: ['K WAREHOUSE', 'K_WAREHOUSE', 'WH-K', 'WH_K', 'K'], locationId: 'wh-k' },
  { headers: ['J WAREHOUSE', 'J_WAREHOUSE', 'WH-J', 'WH_J', 'J'], locationId: 'wh-j' },
  {
    headers: ['PRODUCTION SHELF', 'PRODUCTION_SHELF', 'PROD', 'PROD SHELF', 'PROD_SHELF'],
    locationId: 'prod',
  },
];

export interface EmDigitMapResult {
  items: InventoryItem[];
  stock: Stock[];
  locationIdsUsed: string[];
  skippedRows: number;
  warnings: string[];
}

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/"/g, '')
    .replace(/\s+/g, ' ');

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

const findHeaderIndex = (header: string[], candidates: string[]): number => {
  for (const candidate of candidates) {
    const idx = header.indexOf(normalizeHeader(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
};

const parseQty = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (cleaned === '') return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

/**
 * Map an EM Digit Inventory sheet CSV export into digitgit inventory + stock rows.
 * Wide warehouse columns (C/K/J/Production Shelf) become separate stock records.
 */
export const mapEmDigitInventoryCsv = (csvText: string): EmDigitMapResult => {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const header = parseCsvLine(lines[0]).map(normalizeHeader);

  const idIdx = findHeaderIndex(header, [
    'ITEM CODE',
    'ITEM_CODE',
    'PRODUCT ID',
    'PRODUCT_ID',
    'PRODUCTID',
    'ID',
    'SKU',
  ]);
  const descIdx = findHeaderIndex(header, ['DESCRIPTION', 'DESC', 'NAME', 'ITEM NAME']);
  const colorIdx = findHeaderIndex(header, ['COLOR', 'COLOUR']);
  const categoryIdx = findHeaderIndex(header, ['CATEGORY', 'CAT']);
  const threeYearIdx = findHeaderIndex(header, [
    '3 YEAR AVG',
    '3_YEAR_AVG',
    'THREE YEAR AVG',
    'THREE_YEAR_AVG',
    '3YR AVG',
    '3YR_AVG',
  ]);
  const sageIdx = findHeaderIndex(header, ['SAGE', 'SAGE QTY', 'SAGE_QTY', 'SAGE QUANTITY']);
  const sageAsOfIdx = findHeaderIndex(header, ['SAGE AS OF', 'SAGE_AS_OF', 'SAGE DATE', 'SAGE_DATE']);

  if (idIdx === -1) {
    throw new Error('EM Digit Inventory CSV requires an Item Code / Product ID / ID column.');
  }
  if (descIdx === -1) {
    throw new Error('EM Digit Inventory CSV requires a Description column.');
  }

  const warehouseCols = EM_LOCATION_COLUMN_MAP.map(entry => ({
    locationId: entry.locationId,
    index: findHeaderIndex(header, entry.headers),
  })).filter(col => col.index !== -1);

  if (warehouseCols.length === 0) {
    throw new Error(
      'EM Digit Inventory CSV needs at least one warehouse column (C / K / J / Production Shelf).',
    );
  }

  const itemsMap = new Map<string, InventoryItem>();
  const stockList: Stock[] = [];
  const seenStock = new Set<string>();
  const locationIdsUsed = new Set<string>();
  const warnings: string[] = [];
  let skippedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const rowNumber = i + 1;
    const idRaw = (values[idIdx] || '').trim();
    const id = idRaw.toUpperCase();
    if (!id) {
      skippedRows += 1;
      continue;
    }
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(id)) {
      warnings.push(`Row ${rowNumber}: skipped invalid ID "${idRaw}".`);
      skippedRows += 1;
      continue;
    }

    const description = (values[descIdx] || '').trim();
    if (!description) {
      warnings.push(`Row ${rowNumber}: skipped ${id} (missing description).`);
      skippedRows += 1;
      continue;
    }

    const color = colorIdx !== -1 ? (values[colorIdx] || '').trim() : '';
    const categoryRaw = categoryIdx !== -1 ? (values[categoryIdx] || '').trim() : '';
    const category = (categoryRaw || 'DIGITS').toUpperCase();
    const threeYearAvg =
      threeYearIdx !== -1 ? parseQty(values[threeYearIdx]) ?? undefined : undefined;
    const sageQty = sageIdx !== -1 ? parseQty(values[sageIdx]) ?? undefined : undefined;
    const sageAsOf = sageAsOfIdx !== -1 ? (values[sageAsOfIdx] || '').trim() || undefined : undefined;

    if (!itemsMap.has(id)) {
      itemsMap.set(id, {
        id,
        name: description,
        description: color ? `${description} (${color})` : description,
        category,
        color: color || undefined,
        threeYearAvg,
        sageQty,
        sageAsOf,
      });
    }

    for (const col of warehouseCols) {
      const qty = parseQty(values[col.index]);
      if (qty === null) {
        warnings.push(`Row ${rowNumber}: invalid qty for ${id} at ${col.locationId}.`);
        continue;
      }
      if (qty === 0) continue;

      const stockKey = `${id}|${col.locationId}`;
      if (seenStock.has(stockKey)) {
        warnings.push(`Row ${rowNumber}: duplicate stock for ${id} at ${col.locationId}.`);
        continue;
      }
      seenStock.add(stockKey);
      locationIdsUsed.add(col.locationId);
      stockList.push({
        itemId: id,
        locationId: col.locationId,
        quantity: qty,
        source: 'OH',
      });
    }
  }

  if (itemsMap.size === 0) {
    throw new Error('No valid EM Digit Inventory rows found in CSV.');
  }

  return {
    items: Array.from(itemsMap.values()),
    stock: stockList,
    locationIdsUsed: Array.from(locationIdsUsed),
    skippedRows,
    warnings,
  };
};

/** Detect whether a CSV looks like an EM Digit Inventory export. */
export const looksLikeEmDigitInventoryCsv = (csvText: string): boolean => {
  const firstLine = csvText.split(/\r\n|\n/).find(line => line.trim() !== '') || '';
  const header = parseCsvLine(firstLine).map(normalizeHeader);
  const hasId = findHeaderIndex(header, ['ITEM CODE', 'PRODUCT ID', 'PRODUCT_ID', 'ID', 'SKU']) !== -1;
  const hasWarehouse = EM_LOCATION_COLUMN_MAP.some(
    entry => findHeaderIndex(header, entry.headers) !== -1,
  );
  return hasId && hasWarehouse;
};
