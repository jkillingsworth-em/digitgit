import type { InventoryItem, Stock } from '../types';

export function createInventoryCsv(items: InventoryItem[], stock: Stock[], fields: string[] = ['category']): string {
  const optional = ['category', 'subCategory', 'price', 'usage_2025', 'usage_2024', 'usage_2023', 'usage_2022', 'usage_2021'].filter(field => fields.includes(field));
  const headerFor = (field: string) => field === 'subCategory' ? 'SUB_CATEGORY' : field.toUpperCase();
  const headers = ['ID', 'DESCRIPTION', 'LOCATION', 'SOURCE', 'QTY', ...optional.map(headerFor)];
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = items.flatMap(item => {
    const entries: Array<Stock | undefined> = stock.filter(entry => entry.itemId === item.id);
    if (!entries.length) entries.push(undefined);
    return entries.map(entry => [item.id, item.description, entry?.locationId || '', entry?.source || 'OH', entry?.quantity ?? 0,
      ...optional.map(field => field.startsWith('usage_')
        ? item.priorUsage?.find(year => year.year === Number(field.slice(6)))?.usage ?? ''
        : item[field as keyof InventoryItem] ?? '')
    ].map(quote).join(','));
  });
  return [headers.join(','), ...rows].join('\r\n');
}
