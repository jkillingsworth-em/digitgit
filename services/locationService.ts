import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { Location } from '../types';

export const DEFAULT_LOCATIONS: Location[] = [
  { id: 'wh-j', name: 'WH-J', subLocationPrompt: 'SHELF or RACK' },
  { id: 'wh-c', name: 'WH-C' },
  { id: 'wh-k', name: 'WH-K' },
  { id: 'prod', name: 'PROD', subLocationPrompt: 'SHELF, OFFICE, or ROOM' },
  { id: 'inspect', name: 'INSPECT' },
];

/** Fetches locations; returns null when the collection is empty (caller decides on defaults). */
export async function fetchLocations(db: Firestore): Promise<Location[] | null> {
  const snap = await getDocs(collection(db, 'locations'));
  if (snap.empty) return null;
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Location));
}

const slugify = (name: string) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function addLocation(db: Firestore, name: string, subLocationPrompt?: string): Promise<Location> {
  const cleanName = name.toUpperCase().trim();
  const id = slugify(cleanName);
  if (!id) throw new Error('Invalid location name.');
  const location: Location = { id, name: cleanName, ...(subLocationPrompt?.trim() ? { subLocationPrompt: subLocationPrompt.trim() } : {}) };
  const { id: _omit, ...data } = location;
  await setDoc(doc(db, 'locations', id), data);
  return location;
}

export async function updateLocation(db: Firestore, id: string, name: string, subLocationPrompt?: string): Promise<void> {
  const cleanName = name.toUpperCase().trim();
  if (!cleanName) throw new Error('Invalid location name.');
  await setDoc(doc(db, 'locations', id), {
    name: cleanName,
    ...(subLocationPrompt?.trim() ? { subLocationPrompt: subLocationPrompt.trim() } : { subLocationPrompt: '' }),
  }, { merge: true });
}

export async function deleteLocation(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, 'locations', id));
}

/** Seeds the default locations into Firestore (used by the manager's sync action). */
export async function seedDefaultLocations(db: Firestore): Promise<void> {
  for (const loc of DEFAULT_LOCATIONS) {
    const { id, ...data } = loc;
    await setDoc(doc(db, 'locations', id), data, { merge: true });
  }
}
