import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDs8adlfz_gkroKlbYOnkbiqUrtVwbLqLY",
  authDomain: "digitgit-93d87.firebaseapp.com",
  projectId: "digitgit-93d87",
  storageBucket: "digitgit-93d87.firebasestorage.app",
  messagingSenderId: "110628533146",
  appId: "1:110628533146:web:1ebbebec50567423340023",
  measurementId: "G-MEQ7HH5BRE"
};

/**
 * ELECTRO-MECH SCOREBOARD CO. - FIREBASE CORE
 */
// Opt-in local verification uses a demo project, never the hosted database.
const useEmulators = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true';
if (useEmulators && !['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
  throw new Error('Firebase emulator mode requires a local browser address.');
}
const config = useEmulators ? {
  ...firebaseConfig, projectId: 'demo-digitgit', apiKey: 'demo-key', authDomain: 'demo-digitgit.firebaseapp.com'
} : firebaseConfig;
const app = getApps().length === 0 ? initializeApp(config) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
if (useEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8085);
  connectAuthEmulator(auth, 'http://127.0.0.1:9095', { disableWarnings: true });
}

export { db, app, auth };
