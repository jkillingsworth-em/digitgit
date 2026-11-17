import { strFromU8, unzipSync } from 'fflate';

/** One part from a Sage inventory export. */
export interface SageLine {
  itemId: string;
  description: string;
  qtyOnHand: number;
  /** null when the report has no Qty On PO column. */
  qtyOnPO: number | null;
  /** Full Sage bin codes, e.g. J-LOFT-2, R2-SH-H, C3-DEFAULT. */
  bins: string[];
}

export interface SageParseResult {
  lines: SageLine[];
  warnings: string[];
}

/** A Sage bin code split into the building/area prefix and the bin inside it. */
export interface SageBin {
  code: string;
  /** Building or area, e.g. J, C3, R2, OTHER. */
  prefix: string;
  /** Bin inside it, e.g. LOFT-2 or SH-H. Empty for DEFAULT/OTHER ("anywhere in the warehouse"). */
  subLocation: string;
}

/* ---------- Reading files ---------- */

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml: string) => {
  const parts: string[] = [];
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) parts.push(decodeXml(match[1]));
  return parts.join('');
};

const columnIndex = (ref: string) => {
  const letters = ref.replace(/[^A-Z]/gi, '').toUpperCase();
  let index = 0;
  for (const letter of letters) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
};

/** Reads the first worksheet of an .xlsx file into rows of cell text. */
export function readXlsxRows(data: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(data);
  } catch {
    throw new Error('This file could not be opened as an Excel workbook. Save it as .xlsx or .csv and try again.');
  }
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : '');

  const shared: string[] = [];
  const sharedXml = read('xl/sharedStrings.xml');
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let si: RegExpExecArray | null;
  while ((si = siRe.exec(sharedXml))) shared.push(textOf(si[1]));

  // First sheet in workbook order.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const firstSheetRel = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(read('xl/workbook.xml'))?.[1];
  if (firstSheetRel) {
    const rels = read('xl/_rels/workbook.xml.rels');
    const relRe = /<Relationship\b[^>]*>/g;
    let rel: RegExpExecArray | null;
    while ((rel = relRe.exec(rels))) {
      if (rel[0].includes(`Id="${firstSheetRel}"`)) {
        const target = /Target="([^"]+)"/.exec(rel[0])?.[1];
        if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      }
    }
  }
  const sheetXml = read(sheetPath);
  if (!sheetXml) throw new Error('The workbook has no readable worksheet.');

  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(sheetXml))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cell: RegExpExecArray | null;
    let next = 0;
    while ((cell = cellRe.exec(row[1]))) {
      const attrs = cell[1];
      const body = cell[2] || '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : next;
      next = index + 1;
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (raw !== undefined) value = decodeXml(raw);
      cells[index] = value;
    }
    rows.push(Array.from(cells, value => value ?? ''));
  }
  return rows;
}

/** Splits CSV text into rows, handling quoted fields. */
export function readCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/* ---------- Understanding the Sage export ---------- */

const normalizeHeader = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const toNumber = (value: string | undefined) => {
  const cleaned = (value ?? '').replace(/[,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (cleaned === '') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

/** Finds the Sage columns (Item Code, Qty On Hand, Qty On PO, Bin Location, UDF BIN 2-5) and reads each part. */
export function parseSageRows(rows: string[][]): SageParseResult {
  const warnings: string[] = [];
  const headerIndex = rows.findIndex(cells => {
    const headers = cells.map(normalizeHeader);
    return headers.includes('ITEMCODE') && headers.some(h => h.startsWith('QTYONHAND') || h === 'ONHAND');
  });
  if (headerIndex === -1) {
    throw new Error('Could not find the "Item Code" and "Qty On Hand" columns. Is this the Sage inventory export?');
  }
  const headers = rows[headerIndex].map(normalizeHeader);
  const find = (...names: string[]) => headers.findIndex(h => names.includes(h));
  const idCol = find('ITEMCODE');
  const descCol = find('ITEMCODEDESCRIPTION', 'DESCRIPTION', 'ITEMDESCRIPTION');
  const onHandCol = headers.findIndex(h => h.startsWith('QTYONHAND') || h === 'ONHAND');
  const onPoCol = headers.findIndex(h => h.startsWith('QTYONPO') || h === 'ONPO' || h.startsWith('QTYONPURCHASEORDER'));
  const binCols = headers.map((h, i) => (h.includes('BIN') ? i : -1)).filter(i => i >= 0);

  const byId = new Map<string, SageLine>();
  rows.slice(headerIndex + 1).forEach((cells, offset) => {
    const itemId = (cells[idCol] ?? '').trim().toUpperCase();
    if (!itemId) return;
    const rowNumber = headerIndex + offset + 2;
    const qtyOnHand = toNumber(cells[onHandCol]);
    const qtyOnPO = onPoCol >= 0 ? toNumber(cells[onPoCol]) : null;
    if (Number.isNaN(qtyOnHand) || (qtyOnPO !== null && Number.isNaN(qtyOnPO))) {
      warnings.push(`Row ${rowNumber} (${itemId}): quantity is not a number, so it was skipped.`);
      return;
    }
    const bins = Array.from(new Set(binCols.map(i => (cells[i] ?? '').trim().toUpperCase()).filter(Boolean)));
    if (byId.has(itemId)) warnings.push(`${itemId} appears more than once; the last row was used.`);
    byId.set(itemId, {
      itemId,
      description: descCol >= 0 ? (cells[descCol] ?? '').trim() : '',
      qtyOnHand,
      qtyOnPO,
      bins,
    });
  });
  if (byId.size === 0) warnings.push('No parts were found under the header row.');
  return { lines: Array.from(byId.values()), warnings };
}

/** Reads a Sage export file (.xlsx or .csv). */
export function parseSageFile(fileName: string, data: Uint8Array): SageParseResult {
  const isCsv = /\.csv$/i.test(fileName) || /\.txt$/i.test(fileName);
  const rows = isCsv ? readCsvRows(new TextDecoder().decode(data)) : readXlsxRows(data);
  return parseSageRows(rows);
}

/* ---------- Bins and locations ---------- */

/**
 * Electro-Mech's main locations, from the facility floor plan. Sage bin codes start with the
 * building letter (the first letter of its code name):
 *   Sections  A Athens (offices), B Boston, C Chicago, D Detroit
 *   Warehouses I Islamabad (1), J Jerusalem (2), K Kyoto (3), L Liverpool (4)
 * A letter followed by a number is an area or room inside a section: B7 = Area B7 in Section B,
 * R3 = Room 3 and S1 = Storage Room 1, both in Section A.
 */
export const SAGE_MAIN_LOCATIONS: { letter: string; name: string }[] = [
  { letter: 'A', name: 'SECTION A' },
  { letter: 'B', name: 'SECTION B' },
  { letter: 'C', name: 'SECTION C' },
  { letter: 'D', name: 'SECTION D' },
  { letter: 'I', name: 'WAREHOUSE I' },
  { letter: 'J', name: 'WAREHOUSE J' },
  { letter: 'K', name: 'WAREHOUSE K' },
  { letter: 'L', name: 'WAREHOUSE L' },
];
const MAIN_BY_LETTER = new Map(SAGE_MAIN_LOCATIONS.map(loc => [loc.letter, loc.name]));

/** Sage bins that mean "anywhere in this building" rather than a specific shelf. */
const ANYWHERE = new Set(['DEFAULT', 'OTHER', '']);

/** Main location name for a Sage prefix, or '' when the prefix isn't a place (OTHER, RAW PCB, …). */
export function suggestedLocationName(prefix: string): string {
  if (/^[RS]\d+$/.test(prefix)) return MAIN_BY_LETTER.get('A')!; // rooms and storage rooms are in Section A
  if (/^[A-D]\d*$/.test(prefix)) return MAIN_BY_LETTER.get(prefix.charAt(0))!;
  if (/^[IJKL]$/.test(prefix)) return MAIN_BY_LETTER.get(prefix)!;
  return '';
}

/**
 * Splits a Sage bin into its prefix and the app sub-location.
 * A bare building letter drops off (J-ROW-R → Warehouse J / ROW-R); an area or room keeps its code
 * so it still reads like Sage (B7-SH-A → Section B / B7-SH-A, R3-DEFAULT → Section A / R3).
 * DEFAULT and OTHER mean anywhere in that building or area.
 */
export function splitBinCode(code: string): SageBin {
  const clean = code.trim().toUpperCase().replace(/\s+/g, ' ');
  const dash = clean.indexOf('-');
  const prefix = dash === -1 ? clean : clean.slice(0, dash);
  const rest = dash === -1 ? '' : clean.slice(dash + 1);
  const restIsAnywhere = ANYWHERE.has(rest);
  if (!suggestedLocationName(prefix)) return { code: clean, prefix, subLocation: '' };
  if (/^[A-Z]$/.test(prefix)) return { code: clean, prefix, subLocation: restIsAnywhere ? '' : rest };
  return { code: clean, prefix, subLocation: restIsAnywhere ? prefix : `${prefix}-${rest}` };
}

/** Picks the existing app location for a Sage prefix when one already has the Sage name. */
export function matchExistingLocation(prefix: string, locations: { id: string; name: string }[]): string | undefined {
  const name = suggestedLocationName(prefix);
  if (!name) return undefined;
  return locations.find(loc => loc.name.toUpperCase().trim() === name)?.id;
}

/* ---------- Planning an import ---------- */

/** What to do with every bin that starts with one Sage prefix. */
export type PrefixChoice =
  | { kind: 'existing'; locationId: string }
  | { kind: 'new'; name: string }
  | { kind: 'skip' };

export interface PrefixSummary {
  prefix: string;
  /** Distinct bin codes with this prefix. */
  codes: string[];
  partCount: number;
}

export function summarizePrefixes(lines: SageLine[]): PrefixSummary[] {
  const byPrefix = new Map<string, { codes: Set<string>; parts: Set<string> }>();
  lines.forEach(line => line.bins.forEach(code => {
    const { prefix } = splitBinCode(code);
    const entry = byPrefix.get(prefix) || { codes: new Set<string>(), parts: new Set<string>() };
    entry.codes.add(code);
    entry.parts.add(line.itemId);
    byPrefix.set(prefix, entry);
  }));
  return Array.from(byPrefix.entries())
    .map(([prefix, entry]) => ({
      prefix,
      codes: Array.from(entry.codes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      partCount: entry.parts.size,
    }))
    .sort((a, b) => b.partCount - a.partCount || a.prefix.localeCompare(b.prefix));
}

/** Same id rule the app uses when an admin adds a location. */
export const locationIdForName = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Suggests a choice for each prefix: a clear existing match, a new location we know the name of, or nothing. */
export function suggestPrefixChoice(
  prefix: string,
  locations: { id: string; name: string }[],
  saved?: string,
): PrefixChoice | undefined {
  if (saved === '') return { kind: 'skip' };
  if (prefix === 'OTHER') return { kind: 'skip' }; // "could be anywhere in the facility"
  if (saved && locations.some(loc => loc.id === saved)) return { kind: 'existing', locationId: saved };
  const existing = matchExistingLocation(prefix, locations);
  if (existing) return { kind: 'existing', locationId: existing };
  const name = suggestedLocationName(prefix);
  if (!name) return undefined;
  const byId = locations.find(loc => loc.id === locationIdForName(name));
  return byId ? { kind: 'existing', locationId: byId.id } : { kind: 'new', name };
}

export interface SageImportPlan {
  newLocations: { id: string; name: string }[];
  /** Bins to add as sub-locations, per location (only ones the app doesn't have yet). */
  addSubLocations: { locationId: string; locationName: string; names: string[] }[];
  /** Sage numbers to record on products the app already has. */
  itemUpdates: { itemId: string; sageQty: number; sageOnPO: number | null; sageBins: string[] }[];
  /** Parts in the Sage file that the app doesn't have. */
  notInApp: SageLine[];
  /** Prefixes with no choice yet; the import waits until each is placed or skipped. */
  unplacedPrefixes: string[];
  /** prefix → location id ('' = skipped), saved for next time. */
  prefixMap: Record<string, string>;
  /**
   * Stock records whose bin would change to Sage's primary bin (the "Bin Location" column).
   * Only where the app already has on-hand stock of that part in that main location.
   */
  binUpdates: { docId: string; itemId: string; locationId: string; from: string; to: string }[];
}

export function buildSageImportPlan(
  lines: SageLine[],
  locations: { id: string; name: string; subLocations?: string[] }[],
  choices: Record<string, PrefixChoice | undefined>,
  appItemIds: Set<string>,
  stock: { itemId: string; locationId: string; source?: string; subLocationDetail?: string; docId?: string }[] = [],
): SageImportPlan {
  const newLocations = new Map<string, string>();
  const prefixMap: Record<string, string> = {};
  const unplacedPrefixes: string[] = [];

  summarizePrefixes(lines).forEach(({ prefix }) => {
    const choice = choices[prefix];
    if (!choice) { unplacedPrefixes.push(prefix); return; }
    if (choice.kind === 'skip') { prefixMap[prefix] = ''; return; }
    if (choice.kind === 'existing') { prefixMap[prefix] = choice.locationId; return; }
    const name = choice.name.trim().toUpperCase();
    const id = locationIdForName(name);
    if (!id) { unplacedPrefixes.push(prefix); return; }
    if (!locations.some(loc => loc.id === id)) newLocations.set(id, name);
    prefixMap[prefix] = id;
  });

  const known = new Map(locations.map(loc => [loc.id, new Set((loc.subLocations || []).map(s => s.trim().toUpperCase()))]));
  const nameOf = (id: string) => locations.find(loc => loc.id === id)?.name || newLocations.get(id) || id;
  const toAdd = new Map<string, Set<string>>();
  lines.forEach(line => line.bins.forEach(code => {
    const { prefix, subLocation } = splitBinCode(code);
    const locationId = prefixMap[prefix];
    if (!locationId || !subLocation) return;
    if (known.get(locationId)?.has(subLocation)) return;
    const names = toAdd.get(locationId) || new Set<string>();
    names.add(subLocation);
    toAdd.set(locationId, names);
  }));

  const sortNames = (names: Iterable<string>) => Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return {
    newLocations: Array.from(newLocations, ([id, name]) => ({ id, name })),
    addSubLocations: Array.from(toAdd, ([locationId, names]) => ({ locationId, locationName: nameOf(locationId), names: sortNames(names) }))
      .sort((a, b) => a.locationName.localeCompare(b.locationName)),
    itemUpdates: lines
      .filter(line => appItemIds.has(line.itemId))
      .map(line => ({ itemId: line.itemId, sageQty: line.qtyOnHand, sageOnPO: line.qtyOnPO, sageBins: line.bins })),
    notInApp: lines.filter(line => !appItemIds.has(line.itemId)),
    unplacedPrefixes,
    prefixMap,
    binUpdates: lines.flatMap(line => {
      const primary = line.bins[0];
      if (!primary || !appItemIds.has(line.itemId)) return [];
      const { prefix, subLocation } = splitBinCode(primary);
      const locationId = prefixMap[prefix];
      if (!locationId || !subLocation) return [];
      const entry = stock.find(s => s.itemId === line.itemId && s.locationId === locationId && s.source !== 'PO');
      const current = (entry?.subLocationDetail || '').trim().toUpperCase();
      if (!entry || current === subLocation) return [];
      return [{ docId: entry.docId || `${line.itemId}_${locationId}`, itemId: line.itemId, locationId, from: current, to: subLocation }];
    }),
  };
}
