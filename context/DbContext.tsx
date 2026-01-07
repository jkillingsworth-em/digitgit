import React, { createContext, useContext } from 'react';
import type { Firestore } from 'firebase/firestore';

interface DbContextType {
    db: Firestore;
}

const DbContext = createContext<DbContextType | undefined>(undefined);

interface DbProviderProps {
    db: Firestore;
    children: React.ReactNode;
}

export const DbProvider: React.FC<DbProviderProps> = ({ db, children }) => {
    return (
        <DbContext.Provider value={{ db }}>
            {children}
        </DbContext.Provider>
    );
};

export const useDb = (): Firestore => {
    const context = useContext(DbContext);
    if (context === undefined) {
        throw new Error('useDb must be used within a DbProvider');
    }
    return context.db;
};
