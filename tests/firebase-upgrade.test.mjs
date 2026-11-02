import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteDoc, writeBatch, runTransaction, onSnapshot, terminate } from 'firebase/firestore';

// Fail closed: these tests must never connect to a hosted Firebase project.
assert.equal(process.env.GCLOUD_PROJECT, 'demo-digitgit');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9095');
const options = { projectId: 'demo-digitgit', apiKey: 'demo-key', authDomain: 'demo-digitgit.firebaseapp.com' };

test('Firebase upgrade: sign-in, sign-out and returning user', async () => {
  const app = initializeApp(options, 'auth-upgrade-test');
  try {
    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://127.0.0.1:9095', { disableWarnings: true });
    const email = `upgrade-${Date.now()}@electro-mech.com`;
    const created = await createUserWithEmailAndPassword(auth, email, 'Local-test-only-482!');
    const uid = created.user.uid;
    await signOut(auth);
    assert.equal(auth.currentUser, null);
    const signedIn = await signInWithEmailAndPassword(auth, email, 'Local-test-only-482!');
    assert.equal(signedIn.user.uid, uid);
    await signOut(auth);
  } finally { await deleteApp(app); }
});

test('Firebase upgrade: document lifecycle, listener, atomic batch and concurrent transfers', async () => {
  const app = initializeApp(options, 'firestore-upgrade-test');
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085, {
    mockUserToken: { sub: 'test-admin', email: 'test-admin@electro-mech.com', email_verified: true, admin: true }
  });
  const first = doc(db, 'upgradeTests', 'source');
  const second = doc(db, 'upgradeTests', 'destination');
  let unsubscribe;
  try {
    const batch = writeBatch(db);
    batch.set(first, { quantity: 20, category: 'test' });
    batch.set(second, { quantity: 0, category: 'test' });
    await batch.commit();
    assert.equal((await getDoc(first)).data().category, 'test');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Listener timed out')), 10000);
      unsubscribe = onSnapshot(first, snapshot => {
        if (snapshot.data()?.quantity === 20) { clearTimeout(timer); resolve(); }
      }, error => { clearTimeout(timer); reject(error); });
    });
    unsubscribe();
    await Promise.all(Array.from({ length: 4 }, () => runTransaction(db, async transaction => {
      const source = await transaction.get(first);
      const destination = await transaction.get(second);
      transaction.update(first, { quantity: source.data().quantity - 1 });
      transaction.update(second, { quantity: destination.data().quantity + 1 });
    }, { maxAttempts: 10 })));
    assert.equal((await getDoc(first)).data().quantity, 16);
    assert.equal((await getDoc(second)).data().quantity, 4);
    await deleteDoc(first);
    await deleteDoc(second);
    assert.equal((await getDoc(first)).exists(), false);
  } finally {
    unsubscribe?.();
    await terminate(db);
    await deleteApp(app);
  }
});

test('Firebase upgrade: employee can read but cannot write under repository rules', async () => {
  const app = initializeApp(options, 'employee-upgrade-test');
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8085, {
    mockUserToken: { sub: 'test-employee', email: 'test-employee@electro-mech.com', email_verified: true }
  });
  try {
    const ref = doc(db, 'upgradeTests', 'employee-write-denied');
    await getDoc(ref);
    await assert.rejects(setDoc(ref, { quantity: 1 }), error => error.code === 'permission-denied');
  } finally { await terminate(db); await deleteApp(app); }
});
