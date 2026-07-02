import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import type { Firestore, WriteBatch } from 'firebase/firestore';
import { InventoryItem, Stock } from '../types';
import { sanitizeInventoryItem, sanitizeStockItem } from '../utils/sanitize';

const BATCH_LIMIT = 400;
const IMPORT_LIMIT = 450;

export interface CategoryColorChanges {
  category?: string;
  subCategory?: string;
}

const applyCategoryColors = (batch: WriteBatch, db: Firestore, item: InventoryItem, colors?: CategoryColorChanges) => {
  if (!colors) return;
  if (colors.category && item.category) {
    batch.set(doc(db, 'categoryColors', item.category), { color: colors.category });
  }
  if (colors.subCategory && item.subCategory) {
    batch.set(doc(db, 'categoryColors', item.subCategory), { color: colors.subCategory });
  }
};

/** Creates an item plus its initial stock rows in a single batch. */
export async function addItem(
  db: Firestore,
  item: InventoryItem,
  stockEntries: Omit<Stock, 'itemId'>[],
  colors?: CategoryColorChanges,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item));
  stockEntries.forEach(se => {
    const stockItem = sanitizeStockItem({ ...se, itemId: item.id } as Stock);
    batch.set(doc(db, 'stock', stockItem.docId!), stockItem);
  });
  applyCategoryColors(batch, db, item, colors);
  await batch.commit();
}

/** Updates an item and fully replaces its stock rows. */
export async function editItem(
  db: Firestore,
  item: InventoryItem,
  updatedStock: Stock[],
  colors?: CategoryColorChanges,
): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'inventory', item.id), sanitizeInventoryItem(item), { merge: true });
  applyCategoryColors(batch, db, item, colors);
  const q = query(collection(db, 'stock'), where('itemId', '==', item.id));
  const snap = await getDocs(q);
  snap.docs.forEach(d => batch.delete(d.ref));
  updatedStock.forEach(s => {
    const stockItem = sanitizeStockItem({ ...s, itemId: item.id });
    batch.set(doc(db, 'stock', stockItem.docId!), stockItem);
  });
  await batch.commit();
}

/** Deletes a single item and all of its stock rows. */
export async function deleteItem(db: Firestore, itemId: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'inventory', itemId));
  const q = query(collection(db, 'stock'), where('itemId', '==', itemId));
  const snap = await getDocs(q);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

/** Deletes many items (and their known stock rows) respecting Firestore batch limits. */
export async function batchDeleteItems(db: Firestore, ids: string[], allStock: Stock[]): Promise<void> {
  let batch = writeBatch(db);
  let count = 0;

  const commitBatch = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };

  for (const id of ids) {
    batch.delete(doc(db, 'inventory', id));
    count++;

    const relatedStock = allStock.filter(s => s.itemId === id);
    for (const s of relatedStock) {
      if (s.docId) {
        batch.delete(doc(db, 'stock', s.docId));
        count++;
        if (count >= BATCH_LIMIT) await commitBatch();
      }
    }
    if (count >= BATCH_LIMIT) await commitBatch();
  }
  await commitBatch();
}

export interface BulkCategoryChanges {
  category?: string;
  subCategory1?: string[];
  subCategory2?: string[];
  subCategory3?: string[];
}

/** Applies category/hierarchy changes to a set of items. */
export async function bulkEditCategories(db: Firestore, ids: string[], changes: BulkCategoryChanges): Promise<void> {
  const batch = writeBatch(db);
  ids.forEach(id => {
    const updateData: Record<string, unknown> = {};
    if (changes.category) updateData.category = changes.category;
    if (changes.subCategory1) updateData.subCategory1 = changes.subCategory1;
    if (changes.subCategory2) updateData.subCategory2 = changes.subCategory2;
    if (changes.subCategory3) updateData.subCategory3 = changes.subCategory3;
    batch.update(doc(db, 'inventory', id), updateData);
  });
  await batch.commit();
}

/** Imports items and stock rows (merge semantics). Throws when over the single-batch limit. */
export async function importData(db: Firestore, newItems: InventoryItem[], newStock: Stock[]): Promise<void> {
  if (newItems.length + newStock.length > IMPORT_LIMIT) throw new Error('Import too large.');
  const batch = writeBatch(db);
  newItems.forEach(item => batch.set(doc(db, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item), { merge: true }));
  newStock.forEach(s => {
    const stockItem = sanitizeStockItem(s);
    batch.set(doc(db, 'stock', stockItem.docId!), stockItem, { merge: true });
  });
  await batch.commit();
}

/** DANGER: wipes the entire stock + inventory collections. Confirmation is the caller's job. */
export async function purgeAllData(db: Firestore): Promise<void> {
  let batch = writeBatch(db);
  let count = 0;
  const commit = async () => {
    if (count > 0) {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    }
  };
  const sSnap = await getDocs(collection(db, 'stock'));
  for (const d of sSnap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= BATCH_LIMIT) await commit();
  }
  const iSnap = await getDocs(collection(db, 'inventory'));
  for (const d of iSnap.docs) {
    batch.delete(d.ref);
    count++;
    if (count >= BATCH_LIMIT) await commit();
  }
  await commit();
}
