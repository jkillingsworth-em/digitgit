import React, { createContext, useContext } from 'react';
import type { Firestore } from 'firebase/firestore';

const DbContext = createContext<Firestore | null>(null);

export const DbProvider: React.FC<{ db: Firestore; children: React.ReactNode }> = ({ db, children }) => {
  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
};

export const useDb = (): Firestore => {
  const db = useContext(DbContext);
  if (!db) {
    throw new Error('useDb must be used within a DbProvider');
  }
  return db;
};
