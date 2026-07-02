import { InventoryItem, Location, Stock } from '../types';

const csvCell = (value: string | number | undefined | null): string => `"${String(value ?? '').replace(/"/g, '""')}"`;

const locationName = (locations: Location[], locationId: string): string =>
  locations.find(l => l.id === locationId)?.name ?? locationId;

/** Combines the hierarchy fields into one readable sub-category cell. */
const subCategorySummary = (item: InventoryItem): string => {
  const parts = [
    ...(item.subCategory1 || []),
    ...(item.subCategory2 || []),
    ...(item.subCategory3 ? [item.subCategory3] : []),
  ];
  if (parts.length === 0 && item.subCategory) parts.push(item.subCategory);
  return parts.join('; ');
};

/** The original quick export: ID, DESCRIPTION, CATEGORY, LOCATION, QTY — one row per stock line. */
export function buildQuickExportCSV(items: InventoryItem[], stock: Stock[], locations: Location[]): string {
  const headers = ['ID', 'DESCRIPTION', 'CATEGORY', 'LOCATION', 'QTY'];
  const rows = [headers.join(',')];
  items.forEach(item => {
    const itemStock = stock.filter(s => s.itemId === item.id);
    if (itemStock.length === 0) {
      rows.push([csvCell(item.id), csvCell(item.description), csvCell(item.category), '""', '0'].join(','));
    } else {
      itemStock.forEach(s => {
        rows.push([csvCell(item.id), csvCell(item.description), csvCell(item.category), csvCell(locationName(locations, s.locationId)), `${s.quantity}`].join(','));
      });
    }
  });
  return rows.join('\n');
}

/**
 * Tailored ("Smart") export. Always includes ID, DESCRIPTION, LOCATION, QTY;
 * optional fields: category, subCategory, price, usage_<year>.
 */
export function buildTailoredExportCSV(
  items: InventoryItem[],
  stock: Stock[],
  locations: Location[],
  fields: string[],
): string {
  const usageYears = fields
    .filter(f => f.startsWith('usage_'))
    .map(f => Number(f.slice('usage_'.length)))
    .filter(n => !Number.isNaN(n))
    .sort((a, b) => b - a);

  const headers = ['ID', 'DESCRIPTION'];
  if (fields.includes('category')) headers.push('CATEGORY');
  if (fields.includes('subCategory')) headers.push('SUB-CATEGORY');
  headers.push('LOCATION', 'SUB-LOCATION', 'QTY');
  if (fields.includes('price')) headers.push('UNIT PRICE');
  usageYears.forEach(y => headers.push(`USAGE ${y}`));

  const rows = [headers.join(',')];

  const pushRow = (item: InventoryItem, s: Stock | null) => {
    const cells = [csvCell(item.id), csvCell(item.description)];
    if (fields.includes('category')) cells.push(csvCell(item.category));
    if (fields.includes('subCategory')) cells.push(csvCell(subCategorySummary(item)));
    cells.push(
      csvCell(s ? locationName(locations, s.locationId) : ''),
      csvCell(s?.subLocationDetail ?? ''),
      `${s?.quantity ?? 0}`,
    );
    if (fields.includes('price')) cells.push(`${item.price ?? 0}`);
    usageYears.forEach(y => {
      const usage = item.priorUsage?.find(u => u.year === y);
      cells.push(`${usage?.usage ?? 0}`);
    });
    rows.push(cells.join(','));
  };

  items.forEach(item => {
    const itemStock = stock.filter(s => s.itemId === item.id);
    if (itemStock.length === 0) pushRow(item, null);
    else itemStock.forEach(s => pushRow(item, s));
  });

  return rows.join('\n');
}

/** Triggers a browser download of CSV content. */
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}
