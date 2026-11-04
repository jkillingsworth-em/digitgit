import { collection, doc, getDocs, query, where, runTransaction } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { InventoryItem, Stock } from '../types';

const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .filter(([, entry]) => entry !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => [key, ordered(entry)])) : value;
const same = (left: unknown, right: unknown) => JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
const conflict = () => new Error('Inventory changed while this editor was open. Close and reopen the item before saving.');

export async function saveItemEdit(db: Firestore, item: InventoryItem, nextStock: Stock[], expectedItem: InventoryItem, expectedStock: Stock[]) {
  if (item.id !== expectedItem.id || nextStock.length + expectedStock.length > 440) throw new Error('Invalid item edit or too many stock records.');
  const baseline = new Map(expectedStock.map(entry => [entry.locationId, entry]));
  if (baseline.size !== expectedStock.length) throw new Error('Duplicate stock records require reconciliation.');
  const locations = new Set<string>();
  for (const entry of nextStock) {
    if (entry.itemId !== item.id || !entry.locationId || locations.has(entry.locationId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < 0) {
      throw new Error('Stock must have unique locations and non-negative whole-number quantities.');
    }
    locations.add(entry.locationId);
  }
  const current = await getDocs(query(collection(db, 'stock'), where('itemId', '==', item.id)));
  const expectedIds = new Set(expectedStock.map(entry => entry.docId || `${item.id}_${entry.locationId}`));
  if (current.size !== expectedIds.size || current.docs.some(entry => !expectedIds.has(entry.id))) throw conflict();
  const target = (entry: Stock) => baseline.get(entry.locationId)?.docId || `${item.id}_${entry.locationId}`;
  const ids = [...new Set([...expectedIds, ...nextStock.map(target)])];
  const itemRef = doc(db, 'inventory', item.id);
  await runTransaction(db, async tx => {
    const [storedItem, ...stockDocs] = await Promise.all([tx.get(itemRef), ...ids.map(id => tx.get(doc(db, 'stock', id)))]);
    const locationDocs = await Promise.all([...locations].map(id => tx.get(doc(db, 'locations', id))));
    if (!storedItem.exists() || !same({ ...storedItem.data(), id: item.id }, expectedItem)) throw conflict();
    if (locationDocs.some(entry => !entry.exists())) throw new Error('Choose existing locations only.');
    const byId = new Map(stockDocs.map(entry => [entry.id, entry]));
    for (const expected of expectedStock) {
      const id = expected.docId || `${item.id}_${expected.locationId}`;
      const live = byId.get(id)!;
      if (!live.exists() || !same({ ...live.data(), docId: id }, { ...expected, docId: id })) throw conflict();
    }
    for (const entry of nextStock) {
      const id = target(entry);
      if (!expectedIds.has(id) && byId.get(id)!.exists()) throw conflict();
    }
    tx.set(itemRef, item, { merge: true });
    for (const entry of nextStock) {
      const id = target(entry);
      if (!same({ ...entry, docId: id }, { ...baseline.get(entry.locationId), docId: id })) {
        tx.set(doc(db, 'stock', id), { ...entry, docId: id }, { merge: true });
      }
    }
    for (const entry of expectedStock) {
      if (!locations.has(entry.locationId)) tx.delete(doc(db, 'stock', entry.docId || `${item.id}_${entry.locationId}`));
    }
  });
}
