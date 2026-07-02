import { collection, doc, getDocs, increment, query, runTransaction, where, writeBatch } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { Stock } from '../types';
import { sanitizeStockItem } from '../utils/sanitize';

export interface StockTransfer {
  itemId: string;
  fromLoc: string;
  toLoc: string;
  qty: number;
}

export interface StockQuantityUpdate {
  itemId: string;
  locationId: string;
  newQty: number;
}

/** Moves quantity of one item between locations inside a transaction. */
export async function moveStock(
  db: Firestore,
  itemId: string,
  fromLoc: string,
  toLoc: string,
  qty: number,
  subDetail?: string,
): Promise<void> {
  await runTransaction(db, async tx => {
    const q = query(collection(db, 'stock'), where('itemId', '==', itemId), where('locationId', '==', fromLoc));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('No stock at source.');
    const fromRef = snap.docs[0].ref;
    const fromData = snap.docs[0].data() as Stock;
    if (fromData.quantity < qty) throw new Error('Insufficient units.');
    const toDocId = `${itemId.toUpperCase().trim()}_${toLoc.toLowerCase().trim()}`;
    const toRef = doc(db, 'stock', toDocId);
    const toDoc = await tx.get(toRef);

    if (fromData.quantity - qty === 0) tx.delete(fromRef);
    else tx.update(fromRef, { quantity: fromData.quantity - qty });

    if (toDoc.exists()) {
      tx.update(toRef, { quantity: toDoc.data().quantity + qty, subLocationDetail: subDetail || toDoc.data().subLocationDetail });
    } else {
      tx.set(toRef, sanitizeStockItem({ itemId, locationId: toLoc, quantity: qty, subLocationDetail: subDetail || '', source: fromData.source }));
    }
  });
}

/** Applies several transfers in one batch using atomic increments. */
export async function bulkTransfer(db: Firestore, transfers: StockTransfer[]): Promise<void> {
  const batch = writeBatch(db);
  for (const t of transfers) {
    const fromRef = doc(db, 'stock', `${t.itemId}_${t.fromLoc}`);
    const toRef = doc(db, 'stock', `${t.itemId}_${t.toLoc}`);
    batch.update(fromRef, { quantity: increment(-t.qty) });
    batch.set(toRef, { itemId: t.itemId, locationId: t.toLoc, quantity: increment(t.qty), source: 'OH' }, { merge: true });
  }
  await batch.commit();
}

/** Sets absolute quantities for item/location pairs in one batch. */
export async function bulkQuantityUpdate(db: Firestore, updates: StockQuantityUpdate[]): Promise<void> {
  const batch = writeBatch(db);
  for (const u of updates) {
    const docId = `${u.itemId}_${u.locationId}`;
    batch.set(
      doc(db, 'stock', docId),
      { itemId: u.itemId, locationId: u.locationId, quantity: u.newQty, source: 'OH' },
      { merge: true },
    );
  }
  await batch.commit();
}
