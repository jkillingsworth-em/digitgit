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

const ITEM_CODE_HEADERS = [
  'ITEM CODE',
  'ITEM_CODE',
  'PRODUCT ID',
  'PRODUCT_ID',
  'PRODUCTID',
  'ID',
  'SKU',
];

const DESC_HEADERS = ['DESCRIPTION', 'DESC', 'NAME', 'ITEM NAME'];
const COLOR_HEADERS = ['COLOR', 'COLOUR'];
const CATEGORY_HEADERS = ['CATEGORY', 'CAT'];
const THREE_YEAR_HEADERS = [
  '3 YEAR AVG',
  '3_YEAR_AVG',
  'THREE YEAR AVG',
  'THREE_YEAR_AVG',
  '3YR AVG',
  '3YR_AVG',
];
const SAGE_EXACT_HEADERS = ['SAGE', 'SAGE QTY', 'SAGE_QTY', 'SAGE QUANTITY'];
const SAGE_AS_OF_HEADERS = ['SAGE AS OF', 'SAGE_AS_OF', 'SAGE DATE', 'SAGE_DATE'];

export interface EmDigitMapResult {
  items: InventoryItem[];
  stock: Stock[];
  locationIdsUsed: string[];
  skippedRows: number;
  warnings: string[];
  /** 0-based index of the header row within the source grid/CSV lines */
  headerRowIndex: number;
  /** Column indexes resolved from the header row */
  columns: EmDigitColumnLayout;
}

export interface EmDigitColumnLayout {
  idIdx: number;
  descIdx: number;
  colorIdx: number;
  categoryIdx: number;
  threeYearIdx: number;
  sageIdx: number;
  sageAsOfIdx: number;
  warehouseCols: { locationId: string; index: number }[];
  /** As-of date inferred from a dated SAGE header (e.g. "SAGE 06/19/2026") */
  sageAsOfFromHeader?: string;
}

export interface EmDigitPushCellUpdate {
  /** A1 range like `D5` or `'Sheet1'!D5` */
  range: string;
  value: number;
  itemId: string;
  locationId: string;
}

export interface EmDigitPushBuildResult {
  updates: EmDigitPushCellUpdate[];
  matchedItems: number;
  unmatchedItemIds: string[];
  warnings: string[];
}

export const normalizeHeader = (value: string) =>
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

export const findHeaderIndex = (header: string[], candidates: string[]): number => {
  for (const candidate of candidates) {
    const idx = header.indexOf(normalizeHeader(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
};

/** Match SAGE / SAGE QTY / "SAGE 06/19/2026" style headers. */
export const findSageHeaderIndex = (header: string[]): number => {
  const exact = findHeaderIndex(header, SAGE_EXACT_HEADERS);
  if (exact !== -1) return exact;
  return header.findIndex(h => h === 'SAGE' || h.startsWith('SAGE '));
};

/** Convert MM/DD/YYYY (or M/D/YY) embedded in a SAGE header into YYYY-MM-DD when possible. */
export const extractSageAsOfFromHeader = (rawHeader: string): string | undefined => {
  const normalized = normalizeHeader(rawHeader);
  const match = normalized.match(/^SAGE\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) {
    const loose = normalized.match(/SAGE.*?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!loose) return undefined;
    return formatUsDate(loose[1], loose[2], loose[3]) || loose[0];
  }
  return formatUsDate(match[1], match[2], match[3]);
};

const formatUsDate = (mm: string, dd: string, yyOrYyyy: string): string | undefined => {
  const month = Number(mm);
  const day = Number(dd);
  let year = Number(yyOrYyyy);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return undefined;
  if (yyOrYyyy.length <= 2) year += year >= 70 ? 1900 : 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return undefined;
  return iso;
};

const parseQty = (raw: string | undefined): number | null => {
  if (raw === undefined) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  if (cleaned === '') return 0;
  if (/^n\/?a$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

const cell = (row: string[], idx: number): string => {
  if (idx < 0 || idx >= row.length) return '';
  return String(row[idx] ?? '');
};

/** Locate the header row in a 2D grid (skips title/banner rows). */
export const findEmDigitHeaderRowIndex = (rows: string[][]): number => {
  const scanLimit = Math.min(rows.length, 30);
  for (let i = 0; i < scanLimit; i++) {
    const header = (rows[i] || []).map(v => normalizeHeader(String(v ?? '')));
    if (findHeaderIndex(header, ITEM_CODE_HEADERS) !== -1) {
      return i;
    }
  }
  return -1;
};

export const resolveEmDigitColumns = (headerRow: string[]): EmDigitColumnLayout => {
  const header = headerRow.map(v => normalizeHeader(String(v ?? '')));
  const idIdx = findHeaderIndex(header, ITEM_CODE_HEADERS);
  const descIdx = findHeaderIndex(header, DESC_HEADERS);
  const colorIdx = findHeaderIndex(header, COLOR_HEADERS);
  const categoryIdx = findHeaderIndex(header, CATEGORY_HEADERS);
  const threeYearIdx = findHeaderIndex(header, THREE_YEAR_HEADERS);
  const sageIdx = findSageHeaderIndex(header);
  const sageAsOfIdx = findHeaderIndex(header, SAGE_AS_OF_HEADERS);
  const warehouseCols = EM_LOCATION_COLUMN_MAP.map(entry => ({
    locationId: entry.locationId,
    index: findHeaderIndex(header, entry.headers),
  })).filter(col => col.index !== -1);

  const sageAsOfFromHeader =
    sageIdx !== -1 && sageAsOfIdx === -1 ? extractSageAsOfFromHeader(header[sageIdx] || '') : undefined;

  return {
    idIdx,
    descIdx,
    colorIdx,
    categoryIdx,
    threeYearIdx,
    sageIdx,
    sageAsOfIdx,
    warehouseCols,
    sageAsOfFromHeader,
  };
};

const assertRequiredColumns = (columns: EmDigitColumnLayout): void => {
  if (columns.idIdx === -1) {
    throw new Error('EM Digit Inventory requires an Item Code / Product ID / ID column.');
  }
  if (columns.descIdx === -1) {
    throw new Error('EM Digit Inventory requires a Description column.');
  }
  if (columns.warehouseCols.length === 0) {
    throw new Error(
      'EM Digit Inventory needs at least one warehouse column (C / K / J / Production Shelf).',
    );
  }
};

/**
 * Map a 2D values grid (Sheets API or parsed CSV) into digitgit inventory + stock rows.
 * Wide warehouse columns (C/K/J/Production Shelf) become separate stock records.
 */
export const mapEmDigitInventoryGrid = (rows: string[][]): EmDigitMapResult => {
  if (!rows.length) {
    throw new Error('Sheet/CSV must include a header row and at least one data row.');
  }

  const headerRowIndex = findEmDigitHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new Error('Could not find an EM Digit Inventory header row (ITEM CODE / ID).');
  }

  const columns = resolveEmDigitColumns(rows[headerRowIndex] || []);
  assertRequiredColumns(columns);

  const itemsMap = new Map<string, InventoryItem>();
  const stockList: Stock[] = [];
  const seenStock = new Set<string>();
  const locationIdsUsed = new Set<string>();
  const warnings: string[] = [];
  let skippedRows = 0;

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const values = (rows[i] || []).map(v => String(v ?? ''));
    const rowNumber = i + 1;
    const idRaw = cell(values, columns.idIdx).trim();
    const id = idRaw.toUpperCase();
    if (!id) {
      skippedRows += 1;
      continue;
    }
    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(id)) {
      // Section banners like "OUTDOOR HANDMADE" land here
      warnings.push(`Row ${rowNumber}: skipped invalid ID "${idRaw}".`);
      skippedRows += 1;
      continue;
    }

    const description = cell(values, columns.descIdx).trim();
    if (!description) {
      warnings.push(`Row ${rowNumber}: skipped ${id} (missing description).`);
      skippedRows += 1;
      continue;
    }

    const color = columns.colorIdx !== -1 ? cell(values, columns.colorIdx).trim() : '';
    const categoryRaw = columns.categoryIdx !== -1 ? cell(values, columns.categoryIdx).trim() : '';
    const category = (categoryRaw || 'DIGITS').toUpperCase();
    const threeYearAvg =
      columns.threeYearIdx !== -1 ? parseQty(cell(values, columns.threeYearIdx)) ?? undefined : undefined;
    const sageQty = columns.sageIdx !== -1 ? parseQty(cell(values, columns.sageIdx)) ?? undefined : undefined;
    let sageAsOf =
      columns.sageAsOfIdx !== -1
        ? cell(values, columns.sageAsOfIdx).trim() || undefined
        : undefined;
    if (!sageAsOf && columns.sageAsOfFromHeader) {
      sageAsOf = columns.sageAsOfFromHeader;
    }

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

    for (const col of columns.warehouseCols) {
      const qty = parseQty(cell(values, col.index));
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
    throw new Error('No valid EM Digit Inventory rows found.');
  }

  return {
    items: Array.from(itemsMap.values()),
    stock: stockList,
    locationIdsUsed: Array.from(locationIdsUsed),
    skippedRows,
    warnings,
    headerRowIndex,
    columns,
  };
};

/**
 * Map an EM Digit Inventory sheet CSV export into digitgit inventory + stock rows.
 */
export const mapEmDigitInventoryCsv = (csvText: string): EmDigitMapResult => {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }
  const rows = lines.map(parseCsvLine);
  return mapEmDigitInventoryGrid(rows);
};

/** Detect whether a CSV looks like an EM Digit Inventory export. */
export const looksLikeEmDigitInventoryCsv = (csvText: string): boolean => {
  const lines = csvText
    .split(/\r\n|\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 15);
  for (const line of lines) {
    const header = parseCsvLine(line).map(normalizeHeader);
    const hasId = findHeaderIndex(header, ITEM_CODE_HEADERS) !== -1;
    const hasWarehouse = EM_LOCATION_COLUMN_MAP.some(
      entry => findHeaderIndex(header, entry.headers) !== -1,
    );
    if (hasId && hasWarehouse) return true;
  }
  return false;
};

const columnIndexToA1 = (colIndex: number): string => {
  let n = colIndex + 1;
  let label = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
};

/**
 * Build Sheets API cell updates that write floor stock into warehouse columns.
 * Matches sheet rows by item code; only updates C/K/J/Production Shelf cells.
 */
export const buildEmDigitWarehousePushUpdates = (
  rows: string[][],
  items: InventoryItem[],
  stock: Stock[],
  options?: { sheetName?: string },
): EmDigitPushBuildResult => {
  const headerRowIndex = findEmDigitHeaderRowIndex(rows);
  if (headerRowIndex === -1) {
    throw new Error('Could not find an EM Digit Inventory header row for push.');
  }
  const columns = resolveEmDigitColumns(rows[headerRowIndex] || []);
  if (columns.idIdx === -1) {
    throw new Error('Push requires an Item Code column.');
  }
  if (columns.warehouseCols.length === 0) {
    throw new Error('Push requires at least one warehouse column (C / K / J / Production Shelf).');
  }

  const rowByItemId = new Map<string, number>();
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const id = cell(rows[i] || [], columns.idIdx).trim().toUpperCase();
    if (!id || !/^[A-Z0-9][A-Z0-9._-]*$/.test(id)) continue;
    if (!rowByItemId.has(id)) rowByItemId.set(id, i);
  }

  const qtyByItemLoc = new Map<string, number>();
  for (const s of stock) {
    const itemId = (s.itemId || '').toUpperCase().trim();
    const locationId = (s.locationId || '').toLowerCase().trim();
    if (!itemId || !locationId) continue;
    const key = `${itemId}|${locationId}`;
    qtyByItemLoc.set(key, (qtyByItemLoc.get(key) || 0) + Number(s.quantity || 0));
  }

  const sheetPrefix = options?.sheetName ? `'${options.sheetName.replace(/'/g, "''")}'!` : '';
  const updates: EmDigitPushCellUpdate[] = [];
  const unmatchedItemIds: string[] = [];
  const warnings: string[] = [];
  let matchedItems = 0;

  const targetLocationIds = new Set(columns.warehouseCols.map(c => c.locationId));

  for (const item of items) {
    const itemId = (item.id || '').toUpperCase().trim();
    if (!itemId) continue;
    const rowIdx = rowByItemId.get(itemId);
    if (rowIdx === undefined) {
      unmatchedItemIds.push(itemId);
      continue;
    }
    matchedItems += 1;
    const sheetRow = rowIdx + 1; // 1-based A1
    for (const col of columns.warehouseCols) {
      if (!targetLocationIds.has(col.locationId)) continue;
      const qty = qtyByItemLoc.get(`${itemId}|${col.locationId}`) || 0;
      const a1Col = columnIndexToA1(col.index);
      updates.push({
        range: `${sheetPrefix}${a1Col}${sheetRow}`,
        value: qty,
        itemId,
        locationId: col.locationId,
      });
    }
  }

  if (unmatchedItemIds.length > 0) {
    warnings.push(
      `${unmatchedItemIds.length} Firebase item(s) not found in sheet (skipped push for those SKUs).`,
    );
  }

  return { updates, matchedItems, unmatchedItemIds, warnings };
};
