import { InventoryItem, Stock } from '../types';
import {
  buildEmDigitWarehousePushUpdates,
  mapEmDigitInventoryGrid,
  type EmDigitMapResult,
  type EmDigitPushBuildResult,
} from './emDigitInventoryMap';
import { requestGoogleSheetsAccessToken } from './googleSheetsAuth';

export const DEFAULT_EM_DIGIT_SHEET_ID = '1sBtdqpGCWXTUd9KTKT5nF5mbG_r8KSIICvFlzizTbmw';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const getEmDigitSheetId = (): string => {
  const fromEnv = import.meta.env.VITE_EM_DIGIT_SHEET_ID;
  const id = (fromEnv && String(fromEnv).trim()) || DEFAULT_EM_DIGIT_SHEET_ID;
  return id;
};

const sheetsFetch = async <T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(`${SHEETS_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new Error(`Sheets API ${response.status}: ${detail || response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

export interface SheetValuesSnapshot {
  spreadsheetId: string;
  sheetTitle: string;
  range: string;
  values: string[][];
}

/** Fetch A:Z from the first sheet (or a named sheet) as a 2D string grid. */
export const fetchEmDigitSheetValues = async (
  accessToken: string,
  spreadsheetId: string = getEmDigitSheetId(),
  sheetTitle?: string,
): Promise<SheetValuesSnapshot> => {
  let title = sheetTitle;
  if (!title) {
    const meta = await sheetsFetch<{
      sheets?: { properties?: { title?: string; index?: number } }[];
    }>(`/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`, accessToken);
    const first = (meta.sheets || [])
      .slice()
      .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))[0];
    title = first?.properties?.title || 'Sheet1';
  }

  const quotedTitle = `'${title.replace(/'/g, "''")}'`;
  const range = `${quotedTitle}!A:Z`;
  const data = await sheetsFetch<{ range?: string; values?: (string | number | boolean | null)[][] }>(
    `/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
    accessToken,
  );

  const values = (data.values || []).map(row =>
    (row || []).map(cell => (cell === null || cell === undefined ? '' : String(cell))),
  );

  return {
    spreadsheetId,
    sheetTitle: title,
    range: data.range || range,
    values,
  };
};

export interface EmDigitPullResult {
  mapped: EmDigitMapResult;
  /** Items only — pull must never write stock */
  items: InventoryItem[];
  snapshot: SheetValuesSnapshot;
}

/** Pull sheet → map rows. Caller should only persist sageQty/sageAsOf/threeYearAvg on updates (app owns category/description/color; never stock). */
export const pullEmDigitInventoryFromSheet = async (options?: {
  accessToken?: string;
  spreadsheetId?: string;
}): Promise<EmDigitPullResult> => {
  const accessToken = options?.accessToken || (await requestGoogleSheetsAccessToken());
  const spreadsheetId = options?.spreadsheetId || getEmDigitSheetId();
  const snapshot = await fetchEmDigitSheetValues(accessToken, spreadsheetId);
  const mapped = mapEmDigitInventoryGrid(snapshot.values);
  return {
    mapped,
    items: mapped.items,
    snapshot,
  };
};

export interface EmDigitPushResult {
  updatedCells: number;
  matchedItems: number;
  unmatchedItemIds: string[];
  warnings: string[];
  build: EmDigitPushBuildResult;
}

/** Push Firebase floor stock → sheet warehouse columns only (match by item code). */
export const pushEmDigitInventoryToSheet = async (
  items: InventoryItem[],
  stock: Stock[],
  options?: {
    accessToken?: string;
    spreadsheetId?: string;
  },
): Promise<EmDigitPushResult> => {
  const accessToken = options?.accessToken || (await requestGoogleSheetsAccessToken());
  const spreadsheetId = options?.spreadsheetId || getEmDigitSheetId();
  const snapshot = await fetchEmDigitSheetValues(accessToken, spreadsheetId);
  const build = buildEmDigitWarehousePushUpdates(snapshot.values, items, stock, {
    sheetName: snapshot.sheetTitle,
  });

  if (build.updates.length === 0) {
    return {
      updatedCells: 0,
      matchedItems: build.matchedItems,
      unmatchedItemIds: build.unmatchedItemIds,
      warnings: build.warnings.length
        ? build.warnings
        : ['No warehouse cells to update (no matching item codes).'],
      build,
    };
  }

  // Sheets batchUpdate accepts up to ~100k cells; chunk defensively.
  const CHUNK = 500;
  for (let i = 0; i < build.updates.length; i += CHUNK) {
    const chunk = build.updates.slice(i, i + CHUNK);
    await sheetsFetch(`/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: chunk.map(u => ({
          range: u.range,
          majorDimension: 'ROWS',
          values: [[u.value]],
        })),
      }),
    });
  }

  return {
    updatedCells: build.updates.length,
    matchedItems: build.matchedItems,
    unmatchedItemIds: build.unmatchedItemIds,
    warnings: build.warnings,
    build,
  };
};
