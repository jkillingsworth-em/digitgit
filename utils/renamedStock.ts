import type { Stock } from '../types';

export function renamedStock(source: Stock, itemId: string, locationId: string, docId: string): Stock {
  return { ...source, itemId, locationId, docId };
}
