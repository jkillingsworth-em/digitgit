import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query } from 'firebase/firestore';
import { useDb } from '../context/DbContext';
import { InventoryItem, PurchaseOrderRecord, Stock } from '../types';

export const useInventoryData = () => {
    const db = useDb();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [stock, setStock] = useState<Stock[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRecord[]>([]);
    const [categoryHierarchyDoc, setCategoryHierarchyDoc] = useState<Record<string, any>>({});
    
    // We track loading for each individual piece to prevent "pop-in"
    const [loadingState, setLoadingState] = useState({
        items: true,
        stock: true,
        purchaseOrders: true,
        hierarchy: true
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

            const qPurchaseOrders = query(collection(db, 'purchaseOrders'));
            const unsubPurchaseOrders = onSnapshot(qPurchaseOrders, (snapshot) => {
                const purchaseOrderData = snapshot.docs.map(entry => ({
                    ...(entry.data() as PurchaseOrderRecord),
                    docId: entry.id,
                }));
                setPurchaseOrders(purchaseOrderData);
                setLoadingState(prev => ({ ...prev, purchaseOrders: false }));
            }, (err) => {
                console.error('Purchase Order Fetch Error:', err);
                setPurchaseOrders([]);
                setLoadingState(prev => ({ ...prev, purchaseOrders: false }));
            });

            // 3. Category Hierarchy Listener
            const hierarchyRef = doc(db, 'settings', 'categoryHierarchy');
            const unsubHierarchy = onSnapshot(hierarchyRef, (snapshot) => {
                if (snapshot.exists()) {
                    setCategoryHierarchyDoc(snapshot.data() || {});
                } else {
                    setCategoryHierarchyDoc({});
                }
                setLoadingState(prev => ({ ...prev, hierarchy: false }));
            }, (err) => {
                console.error('Hierarchy Fetch Error:', err);
                setCategoryHierarchyDoc({});
                setLoadingState(prev => ({ ...prev, hierarchy: false }));
            });

            // Cleanup function to detach listeners when component unmounts
            return () => {
                unsubItems();
                unsubStock();
                unsubPurchaseOrders();
                unsubHierarchy();
            };
        } catch (err: any) {
            setError(err.message);
            return () => {};
        }
    }, [db]);

    // Derived loading state: true only if ANY critical data is still loading
    const isLoading = loadingState.items || loadingState.stock || loadingState.purchaseOrders || loadingState.hierarchy;

    return { 
        items, 
        stock, 
        purchaseOrders,
        categoryHierarchyDoc,
        isLoading, 
        error 
    };
};
