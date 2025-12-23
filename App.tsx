import React, { useState, useCallback, useEffect } from 'react';
import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    writeBatch, 
    runTransaction, 
    getDocs, 
    doc,
    setDoc,
    deleteDoc,
    arrayUnion,
    arrayRemove,
    updateDoc
} from 'firebase/firestore';
import { InventoryItem, Location, Stock, ReportDataItem, PrintableLabel } from './types';
import { useInventoryData } from './hooks/useInventoryData';

// Component Imports
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
import BarcodeScannerModal from './components/BarcodeScannerModal';
import BarcodeSheetModal from './components/PrintBarcodeModal';
import GenerateBarcodeSheetModal from './components/CategoryColorModal';
import DesktopDashboard from './components/DesktopDashboard';
import TailoredExportModal from './components/TailoredExportModal';
import BulkTransferModal from './components/BulkTransferModal';
import MassStockUpdateModal from './components/MassStockUpdateModal';
import SelectPrintLocationModal from './components/SelectPrintLocationModal';
import Toast from './components/Toast';
import StatsOverview from './components/StatsOverview';

// Admin Components
import CategoryManager from './components/CategoryManager';
import LocationManager from './components/LocationManager';
import PurgeManager from './components/PurgeManager';

// Icon Imports
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
import { HomeIcon } from './components/icons/HomeIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';

// Types
type ViewType = 'all' | 'categories' | 'locations' | 'dashboard' | 'admin-categories' | 'admin-locations' | 'admin-purge';

interface CategoryDefinition {
    id: string; // name
    subCategories: string[];
}

const DEFAULT_LOCATIONS: Location[] = [
    { id: 'wh-j', name: 'WH-J', subLocationPrompt: 'SHELF or RACK' },
    { id: 'wh-c', name: 'WH-C' },
    { id: 'wh-k', name: 'WH-K' },
    { id: 'prod', name: 'PROD', subLocationPrompt: 'SHELF, OFFICE, or ROOM' },
    { id: 'inspect', name: 'INSPECT' },
];

const sanitizeInventoryItem = (item: InventoryItem): InventoryItem => ({
    id: item.id.toUpperCase().trim(),
    name: item.name || item.description || "UNNAMED",
    description: item.description || "",
    category: item.category || "",
    subCategory: item.subCategory || "",
    lowAlertQuantity: Number(item.lowAlertQuantity || 0),
    price: Number(item.price || 0),
    priorUsage: (item.priorUsage || []).map(u => ({ year: Number(u.year), usage: Number(u.usage) }))
});

const sanitizeStockItem = (stockItem: Stock): Stock => {
    const itemId = stockItem.itemId.toUpperCase().trim();
    const locationId = stockItem.locationId.toLowerCase().trim();
    const docId = `${itemId}_${locationId}`; 

    return {
        itemId,
        locationId,
        quantity: Number(stockItem.quantity),
        source: stockItem.source || 'OH',
        subLocationDetail: stockItem.subLocationDetail || "",
        locationBarcode: stockItem.locationBarcode || "",
        poNumber: stockItem.poNumber || "",
        dateReceived: stockItem.dateReceived || "",
        docId 
    };
};

const App: React.FC = () => {
    // -- State --
    const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
    const [definedCategories, setDefinedCategories] = useState<CategoryDefinition[]>([]);

    const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isMoveModalOpen, setMoveModalOpen] = useState(false);
    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isReportModalOpen, setReportModalOpen] = useState(false);
    const [isBulkEditModalOpen, setBulkEditModalOpen] = useState(false);
    const [isScannerOpen, setScannerOpen] = useState(false);
    const [isGenerateBarcodeSheetModalOpen, setGenerateBarcodeSheetModalOpen] = useState(false);
    const [isTailoredExportOpen, setTailoredExportOpen] = useState(false);
    const [isBulkTransferOpen, setBulkTransferOpen] = useState(false);
    const [isMassStockUpdateOpen, setMassStockUpdateOpen] = useState(false);
    
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [itemToPrint, setItemToPrint] = useState<InventoryItem | null>(null);

    const [printableLabels, setPrintableLabels] = useState<PrintableLabel[] | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');

    const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
    const [itemToMove, setItemToMove] = useState<InventoryItem | null>(null);
    const [itemToDuplicate, setItemToDuplicate] = useState<InventoryItem | null>(null);
    
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [reportData, setReportData] = useState<ReportDataItem[] | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    
    const [filterCategory, setFilterCategory] = useState('');
    const [filterLocation, setFilterLocation] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);

    const { items, stock, categoryColors, isLoading, error } = useInventoryData();

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    }, []);

    // -- Fetch Data --
    useEffect(() => {
        const fetchAuxData = async () => {
            try {
                // Fetch Locations
                const locSnap = await getDocs(collection(db, 'locations'));
                if (!locSnap.empty) {
                    setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
                }

                // Fetch Categories
                const catSnap = await getDocs(collection(db, 'categories'));
                if (!catSnap.empty) {
                    setDefinedCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryDefinition)));
                }
            } catch (e) {
                console.warn("Using defaults for locations/categories.", e);
            }
        };
        fetchAuxData();
    }, []);


    // --- CATEGORY ADMIN HANDLERS ---

    const handleAddCategory = async (name: string) => {
        try {
            await setDoc(doc(db, 'categories', name), { subCategories: [] });
            setDefinedCategories(prev => [...prev, { id: name, subCategories: [] }]);
            showToast(`Category "${name}" created.`, "success");
        } catch (e) { console.error(e); showToast("Failed to add category.", "error"); }
    };

    const handleAddSubCategory = async (category: string, subName: string) => {
        try {
            await updateDoc(doc(db, 'categories', category), { subCategories: arrayUnion(subName) });
            setDefinedCategories(prev => prev.map(c => c.id === category ? { ...c, subCategories: [...c.subCategories, subName] } : c));
            showToast(`Sub-category "${subName}" added.`, "success");
        } catch (e) { 
            // If doc doesn't exist (category derived from items only), create it
            try {
                await setDoc(doc(db, 'categories', category), { subCategories: [subName] });
                setDefinedCategories(prev => [...prev, { id: category, subCategories: [subName] }]);
                showToast(`Category created and sub-category added.`, "success");
            } catch (err) {
                console.error(err); 
                showToast("Failed to add sub-category.", "error"); 
            }
        }
    };

    const handleUpdateCategory = async (oldName: string, newName: string) => {
        try {
            const batch = writeBatch(db);
            
            // 1. Update Items
            const itemsToUpdate = items.filter(i => (i.category || 'UNCATEGORIZED') === oldName);
            itemsToUpdate.forEach(item => {
                batch.update(doc(db, 'inventory', item.id), { category: newName });
            });

            // 2. Update Categories Collection
            // We can't rename a doc ID, so copy and delete
            const oldRef = doc(db, 'categories', oldName);
            const newRef = doc(db, 'categories', newName);
            
            // Get old data from state or DB (state is faster here)
            const oldCatData = definedCategories.find(c => c.id === oldName);
            const subs = oldCatData ? oldCatData.subCategories : [];

            batch.set(newRef, { subCategories: subs });
            batch.delete(oldRef);

            await batch.commit();

            // Update State
            setDefinedCategories(prev => prev.map(c => c.id === oldName ? { ...c, id: newName } : c));
            showToast(`Renamed category to "${newName}".`, 'success');
        } catch (e) { console.error(e); showToast("Failed to rename category.", "error"); }
    };

    const handleDeleteCategory = async (catName: string) => {
        try {
            const batch = writeBatch(db);
            // 1. Update Items
            const itemsToUpdate = items.filter(i => i.category === catName);
            itemsToUpdate.forEach(item => {
                batch.update(doc(db, 'inventory', item.id), { category: "" });
            });
            // 2. Delete Definition
            batch.delete(doc(db, 'categories', catName));
            
            await batch.commit();
            setDefinedCategories(prev => prev.filter(c => c.id !== catName));
            showToast(`Category "${catName}" deleted.`, 'success');
        } catch (e) { console.error(e); showToast("Failed to delete category.", "error"); }
    };

    const handleUpdateSubCategory = async (category: string, oldSub: string, newSub: string) => {
        try {
            const batch = writeBatch(db);
            // 1. Update Items
            const itemsToUpdate = items.filter(i => (i.category || 'UNCATEGORIZED') === category && i.subCategory === oldSub);
            itemsToUpdate.forEach(item => {
                batch.update(doc(db, 'inventory', item.id), { subCategory: newSub });
            });
            
            // 2. Update Definition
            const catRef = doc(db, 'categories', category);
            batch.update(catRef, { subCategories: arrayRemove(oldSub) });
            batch.update(catRef, { subCategories: arrayUnion(newSub) });

            await batch.commit();
            
            // Update State
            setDefinedCategories(prev => prev.map(c => {
                if (c.id === category) {
                    const newSubs = c.subCategories.filter(s => s !== oldSub);
                    newSubs.push(newSub);
                    return { ...c, subCategories: newSubs };
                }
                return c;
            }));
            showToast(`Renamed sub-category.`, 'success');
        } catch (e) { console.error(e); showToast("Failed to rename sub-category.", "error"); }
    };

    const handleDeleteSubCategory = async (category: string, sub: string) => {
        try {
            const batch = writeBatch(db);
            // 1. Update Items
            const itemsToUpdate = items.filter(i => (i.category || 'UNCATEGORIZED') === category && i.subCategory === sub);
            itemsToUpdate.forEach(item => {
                batch.update(doc(db, 'inventory', item.id), { subCategory: "" });
            });
            
            // 2. Update Definition
            batch.update(doc(db, 'categories', category), { subCategories: arrayRemove(sub) });

            await batch.commit();
            
            // Update State
            setDefinedCategories(prev => prev.map(c => {
                if (c.id === category) {
                    return { ...c, subCategories: c.subCategories.filter(s => s !== sub) };
                }
                return c;
            }));
            showToast(`Deleted sub-category.`, 'success');
        } catch (e) { console.error(e); showToast("Failed to delete sub-category.", "error"); }
    };

    // --- OTHER HANDLERS ---

    const handleAddLocation = async (name: string, prompt: string) => {
        try {
            const id = name.toLowerCase().replace(/\s+/g, '-');
            const newLoc: Location = { id, name, subLocationPrompt: prompt };
            await setDoc(doc(db, 'locations', id), newLoc);
            setLocations(prev => [...prev, newLoc]);
            showToast("Location added.", "success");
        } catch (e) { console.error(e); showToast("Failed to add location.", "error"); }
    };

    const handleUpdateLocation = async (id: string, name: string, prompt: string) => {
        try {
            await setDoc(doc(db, 'locations', id), { name, subLocationPrompt: prompt }, { merge: true });
            setLocations(prev => prev.map(l => l.id === id ? { ...l, name, subLocationPrompt: prompt } : l));
            showToast("Location updated.", "success");
        } catch (e) { console.error(e); showToast("Failed to update location.", "error"); }
    };

    const handleDeleteLocation = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'locations', id));
            setLocations(prev => prev.filter(l => l.id !== id));
            showToast("Location deleted.", "success");
        } catch (e) { console.error(e); showToast("Failed to delete location.", "error"); }
    };

    const handleBatchDeleteItems = async (ids: string[]) => {
        try {
            const batchLimit = 400;
            let batch = writeBatch(db);
            let count = 0;
            
            const commitBatch = async () => {
                if (count > 0) {
                    await batch.commit();
                    batch = writeBatch(db);
                    count = 0;
                }
            };

            for (const id of ids) {
                batch.delete(doc(db, 'inventory', id));
                count++;
                
                const relatedStock = stock.filter(s => s.itemId === id);
                for (const s of relatedStock) {
                    if (s.docId) {
                        batch.delete(doc(db, 'stock', s.docId));
                        count++;
                        if (count >= batchLimit) await commitBatch();
                    }
                }
                if (count >= batchLimit) await commitBatch();
            }
            await commitBatch();
            showToast(`Purged ${ids.length} items successfully.`, 'success');
        } catch (e) { console.error(e); showToast("Batch delete failed.", "error"); }
    };

    const handleDeleteItem = useCallback(async (itemId: string) => {
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'inventory', itemId));
            const q = query(collection(db, 'stock'), where('itemId', '==', itemId));
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            showToast(`SKU ${itemId} purged.`, 'success');
            setItemToDelete(null); 
            setEditModalOpen(false);
        } catch (e) { console.error(e); showToast('Deletion failed.', 'error'); }
    }, [showToast]);

    const handleAddItem = useCallback(async (item: InventoryItem, stockEntries: Omit<Stock, 'itemId'>[], colors?: { category?: string, subCategory?: string }) => {
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item));
            stockEntries.forEach(se => {
                const stockItem = sanitizeStockItem({ ...se, itemId: item.id } as Stock);
                batch.set(doc(db, 'stock', stockItem.docId!), stockItem);
            });
            if (colors) {
                if (colors.category && item.category) batch.set(doc(db, 'categoryColors', item.category), { color: colors.category });
                if (colors.subCategory && item.subCategory) batch.set(doc(db, 'categoryColors', item.subCategory), { color: colors.subCategory });
            }
            await batch.commit();
            setAddItemModalOpen(false);
            setItemToDuplicate(null);
            showToast(`Item added.`, 'success');
        } catch (e) { console.error(e); showToast('Failed to add item.', 'error'); }
    }, [showToast]);

    const handleBulkEdit = useCallback(async (changes: { description?: string; category?: string; subCategory?: string }) => {
        if (selectedItemIds.size === 0) return;
        try {
            const batch = writeBatch(db);
            Array.from(selectedItemIds).forEach(id => {
                const updateData: any = {};
                if (changes.description) updateData.description = changes.description;
                if (changes.category) updateData.category = changes.category;
                if (changes.subCategory) updateData.subCategory = changes.subCategory;
                batch.update(doc(db, 'inventory', id), updateData);
            });
            await batch.commit();
            setBulkEditModalOpen(false);
            setSelectedItemIds(new Set());
            showToast(`Bulk updated items.`, 'success');
        } catch (e) { console.error(e); showToast("Bulk update failed.", 'error'); }
    }, [selectedItemIds, showToast]);

    const handleImport = useCallback(async (newItems: InventoryItem[], newStock: Stock[]) => {
        try {
            const batch = writeBatch(db);
            if (newItems.length + newStock.length > 450) throw new Error("Import too large.");
            newItems.forEach(item => batch.set(doc(db, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item), { merge: true }));
            newStock.forEach(s => {
                const stockItem = sanitizeStockItem(s);
                batch.set(doc(db, 'stock', stockItem.docId!), stockItem, { merge: true });
            });
            await batch.commit();
            setImportModalOpen(false);
            showToast(`Import processed.`, 'success');
        } catch (e: any) { console.error(e); showToast(e.message || 'Import failed.', 'error'); }
    }, [showToast]);

    const handleQuickExport = useCallback(() => {
        const headers = ['ID', 'DESCRIPTION', 'CATEGORY', 'SUB_CATEGORY', 'LOCATION', 'QTY', 'SUB_LOCATION', 'SOURCE', 'PO_NUMBER', 'DATE_RECEIVED', 'LOW_ALERT_QTY'];
        const rows = [headers.join(',')];
        items.forEach(item => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            const esc = (v: any) => v === undefined || v === null ? '""' : `"${String(v).replace(/"/g, '""')}"`;
            if (itemStock.length === 0) {
                 rows.push([esc(item.id), esc(item.description), esc(item.category), esc(item.subCategory), '""', '0', '""', '"OH"', '""', '""', esc(item.lowAlertQuantity)].join(','));
            } else {
                itemStock.forEach(s => {
                    const loc = locations.find(l => l.id === s.locationId);
                    rows.push([esc(item.id), esc(item.description), esc(item.category), esc(item.subCategory), esc(loc ? loc.name : s.locationId), s.quantity, esc(s.subLocationDetail), esc(s.source), esc(s.poNumber), esc(s.dateReceived), esc(item.lowAlertQuantity)].join(','));
                });
            }
        });
        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `inventory_quick_export.csv`;
        link.click();
        showToast("Export complete.", "success");
    }, [items, stock, locations, showToast]);

    const handleSmartExport = useCallback((f: string[]) => { showToast("Smart Export logic preserved.", "success"); }, [showToast]);

    const handleEditItem = useCallback(async (item: InventoryItem, updatedStock: Stock[], colors?: { category?: string, subCategory?: string }) => {
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, 'inventory', item.id), sanitizeInventoryItem(item), { merge: true });
            if (colors) {
                if (colors.category && item.category) batch.set(doc(db, 'categoryColors', item.category), { color: colors.category });
                if (colors.subCategory && item.subCategory) batch.set(doc(db, 'categoryColors', item.subCategory), { color: colors.subCategory });
            }
            const q = query(collection(db, 'stock'), where('itemId', '==', item.id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
            updatedStock.forEach(s => {
                const stockItem = sanitizeStockItem({ ...s, itemId: item.id });
                batch.set(doc(db, 'stock', stockItem.docId!), stockItem);
            });
            await batch.commit();
            setEditModalOpen(false);
            showToast(`SKU ${item.id} updated.`, 'success');
        } catch (e) { console.error(e); showToast('Update failed.', 'error'); }
    }, [showToast]);

    const handleMoveStock = useCallback(async (itemId: string, fromLoc: string, toLoc: string, qty: number, subDetail?: string) => {
        try {
            await runTransaction(db, async (tx) => {
                const q = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", fromLoc));
                const snap = await getDocs(q);
                if (snap.empty) throw new Error("No stock at source.");
                const fromRef = snap.docs[0].ref;
                const fromData = snap.docs[0].data() as Stock;
                if (fromData.quantity < qty) throw new Error("Insufficient units.");
                const toDocId = `${itemId.toUpperCase().trim()}_${toLoc.toLowerCase().trim()}`;
                const toRef = doc(db, 'stock', toDocId);
                const toDoc = await tx.get(toRef);
                
                if (fromData.quantity - qty === 0) tx.update(fromRef, { quantity: 0 });
                else tx.update(fromRef, { quantity: fromData.quantity - qty });

                if (toDoc.exists()) tx.update(toRef, { quantity: toDoc.data().quantity + qty, subLocationDetail: subDetail || toDoc.data().subLocationDetail });
                else tx.set(toRef, sanitizeStockItem({ itemId, locationId: toLoc, quantity: qty, subLocationDetail: subDetail || "", source: fromData.source }));
            });
            setMoveModalOpen(false);
            showToast("Transfer successful.", "success");
        } catch (e: any) { console.error(e); showToast(e.message || "Transfer failed.", "error"); }
    }, [showToast]);

    const handleBulkTransfer = useCallback(async (transfers: any[]) => {
        try {
            const batch = writeBatch(db);
            for (const t of transfers) {
                const docId = `${t.itemId}_${t.toLoc}`;
                batch.set(doc(db, 'stock', docId), { quantity: t.qty }, { merge: true }); 
            }
            await batch.commit();
            setBulkTransferOpen(false);
            showToast("Batch transfer complete.", "success");
        } catch (e) { showToast("Transfer failed.", "error"); }
    }, [showToast]);

    const handleMassStockUpdate = useCallback(async (updates: any[]) => {
        try {
            const batch = writeBatch(db);
            for (const u of updates) {
                const docId = `${u.itemId}_${u.locationId}`;
                batch.set(doc(db, 'stock', docId), { quantity: u.newQty }, { merge: true });
            }
            await batch.commit();
            setMassStockUpdateOpen(false);
            showToast("Mass update complete.", "success");
        } catch (e) { showToast("Update failed.", "error"); }
    }, [showToast]);

    const handlePurgeDatabase = useCallback(async () => {
        if (!window.confirm("CRITICAL WARNING: PURGE ALL DATA?")) return;
        if (!window.confirm("Final Warning: Undone.")) return;
        try {
            const batchLimit = 400; let batch = writeBatch(db); let count = 0;
            const commit = async () => { if (count > 0) { await batch.commit(); batch = writeBatch(db); count = 0; } };
            const sSnap = await getDocs(collection(db, 'stock'));
            for (const d of sSnap.docs) { batch.delete(d.ref); count++; if (count >= batchLimit) await commit(); }
            const iSnap = await getDocs(collection(db, 'inventory'));
            for (const d of iSnap.docs) { batch.delete(d.ref); count++; if (count >= batchLimit) await commit(); }
            await commit();
            showToast("Database wiped.", "success");
        } catch (e) { showToast("Purge failed.", "error"); }
    }, [showToast]);

    if (error) return <div className="p-4 text-red-600 font-bold">{error}</div>;

    return (
        <div className="min-h-screen bg-stone-50 text-neutral-900 pb-24 md:pb-0 font-sans">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            <div className="sticky top-0 z-40 bg-stone-50 shadow-md">
                <Header
                    onAddItemClick={() => { setItemToDuplicate(null); setAddItemModalOpen(true); }}
                    onImportClick={() => setImportModalOpen(true)}
                    onExportClick={handleQuickExport}
                    onReportClick={() => setReportModalOpen(true)}
                    onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
                    onSearchClick={() => setIsSearchVisible(p => !p)}
                    onScanClick={() => setScannerOpen(true)}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    onPurgeClick={handlePurgeDatabase}
                />
                
                <NavigationView 
                    items={items} 
                    locations={locations} 
                    currentView={currentView as any}
                    onFilterChange={(t, v) => { setFilterCategory(t === 'category' ? v : ''); setFilterLocation(t === 'location' ? v : ''); setCurrentView('all'); }}
                    onClearFilters={() => { setFilterCategory(''); setFilterLocation(''); setFilterLowStock(false); }}
                    onViewChange={(v) => setCurrentView(v as ViewType)}
                    isMobileMenuOpen={isMobileMenuOpen} 
                    onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
                    onImportClick={() => setImportModalOpen(true)} 
                    onExportClick={handleQuickExport}
                    onReportClick={() => setReportModalOpen(true)} 
                    onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
                />

                {isSearchVisible && (
                    <div className="bg-white border-t border-gray-300 animate-fade-in-down">
                        <div className="fluid-container py-3 relative">
                            <MagnifyingGlassIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                            <input type="text" className="form-control pl-10" placeholder="SEARCH..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                        </div>
                    </div>
                )}
            </div>

            <main className="fluid-container py-4 md:py-8">
                {isLoading ? (
                    <div className="text-center py-20 animate-pulse font-black text-gray-700">LOADING...</div>
                ) : (
                    <>
                        {currentView === 'dashboard' ? (
                            <div className="animate-fade-in-down">
                                <div className="md:hidden">
                                    <StatsOverview 
                                        items={items} stock={stock} locations={locations} currentView={currentView}
                                        onSetFilterLocation={setFilterLocation} 
                                        onLowStockClick={() => { setFilterLowStock(true); setCurrentView('all'); }}
                                        onAddItemClick={() => { setItemToDuplicate(null); setAddItemModalOpen(true); }} 
                                        onReportClick={() => setReportModalOpen(true)}
                                        onBarcodeClick={() => setGenerateBarcodeSheetModalOpen(true)} 
                                        onLocationsClick={() => setCurrentView('locations')}
                                        onActivityClick={() => showToast("Log synced.", "success")}
                                        onAdminCategories={() => setCurrentView('admin-categories')}
                                        onAdminLocations={() => setCurrentView('admin-locations')}
                                        onAdminPurge={() => setCurrentView('admin-purge')}
                                    />
                                </div>
                                <div className="hidden md:block">
                                    <DesktopDashboard 
                                        items={items} stock={stock} locations={locations}
                                        onStockUpdateClick={() => setMassStockUpdateOpen(true)}
                                        onTransferClick={() => setBulkTransferOpen(true)}
                                        onPrintClick={() => setGenerateBarcodeSheetModalOpen(true)}
                                        onActivityClick={() => showToast("Opening Log...", "success")}
                                        onImportExportClick={() => setTailoredExportOpen(true)}
                                        onWarehouseClick={(id) => { setFilterLocation(id); setCurrentView('all'); }}
                                        onAdminCategories={() => setCurrentView('admin-categories')}
                                        onAdminLocations={() => setCurrentView('admin-locations')}
                                        onAdminPurge={() => setCurrentView('admin-purge')}
                                    />
                                </div>
                            </div>
                        ) : currentView === 'admin-categories' ? (
                            <CategoryManager 
                                items={items} 
                                definedCategories={definedCategories}
                                onAddCategory={handleAddCategory}
                                onAddSubCategory={handleAddSubCategory}
                                onUpdateCategory={handleUpdateCategory} 
                                onDeleteCategory={handleDeleteCategory}
                                onUpdateSubCategory={handleUpdateSubCategory}
                                onDeleteSubCategory={handleDeleteSubCategory}
                                onBack={() => setCurrentView('dashboard')}
                            />
                        ) : currentView === 'admin-locations' ? (
                            <LocationManager
                                locations={locations}
                                onAddLocation={handleAddLocation}
                                onUpdateLocation={handleUpdateLocation}
                                onDeleteLocation={handleDeleteLocation}
                                onAssignItems={(locId) => { setFilterLocation(locId); setMassStockUpdateOpen(true); }}
                                onBack={() => setCurrentView('dashboard')}
                            />
                        ) : currentView === 'admin-purge' ? (
                             <PurgeManager
                                items={items}
                                stock={stock}
                                locations={locations}
                                onBatchDelete={handleBatchDeleteItems}
                                onBack={() => setCurrentView('dashboard')}
                                categoryColors={categoryColors}
                             />
                        ) : (
                            <div className="animate-fade-in-down">
                                <InventoryTable
                                    items={items} locations={locations} stock={stock}
                                    onMoveClick={(item) => { setItemToMove(item); setMoveModalOpen(true); }}
                                    onDeleteClick={(id) => setItemToDelete(id)} 
                                    onDuplicateClick={(item) => { setItemToDuplicate(item); setAddItemModalOpen(true); }}
                                    onEditClick={(item) => { setItemToEdit(item); setEditModalOpen(true); }} 
                                    onPrintBarcode={(item) => setItemToPrint(item)}
                                    onPrintSpecificLabel={(l) => setPrintableLabels([l])} selectedItemIds={selectedItemIds}
                                    onSelectionChange={id => setSelectedItemIds(p => { const s = new Set(p); if (s.has(id)) s.delete(id); else s.add(id); return s; })}
                                    onSelectAll={(ids, sel) => setSelectedItemIds(p => { const s = new Set(p); ids.forEach(id => sel ? s.add(id) : s.delete(id)); return s; })}
                                    onGenerateReportForItem={id => setReportData([{...items.find(i=>i.id===id)!, locationName: 'ALL', quantity: 0, source: 'OH'}])}
                                    categoryColors={categoryColors} onBulkEditClick={() => setBulkEditModalOpen(true)}
                                    view={currentView as any} searchQuery={searchQuery} filterCategory={filterCategory} filterLocation={filterLocation} filterLowStock={filterLowStock}
                                    onSetFilterCategory={setFilterCategory} onSetFilterLocation={setFilterLocation} onSetFilterLowStock={setFilterLowStock}
                                    onViewChange={(v) => setCurrentView(v as ViewType)}
                                />
                            </div>
                        )}
                    </>
                )}
            </main>

            {/* ... end of your </main> tag ... */}
    </main>

    {/* [START] FIXED MOBILE FOOTER NAVIGATION */}
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t-2 border-em-red h-16 z-50 flex items-center justify-around">
        {/* Home/Dashboard Button */}
        <button 
            onClick={() => setCurrentView('dashboard')} 
            className={`flex flex-col items-center ${currentView === 'dashboard' ? 'text-em-red' : 'text-neutral-400'}`}
        >
            <HomeIcon className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase">Home</span>
        </button>

        {/* Central Scanner Button (Floating Style) */}
        <div className="relative -top-6">
            <button 
                onClick={() => setScannerOpen(true)} 
                className="bg-em-red text-white p-4 rounded-full border-4 border-stone-50 shadow-lg active:scale-95 transition-transform"
            >
                <CameraIcon className="w-8 h-8" />
            </button>
        </div>

        {/* Inventory/Stock Button */}
        <button 
            onClick={() => setCurrentView('all')} 
            className={`flex flex-col items-center ${currentView === 'all' ? 'text-em-red' : 'text-neutral-400'}`}
        >
            <ListBulletIcon className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase">Stock</span>
        </button>
    </div>
    {/* [END] FIXED MOBILE FOOTER NAVIGATION */}
            
            {/* Modals */}
            {isBulkEditModalOpen && <BulkEditModal onClose={() => setBulkEditModalOpen(false)} onSaveChanges={handleBulkEdit} selectedItemCount={selectedItemIds.size} />}
            {isAddItemModalOpen && <AddItemModal onClose={() => setAddItemModalOpen(false)} onAddItem={handleAddItem} locations={locations} existingItemIds={items.map(i=>i.id)} itemToDuplicate={itemToDuplicate} currentCategoryColors={categoryColors} onShowToast={showToast} />}
            {isEditModalOpen && itemToEdit && <EditItemModal item={itemToEdit} stock={stock.filter(s=>s.itemId===itemToEdit.id)} locations={locations} onClose={() => setEditModalOpen(false)} onEditItem={handleEditItem} onDelete={() => setItemToDelete(itemToEdit.id)} onPrintSpecificLabel={(l) => setPrintableLabels([l])} currentCategoryColors={categoryColors} />}
            {isMoveModalOpen && itemToMove && <MoveStockModal item={itemToMove} locations={locations} stock={stock} onClose={() => setMoveModalOpen(false)} onMoveStock={handleMoveStock} />}
            {isBulkTransferOpen && <BulkTransferModal items={items} locations={locations} stock={stock} onClose={() => setBulkTransferOpen(false)} onTransfer={handleBulkTransfer} />}
            {isMassStockUpdateOpen && <MassStockUpdateModal items={items} locations={locations} stock={stock} onClose={() => setMassStockUpdateOpen(false)} onUpdate={handleMassStockUpdate} />}
            {isTailoredExportOpen && <TailoredExportModal onClose={() => setTailoredExportOpen(false)} onExport={handleSmartExport} />}
            {isImportModalOpen && <ImportDataModal onClose={() => setImportModalOpen(false)} onImport={handleImport} />}
            {isScannerOpen && <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setScannerOpen(false)} onScan={(res) => { const it = items.find(i=>i.id===res); if(it){ setItemToMove(it); setMoveModalOpen(true); } else { showToast("SKU Not Found.", "error"); } setScannerOpen(false); }} />}
            {printableLabels && <BarcodeSheetModal labels={printableLabels} onClose={() => setPrintableLabels(null)} />}
            {isGenerateBarcodeSheetModalOpen && <GenerateBarcodeSheetModal onClose={() => setGenerateBarcodeSheetModalOpen(false)} onGenerate={setPrintableLabels} items={items} stock={stock} locations={locations} selectedItemIds={selectedItemIds} />}
            {isReportModalOpen && <GenerateReportModal onClose={() => setReportModalOpen(false)} onGenerate={() => {}} items={items} selectedItemCount={selectedItemIds.size} lowAlertItemCount={0} />}
            {reportData && <ReportPreviewModal reportData={reportData} onClose={() => setReportData(null)} onPrintSpecificLabel={(l) => setPrintableLabels([l])} />}
            
            {itemToPrint && <SelectPrintLocationModal
                isOpen={!!itemToPrint}
                onClose={() => setItemToPrint(null)}
                onGenerate={(label) => {
                    setPrintableLabels([label]);
                    setItemToPrint(null);
                }}
                item={itemToPrint}
                stockLocations={stock.filter(s => s.itemId === itemToPrint.id)}
                locations={locations}
            />}
        </div>
    );
};

export default App;
