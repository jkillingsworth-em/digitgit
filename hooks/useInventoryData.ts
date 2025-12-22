import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem, Stock } from '../types';

export const useInventoryData = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [stock, setStock] = useState<Stock[]>([]);
    const [categoryColors, setCategoryColors] = useState<Record<string, string>>({});
    
    // We track loading for each individual piece to prevent "pop-in"
    const [loadingState, setLoadingState] = useState({
        items: true,
        stock: true,
        colors: true
    });
    
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            // 1. Inventory Listener
            const qInventory = query(collection(db, 'inventory'));
            const unsubItems = onSnapshot(qInventory, (snapshot) => {
                const inventoryData = snapshot.docs.map(doc => doc.data() as InventoryItem);
                setItems(inventoryData);
                setLoadingState(prev => ({ ...prev, items: false }));
            }, (err) => {
                console.error("Inventory Fetch Error:", err);
                setError("Failed to load inventory.");
            });

            // 2. Stock Listener
            const qStock = query(collection(db, 'stock'));
            const unsubStock = onSnapshot(qStock, (snapshot) => {
                const stockData = snapshot.docs.map(doc => ({
                    ...doc.data() as Stock,
                    docId: doc.id // Preserve ID for updates/deletes
                }));
                setStock(stockData);
                setLoadingState(prev => ({ ...prev, stock: false }));
            }, (err) => {
                console.error("Stock Fetch Error:", err);
                setError("Failed to load stock.");
            });

            // 3. Category Colors Listener
            const qColors = query(collection(db, 'categoryColors'));
            const unsubColors = onSnapshot(qColors, (snapshot) => {
                const colorsMap: Record<string, string> = {};
                snapshot.docs.forEach(doc => {
                    colorsMap[doc.id] = doc.data().color;
                });
                setCategoryColors(colorsMap);
                setLoadingState(prev => ({ ...prev, colors: false }));
            }, (err) => {
                console.error("Colors Fetch Error:", err);
                // Non-critical error, don't block app
            });

            // Cleanup function to detach listeners when component unmounts
            return () => {
                unsubItems();
                unsubStock();
                unsubColors();
            };
        } catch (err: any) {
            setError(err.message);
            return () => {};
        }
    }, []);

    // Derived loading state: true only if ANY critical data is still loading
    const isLoading = loadingState.items || loadingState.stock || loadingState.colors;

    return { 
        items, 
        stock, 
        categoryColors, 
        isLoading, 
        error 
    };
};
