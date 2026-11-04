import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, terminate } from 'firebase/firestore';
import { saveItemEdit } from '../utils/saveItemEdit.ts';
import { transferStock } from '../utils/transferStock.ts';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-digitgit');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
const apps = [];
function client(name, admin) {
  const app = initializeApp({ projectId: 'demo-digitgit', apiKey: 'demo-key' }, name);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085, { mockUserToken: {
    sub: name, email: `${name}@electro-mech.com`, email_verified: true, admin
  } });
  apps.push({ app, db });
  return db;
}
const admin = client('edit-admin', true);
const employee = client('edit-employee', false);
after(async () => { for (const { app, db } of apps) { await terminate(db); await deleteApp(app); } });
let serial = 0;
async function fixture() {
  const sku = `EDIT-${Date.now()}-${serial++}`;
  const item = { id: sku, name: 'Original', description: 'Original description', category: 'TEST' };
  const stock = [{ itemId: sku, locationId: 'edit-a', quantity: 10, source: 'OH', docId: `legacy-${sku}`, customNote: 'retain' },
    { itemId: sku, locationId: 'edit-b', quantity: 0, source: 'OH', docId: `${sku}_edit-b` }];
  await Promise.all([
    setDoc(doc(admin, 'inventory', sku), item),
    setDoc(doc(admin, 'locations', 'edit-a'), { name: 'Edit A' }),
    setDoc(doc(admin, 'locations', 'edit-b'), { name: 'Edit B' }),
    ...stock.map(row => setDoc(doc(admin, 'stock', row.docId), row))
  ]);
  return { item, stock };
}

test('metadata-only admin edit leaves stock and receipt metadata intact', async () => {
  const f = await fixture();
  await saveItemEdit(admin, { ...f.item, description: 'Edited description' }, f.stock, f.item, f.stock);
  assert.equal((await getDoc(doc(admin, 'inventory', f.item.id))).data().description, 'Edited description');
  assert.deepEqual((await getDoc(doc(admin, 'stock', f.stock[0].docId))).data(), f.stock[0]);
});

test('stale admin editor cannot overwrite a later employee transfer', async () => {
  const f = await fixture();
  await transferStock(employee, 'edit-employee@electro-mech.com', f.item.id, 'edit-a', 'edit-b', 4);
  await assert.rejects(saveItemEdit(admin, { ...f.item, description: 'Stale edit' }, f.stock, f.item, f.stock), /Inventory changed/);
  assert.equal((await getDoc(doc(admin, 'stock', f.stock[0].docId))).data().quantity, 6);
  assert.equal((await getDoc(doc(admin, 'stock', f.stock[1].docId))).data().quantity, 4);
  assert.equal((await getDoc(doc(admin, 'inventory', f.item.id))).data().description, 'Original description');
});

test('fresh admin adjustment preserves legacy stock document identity', async () => {
  const f = await fixture();
  const adjusted = f.stock.map((row, index) => index === 0 ? { ...row, quantity: 12 } : row);
  await saveItemEdit(admin, f.item, adjusted, f.item, f.stock);
  const stored = (await getDoc(doc(admin, 'stock', f.stock[0].docId))).data();
  assert.equal(stored.quantity, 12);
  assert.equal(stored.customNote, 'retain');
  assert.equal((await getDoc(doc(admin, 'stock', `${f.item.id}_edit-a`))).exists(), false);
});

test('invalid or duplicate stock edits cannot partially save product metadata', async () => {
  const f = await fixture();
  for (const rows of [[{ ...f.stock[0], quantity: 1.5 }], [f.stock[0], f.stock[0]]]) {
    await assert.rejects(saveItemEdit(admin, { ...f.item, description: 'Invalid' }, rows, f.item, f.stock), /whole-number/);
  }
  assert.equal((await getDoc(doc(admin, 'inventory', f.item.id))).data().description, 'Original description');
});
