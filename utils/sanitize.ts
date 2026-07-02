import { InventoryItem, Stock } from '../types';

/** Normalizes an inventory item before persisting (moved from App.tsx unchanged). */
export const sanitizeInventoryItem = (item: InventoryItem): InventoryItem => ({
  id: item.id.toUpperCase().trim(),
  name: item.name || item.description || 'UNNAMED',
  description: item.description || '',
  category: item.category || '',
  subCategory: item.subCategory || '',
  subCategory1: item.subCategory1 || [],
  subCategory2: item.subCategory2 || [],
  subCategory3: item.subCategory3 || '',
  lowAlertQuantity: Number(item.lowAlertQuantity || 0),
  price: Number(item.price || 0),
  priorUsage: (item.priorUsage || []).map(u => ({ year: Number(u.year), usage: Number(u.usage) })),
});

/** Normalizes a stock row and derives its deterministic doc id (moved from App.tsx unchanged). */
export const sanitizeStockItem = (stockItem: Stock): Stock => {
  const itemId = stockItem.itemId.toUpperCase().trim();
  const locationId = stockItem.locationId.toLowerCase().trim();
  const docId = `${itemId}_${locationId}`;

  return {
    itemId,
    locationId,
    quantity: Number(stockItem.quantity),
    source: stockItem.source || 'OH',
    subLocationDetail: stockItem.subLocationDetail || '',
    locationBarcode: stockItem.locationBarcode || '',
    poNumber: stockItem.poNumber || '',
    dateReceived: stockItem.dateReceived || '',
    docId,
  };
};
