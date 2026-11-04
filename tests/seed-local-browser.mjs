import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, writeBatch, terminate } from 'firebase/firestore';

assert.equal(process.env.GCLOUD_PROJECT, 'demo-digitgit');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9095');
const email = 'browser-test@electro-mech.com';
const password = 'Local-browser-only-482!';
const authBase = 'http://127.0.0.1:9095/identitytoolkit.googleapis.com/v1';
const response = await fetch(`${authBase}/accounts:signUp?key=demo-key`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, returnSecureToken: true })
});
const account = await response.json();
assert.ok(response.ok, JSON.stringify(account.error));
const update = await fetch(`${authBase}/accounts:update?key=demo-key`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
  body: JSON.stringify({ localId: account.localId, emailVerified: true, customAttributes: JSON.stringify({ admin: true }) })
});
assert.ok(update.ok, await update.text());
const app = initializeApp({ projectId: 'demo-digitgit', apiKey: 'demo-key' });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8085, {
  mockUserToken: { sub: 'seed-admin', email: 'seed-admin@electro-mech.com', email_verified: true, admin: true }
});
try {
  const batch = writeBatch(db);
  batch.set(doc(db, 'inventory', 'TEST-LED'), { id: 'TEST-LED', name: 'Test LED module', description: 'Browser verification LED module', category: 'TEST', subCategory1: ['PARTS'], subCategory2: [], subCategory3: '' });
  batch.set(doc(db, 'locations', 'test-a'), { name: 'Test Shelf A', subLocations: [] });
  batch.set(doc(db, 'locations', 'test-b'), { name: 'Test Shelf B', subLocations: [] });
  batch.set(doc(db, 'stock', 'TEST-LED_test-a'), { itemId: 'TEST-LED', locationId: 'test-a', quantity: 20, source: 'OH' });
  batch.set(doc(db, 'settings', 'categoryHierarchy'), { TEST: { PARTS: {} } });
  await batch.commit();
  console.log('Demo browser account and TEST-LED fixture created. No hosted data accessed.');
} finally { await terminate(db); await deleteApp(app); }
