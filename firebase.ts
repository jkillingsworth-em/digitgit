import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD8adlfz_gkroKlbYOnkbiqUrtVwblQLY",
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
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, app, auth };
