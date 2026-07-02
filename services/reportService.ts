import { InventoryItem, Location, ReportDataItem, Stock } from '../types';

export interface ReportOptions {
  type: 'all' | 'category' | 'selected' | 'low-alert';
  /** Category name when type === 'category'. */
  value?: string;
  /** Selected item ids when type === 'selected'. */
  selectedIds?: ReadonlySet<string>;
}

export const totalQuantity = (itemId: string, stock: Stock[]): number =>
  stock.filter(s => s.itemId === itemId).reduce((sum, s) => sum + s.quantity, 0);

export const isLowAlert = (item: InventoryItem, stock: Stock[]): boolean =>
  (item.lowAlertQuantity ?? 0) > 0 && totalQuantity(item.id, stock) <= (item.lowAlertQuantity ?? 0);

export const countLowAlertItems = (items: InventoryItem[], stock: Stock[]): number =>
  items.filter(i => isLowAlert(i, stock)).length;

const matchesOptions = (item: InventoryItem, stock: Stock[], options: ReportOptions): boolean => {
  switch (options.type) {
    case 'all':
      return true;
    case 'category':
      return (item.category || 'Uncategorized') === options.value;
    case 'selected':
      return options.selectedIds?.has(item.id) ?? false;
    case 'low-alert':
      return isLowAlert(item, stock);
    default:
      return false;
  }
};

/** Flattens items + stock into printable report rows (one row per stock line). */
export function buildReportData(
  options: ReportOptions,
  items: InventoryItem[],
  stock: Stock[],
  locations: Location[],
): ReportDataItem[] {
  const rows: ReportDataItem[] = [];
  const locationName = (id: string) => locations.find(l => l.id === id)?.name ?? id.toUpperCase();

  items
    .filter(item => matchesOptions(item, stock, options))
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach(item => {
      const itemStock = stock.filter(s => s.itemId === item.id);
      if (itemStock.length === 0) {
        rows.push({ ...item, locationName: 'NO STOCK', quantity: 0, source: 'OH' });
      } else {
        itemStock.forEach(s => {
          const { itemId: _i, locationId: _l, ...stockFields } = s;
          rows.push({ ...item, ...stockFields, locationName: locationName(s.locationId) });
        });
      }
    });

  return rows;
}
