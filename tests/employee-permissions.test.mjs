import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, writeBatch, serverTimestamp, terminate } from 'firebase/firestore';
import { transferStock } from '../utils/transferStock.ts';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-digitgit');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const clients = [];
const email = 'employee@electro-mech.com';
function client(name, claims = {}) {
  const app = initializeApp({ projectId: 'demo-digitgit', apiKey: 'demo-key' }, `permissions-${name}`);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085, {
    mockUserToken: { sub: name, email, email_verified: true, ...claims }
  });
  clients.push({ app, db });
  return db;
}
const admin = client('admin', { admin: true });
const employee = client('employee');
after(async () => { for (const { app, db } of clients) { await terminate(db); await deleteApp(app); } });
let serial = 0;
async function fixture(destination = false) {
  const sku = `PERM-${Date.now()}-${serial++}`;
  const from = `legacy-${sku}`;
  const to = `${sku}_perm-b`;
  const batch = writeBatch(admin);
  batch.set(doc(admin, 'inventory', sku), { id: sku, name: 'Protected product', description: 'Protected description', category: 'PARTS' });
  batch.set(doc(admin, 'locations', 'perm-a'), { name: 'Listed Shelf A' });
  batch.set(doc(admin, 'locations', 'perm-b'), { name: 'Listed Shelf B' });
  batch.set(doc(admin, 'stock', from), { itemId: sku, locationId: 'perm-a', quantity: 20, source: 'OH', docId: from });
  if (destination) batch.set(doc(admin, 'stock', to), { itemId: sku, locationId: 'perm-b', quantity: 0, source: 'OH', docId: to });
  await batch.commit();
  return { sku, from, to };
}
const quantity = async id => (await getDoc(doc(admin, 'stock', id))).data().quantity;
const denied = action => assert.rejects(action, error => error.code === 'permission-denied');

test('employee transfers between listed locations, preserving the total and legacy source path', async () => {
  const f = await fixture();
  await transferStock(employee, email, f.sku, 'perm-a', 'perm-b', 7, 'Bin 2');
  assert.equal(await quantity(f.from), 13);
  assert.equal(await quantity(f.to), 7);
  const source = (await getDoc(doc(admin, 'stock', f.from))).data();
  const destination = (await getDoc(doc(admin, 'stock', f.to))).data();
  assert.equal(source.lastTransferId, destination.lastTransferId);
  assert.equal(destination.subLocationDetail, 'Bin 2');
  const record = (await getDoc(doc(admin, 'transfers', source.lastTransferId))).data();
  assert.equal(record.createdBy, email);
  assert.equal(record.quantity, 7);
  assert.equal((await getDoc(doc(admin, 'inventory', f.sku))).data().name, 'Protected product');
});

test('moving all stock retains a zero source and cannot overdraw it', async () => {
  const f = await fixture();
  await transferStock(employee, email, f.sku, 'perm-a', 'perm-b', 20);
  assert.equal(await quantity(f.from), 0);
  assert.equal(await quantity(f.to), 20);
  await assert.rejects(transferStock(employee, email, f.sku, 'perm-a', 'perm-b', 1), /Insufficient/);
});

test('simultaneous employee transfers cannot move more than available', async () => {
  const f = await fixture();
  const outcomes = await Promise.allSettled(Array.from({ length: 4 }, () => transferStock(employee, email, f.sku, 'perm-a', 'perm-b', 6)));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 3);
  assert.equal(await quantity(f.from), 2);
  assert.equal(await quantity(f.to), 18);
});

test('employee cannot change product definitions, categories, or main locations', async () => {
  const f = await fixture();
  for (const field of ['id', 'name', 'description', 'category', 'subCategory1', 'subCategory2', 'subCategory3']) {
    await denied(updateDoc(doc(employee, 'inventory', f.sku), { [field]: 'Forbidden' }));
  }
  await denied(setDoc(doc(employee, 'inventory', 'UNAUTHORIZED-SKU'), { name: 'Forbidden' }));
  await denied(deleteDoc(doc(employee, 'inventory', f.sku)));
  await denied(updateDoc(doc(employee, 'locations', 'perm-a'), { name: 'Renamed shelf' }));
  await denied(setDoc(doc(employee, 'locations', 'unlisted'), { name: 'New shelf' }));
  await denied(deleteDoc(doc(employee, 'locations', 'perm-b')));
  await denied(setDoc(doc(employee, 'categories', 'UNAUTHORIZED'), { id: 'UNAUTHORIZED' }));
  await denied(setDoc(doc(employee, 'settings', 'categoryHierarchy'), { UNAUTHORIZED: {} }));
});

test('employee cannot directly change, create or delete stock', async () => {
  const f = await fixture();
  await denied(updateDoc(doc(employee, 'stock', f.from), { quantity: 99 }));
  await denied(setDoc(doc(employee, 'stock', f.to), { itemId: f.sku, locationId: 'perm-b', quantity: 9, source: 'OH' }));
  await denied(deleteDoc(doc(employee, 'stock', f.from)));
});

async function forgedTransfer(f, patch = {}, sourceQty = 15, destQty = 5, toLocation = 'perm-b') {
  const ref = doc(collection(employee, 'transfers'));
  const batch = writeBatch(employee);
  batch.update(doc(employee, 'stock', f.from), { quantity: sourceQty, lastTransferId: ref.id });
  batch.update(doc(employee, 'stock', f.to), { quantity: destQty, lastTransferId: ref.id, ...patch });
  batch.set(ref, { itemId: f.sku, fromLocationId: 'perm-a', toLocationId: toLocation,
    fromStockId: f.from, toStockId: f.to, quantity: 5, createdBy: email, createdAt: serverTimestamp() });
  return batch.commit();
}

test('rules reject forged transfers that inflate totals, change metadata, or target unlisted locations', async () => {
  const f = await fixture(true);
  await denied(forgedTransfer(f, {}, 20, 5));
  await denied(forgedTransfer(f, { source: 'PO' }));
  await denied(forgedTransfer(f, { itemId: 'OTHER-SKU' }));
  await denied(forgedTransfer(f, {}, 15, 5, 'unlisted'));
  assert.equal(await quantity(f.from), 20);
  assert.equal(await quantity(f.to), 0);
});

test('rules reject replaying a completed transfer record', async () => {
  const f = await fixture();
  await transferStock(employee, email, f.sku, 'perm-a', 'perm-b', 5);
  const source = (await getDoc(doc(admin, 'stock', f.from))).data();
  const batch = writeBatch(employee);
  batch.update(doc(employee, 'stock', f.from), { quantity: 10, lastTransferId: source.lastTransferId });
  batch.update(doc(employee, 'stock', f.to), { quantity: 10, lastTransferId: source.lastTransferId });
  await denied(batch.commit());
});

test('only a verified employee or administrator has access', async () => {
  const f = await fixture();
  const unverified = client('unverified', { email_verified: false });
  const outsider = client('outsider', { email: 'outsider@example.com' });
  await denied(getDoc(doc(unverified, 'inventory', f.sku)));
  await denied(getDoc(doc(outsider, 'inventory', f.sku)));
  await updateDoc(doc(admin, 'inventory', f.sku), { name: 'Admin edit works' });
  assert.equal((await getDoc(doc(admin, 'inventory', f.sku))).data().name, 'Admin edit works');
});
