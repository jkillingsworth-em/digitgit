import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

/**
 * Category hierarchy shape stored in a single doc at settings/categoryHierarchy:
 * { MAIN: { SUB1: { SUB2: [SUB3, ...] } } }
 */
export type CategoryHierarchy = Record<string, Record<string, Record<string, string[]>>>;

const HIERARCHY_REF = (db: Firestore) => doc(db, 'settings', 'categoryHierarchy');

export async function fetchCategoryHierarchy(db: Firestore): Promise<CategoryHierarchy> {
  const snap = await getDoc(HIERARCHY_REF(db));
  return snap.exists() ? (snap.data() as CategoryHierarchy) : {};
}

export async function saveCategoryHierarchy(db: Firestore, hierarchy: CategoryHierarchy): Promise<void> {
  await setDoc(HIERARCHY_REF(db), hierarchy);
}
