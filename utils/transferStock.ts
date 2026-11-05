import { collection, doc, getDoc, getDocs, query, where, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { Stock } from '../types';

/** A transfer records both sides atomically; employees never write an arbitrary total. */
export async function transferStock(db: Firestore, actor: string, rawItem: string, rawFrom: string, rawTo: string, quantity: number, detail = '') {
  const itemId = rawItem.trim().toUpperCase();
  const from = rawFrom.trim().toLowerCase();
  const to = rawTo.trim().toLowerCase();
  if (!actor || !itemId || !from || !to || from === to || !Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error('Choose a product, two different locations, and a positive whole-number quantity.');
  }
  const findStock = (location: string) => getDocs(query(collection(db, 'stock'), where('itemId', '==', itemId), where('locationId', '==', location)));
  const [source, destination] = await Promise.all([findStock(from), findStock(to)]);
  if (source.size !== 1 || destination.size > 1) throw new Error('Missing or duplicate stock records. Ask an administrator to reconcile them.');
  const fromRef = source.docs[0].ref;
  const toRef = destination.docs[0]?.ref || doc(db, 'stock', `${itemId}_${to}`);
  for (let attempt = 0; attempt < 5; attempt++) {
    const transfer = doc(collection(db, 'transfers'));
    let observed: [number, number] | undefined;
    try {
      const balances = await runTransaction(db, async tx => {
        const [sourceDoc, destinationDoc, item, fromLocation, toLocation] = await Promise.all([
          tx.get(fromRef), tx.get(toRef), tx.get(doc(db, 'inventory', itemId)),
          tx.get(doc(db, 'locations', from)), tx.get(doc(db, 'locations', to))
        ]);
        if (!item.exists() || !fromLocation.exists() || !toLocation.exists()) throw new Error('The product and both locations must already exist.');
        if (!sourceDoc.exists()) throw new Error('Source stock changed. Refresh and retry.');
        const existing = sourceDoc.data() as Stock;
        const fromQty = Number(existing.quantity);
        const toQty = destinationDoc.exists() ? Number(destinationDoc.data().quantity) : 0;
        observed = [fromQty, toQty];
        if (existing.itemId !== itemId || existing.locationId !== from ||
            (destinationDoc.exists() && (destinationDoc.data().itemId !== itemId || destinationDoc.data().locationId !== to)) ||
            !Number.isSafeInteger(fromQty) || fromQty < quantity || !Number.isSafeInteger(toQty) || toQty < 0 || !Number.isSafeInteger(toQty + quantity)) {
          throw new Error('Insufficient or invalid stock. Refresh before transferring.');
        }
        // Retain a zero source record so the rules can validate both final quantities.
        tx.update(fromRef, { quantity: fromQty - quantity, lastTransferId: transfer.id });
        if (destinationDoc.exists()) {
          tx.update(toRef, { quantity: toQty + quantity, lastTransferId: transfer.id,
            ...(detail.trim() ? { subLocationDetail: detail.trim() } : {}) });
        } else {
          tx.set(toRef, { itemId, locationId: to, quantity, source: existing.source || 'OH',
            subLocationDetail: detail.trim(), locationBarcode: '', poNumber: '', dateReceived: '',
            docId: toRef.id, lastTransferId: transfer.id });
        }
        tx.set(transfer, { itemId, fromLocationId: from, toLocationId: to, fromStockId: fromRef.id,
          toStockId: toRef.id, quantity, createdBy: actor, createdAt: serverTimestamp() });
        return { fromQuantity: fromQty - quantity, toQuantity: toQty + quantity };
          });
      return balances;
    } catch (error) {
      // Rules can reject an outdated balanced write before the transaction's
      // precondition check returns ABORTED. Retry only when stock actually
      // changed; a genuine permission failure is never bypassed or retried.
      if (attempt === 4 || (error as { code?: string }).code !== 'permission-denied' || !observed) throw error;
      const [latestSource, latestDestination] = await Promise.all([getDoc(fromRef), getDoc(toRef)]);
      const current = [latestSource.exists() ? Number(latestSource.data().quantity) : 0,
        latestDestination.exists() ? Number(latestDestination.data().quantity) : 0];
      if (current[0] === observed[0] && current[1] === observed[1]) throw error;
    }
  }
}
