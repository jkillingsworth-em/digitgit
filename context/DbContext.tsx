import React, { createContext, useContext } from 'react';
import type { Firestore } from 'firebase/firestore';

// Create context with null as initial value
const DbContext = createContext<Firestore | null>(null);

// Provider component
export const DbProvider: React.FC<{ db: Firestore; children: React.ReactNode }> = ({ db, children }) => {
    return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
};

// Hook to use the db instance
export const useDb = (): Firestore => {
    const db = useContext(DbContext);
    if (!db) {
        throw new Error('useDb must be used within a DbProvider');
    }
    return db;
};
