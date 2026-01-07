import React, { createContext, useContext } from 'react';
import type { Firestore } from 'firebase/firestore';

// Create a context to hold the Firestore instance
const DbContext = createContext<Firestore | null>(null);

interface DbProviderProps {
    db: Firestore;
    children: React.ReactNode;
}

/**
 * DbProvider component that provides the Firestore instance to the app
 */
export const DbProvider: React.FC<DbProviderProps> = ({ db, children }) => {
    return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
};

/**
 * Hook to access the Firestore instance
 * Throws an error if used outside of DbProvider
 */
export const useDb = (): Firestore => {
    const db = useContext(DbContext);
    if (!db) {
        throw new Error('useDb must be used within a DbProvider');
    }
    return db;
};
