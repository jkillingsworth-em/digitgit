import { useCallback, useEffect, useState } from 'react';
import { useDb } from '../context/DbContext';
import { Location } from '../types';
import {
  DEFAULT_LOCATIONS,
  addLocation,
  deleteLocation,
  fetchLocations,
  seedDefaultLocations,
  updateLocation,
} from '../services/locationService';

/** Owns the locations list and its CRUD, refreshing after each mutation. */
export const useLocations = () => {
  const db = useDb();
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);

  const refresh = useCallback(async () => {
    try {
      const fetched = await fetchLocations(db);
      if (fetched) setLocations(fetched);
    } catch (e) {
      console.warn('Using default locations.', e);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (name: string, prompt: string) => {
    await addLocation(db, name, prompt);
    await refresh();
  }, [db, refresh]);

  const update = useCallback(async (id: string, name: string, prompt: string) => {
    await updateLocation(db, id, name, prompt);
    await refresh();
  }, [db, refresh]);

  const remove = useCallback(async (id: string) => {
    await deleteLocation(db, id);
    await refresh();
  }, [db, refresh]);

  const seedDefaults = useCallback(async () => {
    await seedDefaultLocations(db);
    await refresh();
  }, [db, refresh]);

  return { locations, refresh, add, update, remove, seedDefaults };
};
