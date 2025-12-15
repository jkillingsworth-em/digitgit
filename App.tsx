
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { db } from './firebase';
import { 
    collection, 
    doc, 
    onSnapshot, 
    query, 
    where, 
    writeBatch, 
    runTransaction, 
    getDocs, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    addDoc 
} from 'firebase/firestore';
import { InventoryItem, Location, Stock, ReportDataItem, PrintableLabel } from './types';
import Header from './components/Header';
import InventoryTable from './components/InventoryTable';
import AddItemModal from './components/AddItemModal';
import EditItemModal from './components/EditItemModal';
import MoveStockModal from './components/MoveStockModal';
import ImportDataModal from './components/ImportDataModal';
import GenerateReportModal from './components/GenerateReportModal';
import ReportPreviewModal from './components/ReportPreviewModal';
import BulkEditModal from './components/BulkEditModal';
import NavigationView from './components/NavigationView';
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import BarcodeSheetModal from './components/PrintBarcodeModal';
import GenerateBarcodeSheetModal from './components/CategoryColorModal';
import SelectPrintLocationModal from './components/SelectPrintLocationModal';
import { PlusIcon } from './components/icons/PlusIcon';
import Toast from './components/Toast';
import StatsOverview from './components/StatsOverview';
import { HomeIcon } from './components/icons/HomeIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';

// Location data is now a static constant.
const locations: Location[] = [
    { id: 'wh-j', name: 'WH-J', subLocationPrompt: 'SHELF or RACK' },
    { id: 'wh-c', name: 'WH-C' },
    { id: 'wh-k', name: 'WH-K' },
    { id: 'prod', name: 'PROD', subLocationPrompt: 'SHELF, OFFICE, or ROOM' },
    { id: 'inspect', name: 'INSPECT' },
];

const initialItems: InventoryItem[] = [
    { id: '563-11-SAMP', description: '11" SAMPLE', category: 'OUTDOOR LED BOARD', subCategory: 'RED', priorUsage: [{year: 2023, usage: 1000}, {year: 2024, usage: 1100}, {year: 2025, usage: 1200}], lowAlertQuantity: 100, price: 15.50 },
    { id: '563-15-SAMP', description: '15" SAMPLE', category: 'OUTDOOR LED BOARD', subCategory: 'AMBER', priorUsage: [{year: 2023, usage: 500}, {year: 2024, usage: 550}, {year: 2025, usage: 600}], lowAlertQuantity: 50, price: 22.00 },
];

const initialStock: Stock[] = [
    { itemId: '563-11-SAMP', locationId: 'wh-c', quantity: 900, source: 'OH' },
    { itemId: '563-11-SAMP', locationId: 'prod', quantity: 75, source: 'OH' },
    { itemId: '563-15-SAMP', locationId: 'wh-c', quantity: 450, source: 'OH' },
    { itemId: '563-15-SAMP', locationId: 'prod', quantity: 25, source: 'OH' },
];

const initialColors: Record<string, string> = {
    'RED': '#EF4444',
    'AMBER': '#F59E0B',
    'GREEN': '#10B981',
    'BLUE': '#3B82F6'
};

const calculateAverageUsage = (priorUsage?: { year: number; usage: number }[]): number => {
    if (!priorUsage || priorUsage.length === 0) {
        return 0;
    }
    const totalUsage = priorUsage.reduce((sum, entry) => sum + entry.usage, 0);
    return totalUsage / priorUsage.length;
};

// Helper function to remove undefined values from objects before sending to Firestore
const cleanForFirebase = (data: object) => {
    const cleanData = { ...data };
    Object.keys(cleanData).forEach(key => {
        if ((cleanData as any)[key] === undefined) {
            delete (cleanData as any)[key];
        }
    });
    return cleanData;
};

// Helper function to explicitly select only schema fields for InventoryItem
const sanitizeInventoryItem = (item: InventoryItem): InventoryItem => {
    return {
        id: item.id,
        description: item.description,
        category: item.category,
        subCategory: item.subCategory,
        priorUsage: item.priorUsage ? item.priorUsage.map(u => ({ year: Number(u.year), usage: Number(u.usage) })) : undefined,
        lowAlertQuantity: item.lowAlertQuantity !== undefined ? Number(item.lowAlertQuantity) : undefined,
        price: item.price !== undefined ? Number(item.price) : undefined
    };
};

// Helper function to explicitly select only schema fields for Stock
const sanitizeStockItem = (stockItem: Stock): Stock => {
    return {
        itemId: stockItem.itemId,
        locationId: stockItem.locationId,
        quantity: Number(stockItem.quantity),
        subLocationDetail: stockItem.subLocationDetail,
        locationBarcode: stockItem.locationBarcode, // Include in DB operations
        source: stockItem.source,
        poNumber: stockItem.poNumber,
        dateReceived: stockItem.dateReceived
    };
};

const App: React.FC = () => {
    // UI State
    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isMoveModalOpen, setMoveModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isGenerateBarcodeSheetModalOpen, setGenerateBarcodeSheetModalOpen] = useState(false);
    const [isSelectLocationModalOpen, setSelectLocationModalOpen] = useState(false);
    const [printableLabels, setPrintableLabels] = useState<PrintableLabel[] | null>(null);

    // Toast Notification State
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Mobile Navigation State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [mobileView, setMobileView] = useState<'dashboard' | 'inventory'>('dashboard');

    const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
    const [itemToMove, setItemToMove] = useState<InventoryItem | null>(null);
    const [itemToDuplicate, setItemToDuplicate] = useState<InventoryItem | null>(null);
    const [itemForLocationSelect, setItemForLocationSelect] = useState<{ item: InventoryItem; stock: Stock[] } | null>(null);
    
    // Scanner Move Logic
    const [preSelectedLocationId, setPreSelectedLocationId] = useState<string | undefined>(undefined);

    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [reportData, setReportData] = useState<ReportDataItem[] | null>(null);
    const [fieldToFocus, setFieldToFocus] = useState<string | null>(null);
    
    // View & Filter State
    const [currentView, setCurrentView] = useState<'all' | 'categories' | 'locations'>('all');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);
    
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Data Loading State
    const [isLoading, setIsLoading] = useState(true);

    // Main Application State
    const [appState, setAppState] = useState<{
        items: InventoryItem[];
        stock: Stock[];
        categoryColors: Record<string, string>;
    }>({
        items: [],
        stock: [],
        categoryColors: {},
    });

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    }, []);

    // Seed initial data if the database is empty
    useEffect(() => {
        const seedData = async () => {
            const itemsCollectionRef = collection(db, 'inventory');
            const snapshot = await getDocs(itemsCollectionRef);
            if (snapshot.empty) {
                console.log("Database is empty, seeding initial data...");
                const batch = writeBatch(db);
                initialItems.forEach(item => {
                    const itemRef = doc(db, 'inventory', item.id);
                    batch.set(itemRef, item);
                });
                initialStock.forEach(stockItem => {
                    const stockRef = doc(collection(db, 'stock'));
                    batch.set(stockRef, stockItem);
                });
                Object.entries(initialColors).forEach(([key, value]) => {
                    const colorRef = doc(db, 'categoryColors', key);
                    batch.set(colorRef, { color: value });
                });
                await batch.commit();
                console.log("Initial data seeded.");
            }
        };
        seedData();
    }, []);
    
    // Set up real-time listeners for all data collections
    useEffect(() => {
        setIsLoading(true);
        const unsubscribeItems = onSnapshot(collection(db, 'inventory'), (snapshot) => {
            const items = snapshot.docs.map(doc => doc.data() as InventoryItem);
            setAppState(prev => ({ ...prev, items }));
        });
        const unsubscribeStock = onSnapshot(collection(db, 'stock'), (snapshot) => {
            const stock = snapshot.docs.map(doc => ({...doc.data() as Stock, docId: doc.id}));
            setAppState(prev => ({ ...prev, stock }));
        });
        const unsubscribeColors = onSnapshot(collection(db, 'categoryColors'), (snapshot) => {
            const categoryColors: Record<string, string> = {};
            snapshot.docs.forEach(doc => {
                categoryColors[doc.id] = doc.data().color;
            });
            setAppState(prev => ({ ...prev, categoryColors }));
            setIsLoading(false); // Consider loading complete after all listeners are set up
        });

        return () => {
            unsubscribeItems();
            unsubscribeStock();
            unsubscribeColors();
        };
    }, []);
    
    const { items, stock, categoryColors } = appState;

    const handleOpenMoveModal = useCallback((item: InventoryItem, initialLocationId?: string) => {
        setItemToMove(item);
        setPreSelectedLocationId(initialLocationId);
        setMoveModalOpen(true);
    }, []);
    
    const handleOpenDuplicateModal = useCallback((item: InventoryItem) => {
        setItemToDuplicate(item);
        setAddItemModalOpen(true);
    }, []);
    
    const handleOpenEditModal = useCallback((item: InventoryItem, field?: string) => {
        // Sanitize the item before setting it to state to avoid carrying over UI computed fields
        setItemToEdit(sanitizeInventoryItem(item));
        setFieldToFocus(field || null);
        setEditModalOpen(true);
    }, []);

    const handlePrintSpecificLabel = useCallback((label: PrintableLabel) => {
        setPrintableLabels([label]);
        setSelectLocationModalOpen(false); // Close selection modal if it was open
    }, []);

    const handlePrintSingleItemBarcodes = useCallback((item: InventoryItem) => {
        const itemStock = stock.filter(s => s.itemId === item.id);
        if (itemStock.length > 0) {
            setItemForLocationSelect({ item, stock: itemStock });
            setSelectLocationModalOpen(true);
        } else {
            const label: PrintableLabel = {
                itemId: item.id,
                description: item.description,
                locationName: 'NO STOCK',
            };
            setPrintableLabels([label]);
        }
    }, [stock]);

    const handleGenerateBarcodeSheet = useCallback((labels: PrintableLabel[]) => {
        if (labels.length === 0) {
            alert("No items found for the selected criteria.");
            return;
        }
        setPrintableLabels(labels);
        setGenerateBarcodeSheetModalOpen(false);
    }, []);

    const handleCloseAddItemModal = () => {
        setAddItemModalOpen(false);
        setItemToDuplicate(null);
    };
    
    const handleCloseEditModal = () => {
        setEditModalOpen(false);
        setItemToEdit(null);
        setFieldToFocus(null);
    };

    const handleDeleteItem = useCallback(async (itemId: string) => {
        if (window.confirm('Are you sure you want to delete this item and all its stock records? This action cannot be undone.')) {
            const batch = writeBatch(db);
            // Delete the item document itself
            const itemRef = doc(db, 'inventory', itemId);
            batch.delete(itemRef);

            // Find and delete all associated stock documents
            const q = query(collection(db, 'stock'), where('itemId', '==', itemId));
            const stockSnapshot = await getDocs(q);
            stockSnapshot.forEach(docSnap => batch.delete(docSnap.ref));

            await batch.commit();

            setSelectedItemIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
        }
    }, []);
    
    const handleAddItem = useCallback(async (
        item: InventoryItem, 
        newStockEntries: Omit<Stock, 'itemId'>[], 
        colors?: { category?: string, subCategory?: string }
    ) => {
        try {
            const batch = writeBatch(db);
            
            // Add item - sanitize first
            const itemRef = doc(db, 'inventory', item.id);
            batch.set(itemRef, cleanForFirebase(sanitizeInventoryItem(item)));

            // Add stock
            newStockEntries.forEach(entry => {
                const stockRef = doc(collection(db, 'stock'));
                // entry comes from modal, needs itemId attached and sanitization
                const stockItem: Stock = { ...entry, itemId: item.id } as Stock;
                batch.set(stockRef, cleanForFirebase(sanitizeStockItem(stockItem)));
            });
            
            // Add/update colors
            if (colors) {
                if (item.category && colors.category) {
                    const catColorRef = doc(db, 'categoryColors', item.category);
                    batch.set(catColorRef, { color: colors.category });
                }
                if (item.subCategory && colors.subCategory) {
                    const subCatColorRef = doc(db, 'categoryColors', item.subCategory);
                    batch.set(subCatColorRef, { color: colors.subCategory });
                }
            }
            
            await batch.commit();
            handleCloseAddItemModal();
            showToast('Item added successfully!', 'success');
        } catch (error) {
            console.error("Error adding item:", error);
            showToast('Failed to add item. Please try again.', 'error');
        }
    }, [showToast]);
    
    const handleEditItem = useCallback(async (updatedItem: InventoryItem, updatedStockForThisItem: Stock[], colors?: { category?: string, subCategory?: string }) => {
        // --- Optimistic UI Update ---
        // Immediately update local state to reflect changes before DB confirms.
        // This solves the issue of the table not refreshing without a page reload.
        setAppState(prev => {
            // 1. Update the Item details
            const newItems = prev.items.map(i => i.id === updatedItem.id ? updatedItem : i);
            
            // 2. Update Stock
            // Remove all existing stock for this item from local state
            const otherStock = prev.stock.filter(s => s.itemId !== updatedItem.id);
            
            // Add the new stock entries (assign a temp ID for internal keys if needed)
            // We use 'as any' here because 'docId' isn't on the strict Stock interface but is used by App state
            const newStockEntries = updatedStockForThisItem.map(s => ({
                ...s,
                docId: `temp-${Math.random()}` 
            }));
            
            // 3. Update Colors
            const newColors = { ...prev.categoryColors };
            if (colors?.category && updatedItem.category) {
                newColors[updatedItem.category] = colors.category;
            }
            if (colors?.subCategory && updatedItem.subCategory) {
                newColors[updatedItem.subCategory] = colors.subCategory;
            }

            return {
                ...prev,
                items: newItems,
                stock: [...otherStock, ...newStockEntries] as any[], // Casting to match state type with docId
                categoryColors: newColors
            };
        });

        const batch = writeBatch(db);
        
        // Update item - sanitize first to ensure no UI state (MappedItem fields) pollutes the DB
        const itemRef = doc(db, 'inventory', updatedItem.id);
        batch.update(itemRef, cleanForFirebase(sanitizeInventoryItem(updatedItem)));

        // First, delete all existing stock for this item
        const q = query(collection(db, "stock"), where("itemId", "==", updatedItem.id));
        const oldStockSnapshot = await getDocs(q);
        oldStockSnapshot.forEach(docSnap => batch.delete(docSnap.ref));

        // Then, add the new/updated stock entries
        updatedStockForThisItem.forEach(stockItem => {
            if (stockItem.quantity > 0) {
                const newStockRef = doc(collection(db, "stock"));
                // Sanitize stockItem to ensure no filtered out UI keys or circular refs remain
                batch.set(newStockRef, cleanForFirebase(sanitizeStockItem(stockItem)));
            }
        });

        // Add/update colors
        if (colors) {
            if (updatedItem.category && colors.category) {
                batch.set(doc(db, 'categoryColors', updatedItem.category), { color: colors.category });
            }
            if (updatedItem.subCategory && colors.subCategory) {
                batch.set(doc(db, 'categoryColors', updatedItem.subCategory), { color: colors.subCategory });
            }
        }
        
        await batch.commit();
        handleCloseEditModal();
        showToast('Item updated successfully', 'success');
    }, [showToast]);

    const handleMoveStock = useCallback(async (
        itemId: string,
        fromLocationId: string,
        toLocationId: string,
        quantity: number,
        toSubLocationDetail?: string
    ) => {
        try {
            await runTransaction(db, async (transaction) => {
                // Modular SDK Transactions: Must perform reads (get) before writes (update/set).
                // Queries are not strictly "transactional" in client SDKs in the sense of locking a range,
                // but we can query to find the ID and then get(ref) to lock the document.
                
                // 1. Find source document
                const fromQuery = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", fromLocationId));
                const fromSnapshot = await getDocs(fromQuery);
                
                if (fromSnapshot.empty) {
                    throw new Error("Source stock not found.");
                }
                const fromDocSnapshot = fromSnapshot.docs[0];
                const fromRef = fromDocSnapshot.ref;
                
                // Transactional Read (to ensure data hasn't changed since query)
                const fromDoc = await transaction.get(fromRef);
                if (!fromDoc.exists()) {
                    throw new Error("Source stock disappeared.");
                }
                
                const fromData = fromDoc.data() as Stock;
                if (fromData.quantity < quantity) {
                    throw new Error("Insufficient stock to move.");
                }

                // 2. Find dest document
                const toQuery = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", toLocationId));
                const toSnapshot = await getDocs(toQuery);
                
                let toRef;
                let toData;

                if (!toSnapshot.empty) {
                    const toDocSnapshot = toSnapshot.docs[0];
                    toRef = toDocSnapshot.ref;
                    // Transactional Read
                    const toDoc = await transaction.get(toRef);
                    toData = toDoc.data() as Stock;
                } else {
                    toRef = doc(collection(db, "stock")); // Create new reference
                }

                // 3. Writes
                transaction.update(fromRef, { quantity: fromData.quantity - quantity });
                
                if (toData && toRef) {
                    const updateData: { quantity: number, subLocationDetail?: string } = {
                        quantity: toData.quantity + quantity,
                    };
                    if (toSubLocationDetail !== undefined) {
                        updateData.subLocationDetail = toSubLocationDetail;
                    }
                    transaction.update(toRef, updateData);
                } else if (toRef) {
                    const newStockData: Stock = { 
                        itemId, 
                        locationId: toLocationId, 
                        quantity, 
                        subLocationDetail: toSubLocationDetail, 
                        source: fromData.source, 
                        poNumber: fromData.poNumber, 
                        dateReceived: fromData.dateReceived
                    };
                    transaction.set(toRef, cleanForFirebase(sanitizeStockItem(newStockData)));
                }
            });
            setMoveModalOpen(false);
        } catch (e) {
            console.error("Move stock transaction failed: ", e);
            alert("Failed to move stock. Please try again.");
        }
    }, []);

    const handleImportData = useCallback(async (importedItems: InventoryItem[], importedStock: Stock[]) => {
        const locationNameToId = new Map(locations.map(l => [l.name.toUpperCase(), l.id]));
        const skippedStockEntries: { locationName: string, itemId: string }[] = [];

        const validImportedStock = importedStock.reduce((acc, impS) => {
            const locationId = locationNameToId.get(String(impS.locationId).toUpperCase());
            if (!locationId) {
                skippedStockEntries.push({ locationName: String(impS.locationId), itemId: impS.itemId });
                return acc;
            }
            acc.push({ ...impS, locationId });
            return acc;
        }, [] as (Omit<Stock, 'locationId'> & { locationId: string })[]);

        const importedItemIds = Array.from(new Set(importedItems.map(i => i.id)));
        const BATCH_LIMIT = 400;

        // --- Phase 1: Delete all existing stock for imported items in batches ---
        if (importedItemIds.length > 0) {
            const QUERY_CHUNK_SIZE = 10;
            for (let i = 0; i < importedItemIds.length; i += QUERY_CHUNK_SIZE) {
                const idChunk = importedItemIds.slice(i, i + QUERY_CHUNK_SIZE);
                const q = query(collection(db, "stock"), where("itemId", "in", idChunk));
                const oldStockSnapshot = await getDocs(q);
                
                if (!oldStockSnapshot.empty) {
                    let deleteBatch = writeBatch(db);
                    let deleteCount = 0;
                    
                    for (const d of oldStockSnapshot.docs) {
                        deleteBatch.delete(d.ref);
                        deleteCount++;
                        if (deleteCount >= BATCH_LIMIT) {
                            await deleteBatch.commit();
                            deleteBatch = writeBatch(db);
                            deleteCount = 0;
                        }
                    }
                    
                    if (deleteCount > 0) {
                        await deleteBatch.commit();
                    }
                }
            }
        }

        // --- Phase 2: Write new data (items and stock) in batches ---
        let writeOpBatch = writeBatch(db);
        let operationCount = 0;

        const commitCurrentBatchIfNeeded = async () => {
            if (operationCount >= BATCH_LIMIT) {
                await writeOpBatch.commit();
                writeOpBatch = writeBatch(db);
                operationCount = 0;
            }
        };

        for (const item of importedItems) {
            const itemRef = doc(db, 'inventory', item.id);
            writeOpBatch.set(itemRef, cleanForFirebase(sanitizeInventoryItem(item)), { merge: true });
            operationCount++;
            await commitCurrentBatchIfNeeded();
        }

        for (const stockItem of validImportedStock) {
            const stockRef = doc(collection(db, 'stock'));
            writeOpBatch.set(stockRef, cleanForFirebase(sanitizeStockItem(stockItem as Stock)));
            operationCount++;
            await commitCurrentBatchIfNeeded();
        }
        
        if (operationCount > 0) {
            await writeOpBatch.commit();
        }

        setImportModalOpen(false);
        
        if (skippedStockEntries.length > 0) {
            const skippedSummary = skippedStockEntries.slice(0, 5).map(s => `Item '${s.itemId}' for location '${s.locationName}'`).join('\n');
            alert(`Data imported, but ${skippedStockEntries.length} stock entries were skipped due to unrecognized warehouse locations.\n\nExamples:\n${skippedSummary}\n\nPlease use one of the predefined locations: ${locations.map(l=>l.name).join(', ')}.`);
        } else {
            alert('Data imported successfully!');
        }
    }, [locations]);

    const handleBulkUpdate = useCallback(async (changes: { description?: string; category?: string; subCategory?: string; }) => {
        const batch = writeBatch(db);
        selectedItemIds.forEach(itemId => {
            const itemRef = doc(db, 'inventory', itemId);
            batch.update(itemRef, changes);
        });
        await batch.commit();
        setBulkEditModalOpen(false);
        setSelectedItemIds(new Set());
    }, [selectedItemIds]);

    const handleSelectionChange = useCallback((itemId: string) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(itemId)) newSet.delete(itemId);
            else newSet.add(itemId);
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback((itemIds: string[], select: boolean) => {
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            itemIds.forEach(id => select ? newSet.add(id) : newSet.delete(id));
            return newSet;
        });
    }, []);

    const generateReportData = useCallback((itemsToReport: InventoryItem[]): ReportDataItem[] => {
        const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));
        const report: ReportDataItem[] = [];
        itemsToReport.forEach(item => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            if (itemStock.length > 0) {
                itemStock.forEach(s => report.push({ ...item, locationName: locationMap.get(s.locationId) || 'Unknown', ...s }));
            } else {
                report.push({ ...item, locationName: 'N/A', quantity: 0, source: 'OH' });
            }
        });
        return report;
    }, [stock, locations]);

    const handleGenerateReport = useCallback((options: { type: 'all' | 'category' | 'selected' | 'single' | 'low-alert', value?: string }) => {
        let itemsToReport: InventoryItem[] = [];
        switch(options.type) {
            case 'all': itemsToReport = items; break;
            case 'category': itemsToReport = items.filter(i => (i.category || 'Uncategorized') === options.value); break;
            case 'selected': itemsToReport = items.filter(i => selectedItemIds.has(i.id)); break;
            case 'single': itemsToReport = items.filter(i => i.id === options.value); break;
            case 'low-alert': {
                const stockMap = new Map<string, number>();
                stock.forEach(s => {
                    stockMap.set(s.itemId, (stockMap.get(s.itemId) || 0) + s.quantity);
                });
                itemsToReport = items.filter(i => {
                    const total = stockMap.get(i.id) || 0;
                    return i.lowAlertQuantity !== undefined && total <= i.lowAlertQuantity;
                });
                break;
            }
        }
        if (itemsToReport.length === 0) { alert("No items to report."); return; }
        setReportData(generateReportData(itemsToReport));
        setReportModalOpen(false);
    }, [items, stock, selectedItemIds, generateReportData]);

    const handleExportAllListings = useCallback(() => {
        if (items.length === 0) {
            alert("No inventory to export.");
            return;
        }

        const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));
        const dataToExport: Record<string, unknown>[] = [];
        const ALL_YEARS = [2021, 2022, 2023, 2024, 2025];
        
        const headers = [
            'ID', 'DESCRIPTION', 'CATEGORY', 'SUB_CATEGORY', 'LOW_ALERT_QTY', 'PRICE',
            ...ALL_YEARS.map(y => `USAGE_${y}`),
            'AVG_USAGE', 'ETR', 'LOCATION', 'SUB_LOCATION', 'QTY', 'SOURCE', 'PO_NUMBER', 'DATE_RECEIVED'
        ];

        items.forEach((item: InventoryItem) => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            const totalQty = itemStock.reduce((sum, s) => sum + s.quantity, 0);
            
            const averageUsage = calculateAverageUsage(item.priorUsage);
            const etr = averageUsage > 0 && totalQty > 0
                ? `${((totalQty / (averageUsage / 12))).toFixed(1)} MONTHS`
                : 'N/A';

            const usageData: { [key: string]: number | string } = {};
            ALL_YEARS.forEach(year => {
                const usageEntry = item.priorUsage?.find(u => u.year === year);
                usageData[`USAGE_${year}`] = usageEntry ? usageEntry.usage : '';
            });

            const baseData = {
                'ID': item.id,
                'DESCRIPTION': item.description,
                'CATEGORY': item.category || '',
                'SUB_CATEGORY': item.subCategory || '',
                'LOW_ALERT_QTY': item.lowAlertQuantity ?? '',
                'PRICE': item.price ?? '',
                ...(usageData as any),
                'AVG_USAGE': averageUsage > 0 ? averageUsage.toFixed(0) : '',
                'ETR': etr,
            };

            if (itemStock.length > 0) {
                itemStock.forEach(s => {
                    dataToExport.push({
                        ...baseData,
                        'LOCATION': locationMap.get(s.locationId) || s.locationId,
                        'SUB_LOCATION': s.subLocationDetail || '',
                        'QTY': s.quantity,
                        'SOURCE': s.source,
                        'PO_NUMBER': s.poNumber || '',
                        'DATE_RECEIVED': s.dateReceived || '',
                    });
                });
            } else {
                dataToExport.push({
                    ...baseData,
                    'LOCATION': '',
                    'SUB_LOCATION': '',
                    'QTY': 0,
                    'SOURCE': 'OH',
                    'PO_NUMBER': '',
                    'DATE_RECEIVED': '',
                });
            }
        });
        
        const formatCsvField = (field: unknown) => {
            const str = String(field ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(row => headers.map(header => formatCsvField(row[header])).join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'inventory_listings.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [items, stock, locations]);

    const lowAlertItemCount = useMemo(() => {
        const stockMap = new Map<string, number>();
        stock.forEach(s => {
            stockMap.set(s.itemId, (stockMap.get(s.itemId) || 0) + s.quantity);
        });
        return items.filter(i => {
            const total = stockMap.get(i.id) || 0;
            return i.lowAlertQuantity !== undefined && total <= i.lowAlertQuantity;
        }).length;
    }, [items, stock]);

    const handleScanSuccess = useCallback((result: string) => {
        // Priority 1: Check for Direct Location Match (Specific Bin)
        const locationMatch = stock.find(s => s.locationBarcode === result);
        
        if (locationMatch) {
            const item = items.find(i => i.id === locationMatch.itemId);
            if (item) {
                handleOpenMoveModal(item, locationMatch.locationId);
                setScannerOpen(false);
                showToast("Location barcode scanned. Ready to move stock.", "success");
                return;
            }
        }

        // Priority 2: Check for Product Match (Item ID)
        const itemMatch = items.find(i => i.id === result);
        
        if (itemMatch) {
             const itemStock = stock.filter(s => s.itemId === itemMatch.id);
             
             if (itemStock.length === 1) {
                 // Single location: Auto-select it
                 handleOpenMoveModal(itemMatch, itemStock[0].locationId);
                 setScannerOpen(false);
                 showToast("Item found. Ready to move stock.", "success");
             } else {
                 // Multiple locations: Show details/search to let user pick
                 setSearchQuery(result);
                 setIsSearchVisible(true);
                 setScannerOpen(false);
                 showToast("Multiple locations found. Please select one.", "success");
             }
             return;
        }

        // Fallback: Just search for the string
        setSearchQuery(result);
        setIsSearchVisible(true);
        setScannerOpen(false);
        showToast("Scanned code not found. Searching...", "success");

    }, [stock, items, handleOpenMoveModal, showToast]);

    const handleFilterChange = (type: 'category' | 'location', value: string) => {
        setFilterLowStock(false); // Clear low stock filter when selecting other filters
        if (type === 'category') {
            setFilterCategory(value);
            setFilterLocation(''); // Clear location filter
        } else {
            setFilterLocation(value);
            setFilterCategory(''); // Clear category filter
        }
        setCurrentView('all'); // Always switch to 'all' list view when filtering specifically
    };

    const handleClearFilters = () => {
        setFilterCategory('');
        setFilterLocation('');
        setFilterLowStock(false);
        setCurrentView('all');
    };

    // Derived view state for mobile: if in 'inventory' tab or desktop, show table
    const showTable = mobileView === 'inventory' || window.innerWidth >= 768; // Simple check, but react render will handle media query classes mostly
    const showStats = mobileView === 'dashboard' || window.innerWidth >= 768;

    return (
        <div className="min-h-screen bg-stone-50 text-neutral-900 pb-24 md:pb-0 font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Sticky Top Section (Header + Nav) */}
            <div className="sticky top-0 z-40 bg-stone-50 shadow-md">
                <Header
                    onAddItemClick={() => setAddItemModalOpen(true)}
                    onImportClick={() => setImportModalOpen(true)}
                    onExportClick={handleExportAllListings}
                    onReportClick={() => setReportModalOpen(true)}
                    onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
                    onSearchClick={() => setIsSearchVisible(prev => !prev)}
                    onScanClick={() => setScannerOpen(true)}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                />
                
                <NavigationView 
                    items={items}
                    locations={locations}
                    onFilterChange={(type, value) => {
                         handleFilterChange(type, value);
                         setMobileView('inventory');
                    }}
                    onClearFilters={handleClearFilters}
                    onViewChange={(view) => {
                        setCurrentView(view);
                        setMobileView('inventory');
                    }}
                    currentView={currentView}
                    isMobileMenuOpen={isMobileMenuOpen}
                    onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
                    onImportClick={() => setImportModalOpen(true)}
                    onExportClick={handleExportAllListings}
                    onReportClick={() => setReportModalOpen(true)}
                    onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
                />

                {isSearchVisible && (
                    <div className="bg-white border-t border-gray-300 animate-fade-in-down">
                        <div className="fluid-container py-3">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><MagnifyingGlassIcon className="h-5 w-5 text-gray-400" /></div>
                                <input 
                                    type="text" 
                                    className="form-control pl-10 border-gray-400 focus:border-red-800" 
                                    placeholder="SEARCH BY ID, DESCRIPTION, OR CATEGORY..." 
                                    value={searchQuery} 
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <main className="fluid-container py-4 md:py-8">
                {/* Dashboard Stats - Only visible if Dashboard tab is active on mobile, or always on desktop */}
                <div className={`${mobileView === 'dashboard' ? 'block' : 'hidden'} md:block`}>
                    <StatsOverview 
                        items={items} 
                        stock={stock}
                        locations={locations}
                        currentView={currentView}
                        onSetFilterLocation={setFilterLocation}
                        onLowStockClick={() => {
                            setFilterLowStock(true);
                            setFilterCategory('');
                            setFilterLocation('');
                            setCurrentView('all');
                            setMobileView('inventory');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onAddItemClick={() => setAddItemModalOpen(true)}
                        onReportClick={() => setReportModalOpen(true)}
                        onBarcodeClick={() => setGenerateBarcodeSheetModalOpen(true)}
                        onLocationsClick={() => {
                             setCurrentView('locations');
                             setMobileView('inventory');
                             window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onActivityClick={() => {
                             showToast("No recent activity.", "success");
                        }}
                    />
                </div>

                 {isLoading ? (
                    <div className="text-center py-20">
                        <svg className="mx-auto h-12 w-12 text-gray-400 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <h3 className="mt-4 text-lg font-bold text-gray-900 uppercase tracking-widest">CONNECTING TO DATABASE...</h3>
                    </div>
                ) : (
                    <div className={`${mobileView === 'inventory' ? 'block' : 'hidden'} md:block`}>
                        <InventoryTable
                            items={items}
                            locations={locations}
                            stock={stock}
                            onMoveClick={handleOpenMoveModal}
                            onDeleteClick={handleDeleteItem}
                            onDuplicateClick={handleOpenDuplicateModal}
                            onEditClick={handleOpenEditModal}
                            onPrintBarcode={handlePrintSingleItemBarcodes}
                            onPrintSpecificLabel={handlePrintSpecificLabel}
                            selectedItemIds={selectedItemIds}
                            onSelectionChange={handleSelectionChange}
                            onSelectAll={handleSelectAll}
                            onGenerateReportForItem={(itemId) => handleGenerateReport({ type: 'single', value: itemId })}
                            categoryColors={categoryColors}
                            onBulkEditClick={() => setBulkEditModalOpen(true)}
                            view={currentView}
                            searchQuery={searchQuery}
                            filterCategory={filterCategory}
                            filterLocation={filterLocation}
                            filterLowStock={filterLowStock}
                            onSetFilterCategory={setFilterCategory}
                            onSetFilterLocation={setFilterLocation}
                            onSetFilterLowStock={setFilterLowStock}
                            onViewChange={setCurrentView}
                        />
                    </div>
                )}
            </main>

            {/* Mobile Fixed Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t-2 border-em-red h-16 z-50 flex items-center justify-around shadow-2xl">
                <button 
                    onClick={() => setMobileView('dashboard')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileView === 'dashboard' ? 'text-em-red' : 'text-neutral-400 hover:text-white'}`}
                >
                    <HomeIcon className={`w-6 h-6 ${mobileView === 'dashboard' ? 'stroke-2' : 'stroke-1.5'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
                </button>

                <div className="relative -top-6">
                    <button 
                        onClick={() => setScannerOpen(true)}
                        className="bg-em-red hover:bg-red-700 text-white p-4 rounded-full shadow-lg border-4 border-stone-50 active:scale-95 transition-transform"
                    >
                        <CameraIcon className="w-8 h-8" />
                    </button>
                </div>

                <button 
                    onClick={() => setMobileView('inventory')}
                    className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileView === 'inventory' ? 'text-em-red' : 'text-neutral-400 hover:text-white'}`}
                >
                    <ListBulletIcon className={`w-6 h-6 ${mobileView === 'inventory' ? 'stroke-2' : 'stroke-1.5'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Inventory</span>
                </button>
            </div>

            {isAddItemModalOpen && <AddItemModal onClose={handleCloseAddItemModal} onAddItem={handleAddItem} locations={locations} existingItemIds={items.map(i => i.id)} itemToDuplicate={itemToDuplicate} currentCategoryColors={categoryColors} onShowToast={showToast} />}
            {isEditModalOpen && itemToEdit && <EditItemModal item={itemToEdit} stock={stock.filter(s => s.itemId === itemToEdit.id)} locations={locations} onClose={handleCloseEditModal} onEditItem={handleEditItem} onPrintSpecificLabel={handlePrintSpecificLabel} currentCategoryColors={categoryColors} fieldToFocus={fieldToFocus} />}
            {isMoveModalOpen && itemToMove && <MoveStockModal item={itemToMove} locations={locations} stock={stock} onClose={() => setMoveModalOpen(false)} onMoveStock={handleMoveStock} />}
            {isImportModalOpen && <ImportDataModal onClose={() => setImportModalOpen(false)} onImport={handleImportData} />}
            {isReportModalOpen && <GenerateReportModal onClose={() => setReportModalOpen(false)} onGenerate={handleGenerateReport} items={items} selectedItemCount={selectedItemIds.size} lowAlertItemCount={lowAlertItemCount}/>}
            {reportData && <ReportPreviewModal reportData={reportData} onClose={() => setReportData(null)} onPrintSpecificLabel={handlePrintSpecificLabel}/>}
            {isBulkEditModalOpen && <BulkEditModal onClose={() => setBulkEditModalOpen(false)} onSaveChanges={handleBulkUpdate} selectedItemCount={selectedItemIds.size}/>}
            {isScannerOpen && <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScanSuccess} />}
            {printableLabels && <BarcodeSheetModal labels={printableLabels} onClose={() => setPrintableLabels(null)} />}
            {isGenerateBarcodeSheetModalOpen && <GenerateBarcodeSheetModal onClose={() => setGenerateBarcodeSheetModalOpen(false)} onGenerate={handleGenerateBarcodeSheet} items={items} stock={stock} locations={locations} selectedItemIds={selectedItemIds} />}
            {isSelectLocationModalOpen && itemForLocationSelect && <SelectPrintLocationModal isOpen={isSelectLocationModalOpen} onClose={() => setSelectLocationModalOpen(false)} onGenerate={handlePrintSpecificLabel} item={itemForLocationSelect.item} stockLocations={itemForLocationSelect.stock} locations={locations} />}
        </div>
    );
};

export default App;
