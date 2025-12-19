import React, { useState, useCallback, useEffect } from 'react';
import { db } from './firebase';
import { 
    collection, 
    onSnapshot, 
    query, 
    where, 
    writeBatch, 
    runTransaction, 
    getDocs, 
    deleteDoc,
    doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
import DesktopDashboard from './components/DesktopDashboard';
import TailoredExportModal from './components/TailoredExportModal';
import BulkTransferModal from './components/BulkTransferModal';
import MassStockUpdateModal from './components/MassStockUpdateModal';
import SelectPrintLocationModal from './components/SelectPrintLocationModal';
import Toast from './components/Toast';
import StatsOverview from './components/StatsOverview';
import { HomeIcon } from './components/icons/HomeIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';

const locations: Location[] = [
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

const sanitizeStockItem = (stockItem: Stock): Stock => ({
    itemId: stockItem.itemId.toUpperCase().trim(),
    locationId: stockItem.locationId,
    quantity: Number(stockItem.quantity),
    source: stockItem.source || 'OH',
    subLocationDetail: stockItem.subLocationDetail || "",
    locationBarcode: stockItem.locationBarcode || "",
    poNumber: stockItem.poNumber || "",
    dateReceived: stockItem.dateReceived || ""
});

const App: React.FC = () => {
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
    const [currentView, setCurrentView] = useState<'all' | 'categories' | 'locations' | 'dashboard'>('dashboard');

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
    const [isLoading, setIsLoading] = useState(true);

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

    useEffect(() => {
        setIsLoading(true);
        const unsubItems = onSnapshot(collection(db, 'inventory'), (snap) => setAppState(p => ({ ...p, items: snap.docs.map(d => d.data() as InventoryItem) })));
        const unsubStock = onSnapshot(collection(db, 'stock'), (snap) => setAppState(p => ({ ...p, stock: snap.docs.map(d => ({...d.data() as Stock, docId: d.id})) })));
        const unsubColors = onSnapshot(collection(db, 'categoryColors'), (snap) => {
            const colors: Record<string, string> = {};
            snap.docs.forEach(d => colors[d.id] = d.data().color);
            setAppState(p => ({ ...p, categoryColors: colors }));
            setIsLoading(false);
        });
        return () => { unsubItems(); unsubStock(); unsubColors(); };
    }, []);
    
    const { items, stock, categoryColors } = appState;

    const handleDeleteItem = useCallback(async (itemId: string) => {
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'inventory', itemId));
            const q = query(collection(db, 'stock'), where('itemId', '==', itemId));
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            
            showToast(`SKU ${itemId} purged from warehouse.`, 'success');
            setItemToDelete(null); 
            setEditModalOpen(false);
            setItemToEdit(null);
        } catch (e: any) {
            console.error(e);
            showToast('Deletion failed. Check database permissions.', 'error');
        }
    }, [showToast]);

    const handleAddItem = useCallback(async (item: InventoryItem, stockEntries: Omit<Stock, 'itemId'>[], colors?: { category?: string, subCategory?: string }) => {
        try {
            const batch = writeBatch(db);
            const itemRef = doc(db, 'inventory', item.id.toUpperCase());
            batch.set(itemRef, sanitizeInventoryItem(item));

            stockEntries.forEach(se => {
                const stockRef = doc(collection(db, 'stock'));
                batch.set(stockRef, sanitizeStockItem({ ...se, itemId: item.id } as Stock));
            });

            if (colors) {
                if (colors.category && item.category) batch.set(doc(db, 'categoryColors', item.category), { color: colors.category });
                if (colors.subCategory && item.subCategory) batch.set(doc(db, 'categoryColors', item.subCategory), { color: colors.subCategory });
            }

            await batch.commit();
            setAddItemModalOpen(false);
            setItemToDuplicate(null);
            showToast(`SKU ${item.id} logged to warehouse database.`, 'success');
        } catch (e: any) {
            console.error(e);
            showToast('Failed to add item. Check permissions.', 'error');
        }
    }, [showToast]);

    const handleImport = useCallback(async (newItems: InventoryItem[], newStock: Stock[]) => {
        try {
            const batch = writeBatch(db);
            
            if (newItems.length + newStock.length > 450) {
                throw new Error("Import manifest too large. Please split into batches of 200 items.");
            }

            newItems.forEach(item => {
                const itemRef = doc(db, 'inventory', item.id.toUpperCase());
                batch.set(itemRef, sanitizeInventoryItem(item), { merge: true });
            });

            newStock.forEach(s => {
                const stockRef = doc(collection(db, 'stock'));
                batch.set(stockRef, sanitizeStockItem(s));
            });

            await batch.commit();
            setImportModalOpen(false);
            showToast(`Manifest Processed: ${newItems.length} items synced.`, 'success');
        } catch (e: any) {
            console.error(e);
            showToast(e.message || 'Import failed. Check CSV format.', 'error');
        }
    }, [showToast]);

    const handleQuickExport = useCallback(() => {
        const headers = ['ID', 'DESCRIPTION', 'CATEGORY', 'SUB_CATEGORY', 'LOCATION', 'QTY', 'SUB_LOCATION', 'SOURCE', 'PO_NUMBER', 'DATE_RECEIVED', 'LOW_ALERT_QTY'];
        const rows = [headers.join(',')];

        items.forEach(item => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            const escapeCsv = (val: string | number | undefined) => {
                if (val === undefined || val === null) return '""';
                return `"${String(val).replace(/"/g, '""')}"`;
            };

            if (itemStock.length === 0) {
                 rows.push([
                    escapeCsv(item.id),
                    escapeCsv(item.description),
                    escapeCsv(item.category),
                    escapeCsv(item.subCategory),
                    '""', // Location
                    '0',
                    '""', // SubLocation
                    '"OH"',
                    '""',
                    '""',
                    escapeCsv(item.lowAlertQuantity || 0)
                 ].join(','));
            } else {
                itemStock.forEach(s => {
                    const loc = locations.find(l => l.id === s.locationId);
                    rows.push([
                        escapeCsv(item.id),
                        escapeCsv(item.description),
                        escapeCsv(item.category),
                        escapeCsv(item.subCategory),
                        escapeCsv(loc ? loc.name : s.locationId),
                        s.quantity,
                        escapeCsv(s.subLocationDetail),
                        escapeCsv(s.source),
                        escapeCsv(s.poNumber),
                        escapeCsv(s.dateReceived),
                        escapeCsv(item.lowAlertQuantity || 0)
                    ].join(','));
                });
            }
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `inventory_quick_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Quick export complete.", "success");
    }, [items, stock, locations, showToast]);

    const handleSmartExport = useCallback((selectedFields: string[]) => {
        const headerMap: Record<string, string> = {
            'category': 'CATEGORY',
            'subCategory': 'SUB_CATEGORY',
            'price': 'UNIT_PRICE',
            'usage_2025': 'USAGE_2025',
            'usage_2024': 'USAGE_2024',
            'usage_2023': 'USAGE_2023',
            'usage_2022': 'USAGE_2022',
            'usage_2021': 'USAGE_2021'
        };

        const activeHeaders = ['ID', 'DESCRIPTION', 'LOCATION', 'QTY'];
        const fieldsToExport = selectedFields.filter(f => headerMap[f]);
        fieldsToExport.forEach(f => activeHeaders.push(headerMap[f]));

        const rows = [activeHeaders.join(',')];

        items.forEach(item => {
            const itemStock = stock.filter(s => s.itemId === item.id);
            const escapeCsv = (val: string | number | undefined) => {
                if (val === undefined || val === null) return '""';
                return `"${String(val).replace(/"/g, '""')}"`;
            };

            const getUsage = (year: number) => {
                const entry = item.priorUsage?.find(u => u.year === year);
                return entry ? entry.usage : 0;
            };

            const generateRow = (locName: string, qty: number) => {
                const rowData = [
                    escapeCsv(item.id),
                    escapeCsv(item.description),
                    escapeCsv(locName),
                    qty.toString()
                ];

                fieldsToExport.forEach(field => {
                    switch(field) {
                        case 'category': rowData.push(escapeCsv(item.category)); break;
                        case 'subCategory': rowData.push(escapeCsv(item.subCategory)); break;
                        case 'price': rowData.push(escapeCsv(item.price)); break;
                        case 'usage_2025': rowData.push(escapeCsv(getUsage(2025))); break;
                        case 'usage_2024': rowData.push(escapeCsv(getUsage(2024))); break;
                        case 'usage_2023': rowData.push(escapeCsv(getUsage(2023))); break;
                        case 'usage_2022': rowData.push(escapeCsv(getUsage(2022))); break;
                        case 'usage_2021': rowData.push(escapeCsv(getUsage(2021))); break;
                    }
                });
                return rowData.join(',');
            };

            if (itemStock.length === 0) {
                rows.push(generateRow('""', 0));
            } else {
                itemStock.forEach(s => {
                    const loc = locations.find(l => l.id === s.locationId);
                    const locName = loc ? loc.name : s.locationId;
                    rows.push(generateRow(locName, s.quantity));
                });
            }
        });

        const csvContent = rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `smart_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTailoredExportOpen(false);
        showToast("Smart Export generated successfully.", "success");
    }, [items, stock, locations, showToast]);

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
                const stockRef = doc(collection(db, 'stock'));
                batch.set(stockRef, sanitizeStockItem({ ...s, itemId: item.id }));
            });

            await batch.commit();
            setEditModalOpen(false);
            setItemToEdit(null);
            showToast(`SKU ${item.id} records updated.`, 'success');
        } catch (e: any) {
            showToast('Failed to sync item updates.', 'error');
        }
    }, [showToast]);

    const handleMoveStock = useCallback(async (itemId: string, fromLoc: string, toLoc: string, qty: number, subDetail?: string) => {
        try {
            await runTransaction(db, async (tx) => {
                const fromQ = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", fromLoc));
                const fromSnap = await getDocs(fromQ);
                if (fromSnap.empty) throw new Error("Source location has zero units.");
                
                const fromRef = fromSnap.docs[0].ref;
                const fromDoc = await tx.get(fromRef);
                const fromData = fromDoc.data() as Stock;
                
                if (fromData.quantity < qty) throw new Error(`Insufficient units at ${fromLoc}.`);

                const toQ = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", toLoc));
                const toSnap = await getDocs(toQ);
                
                tx.update(fromRef, { quantity: fromData.quantity - qty });
                
                if (!toSnap.empty) {
                    tx.update(toSnap.docs[0].ref, { 
                        quantity: (toSnap.docs[0].data() as Stock).quantity + qty, 
                        subLocationDetail: subDetail || (toSnap.docs[0].data() as Stock).subLocationDetail 
                    });
                } else {
                    const newStockRef = doc(collection(db, "stock"));
                    tx.set(newStockRef, sanitizeStockItem({ 
                        itemId, 
                        locationId: toLoc, 
                        quantity: qty, 
                        subLocationDetail: subDetail, 
                        source: fromData.source 
                    } as Stock));
                }
            });
            setMoveModalOpen(false);
            showToast("Inventory transfer successful.", "success");
        } catch (e: any) {
            showToast(e.message || "Transfer failed.", "error");
        }
    }, [showToast]);

    const handleBulkTransfer = useCallback(async (transfers: { itemId: string; fromLoc: string; toLoc: string; qty: number; }[]) => {
        try {
            const batch = writeBatch(db);
            for (const t of transfers) {
                const qFrom = query(collection(db, 'stock'), where('itemId', '==', t.itemId), where('locationId', '==', t.fromLoc));
                const snapFrom = await getDocs(qFrom);
                if (!snapFrom.empty) {
                    const docFrom = snapFrom.docs[0];
                    const currentQty = docFrom.data().quantity;
                    batch.update(docFrom.ref, { quantity: currentQty - t.qty });

                    const qTo = query(collection(db, 'stock'), where('itemId', '==', t.itemId), where('locationId', '==', t.toLoc));
                    const snapTo = await getDocs(qTo);
                    if (!snapTo.empty) {
                        batch.update(snapTo.docs[0].ref, { quantity: snapTo.docs[0].data().quantity + t.qty });
                    } else {
                        const newStockRef = doc(collection(db, 'stock'));
                        batch.set(newStockRef, sanitizeStockItem({ itemId: t.itemId, locationId: t.toLoc, quantity: t.qty, source: 'OH' }));
                    }
                }
            }
            await batch.commit();
            setBulkTransferOpen(false);
            showToast(`Batch transfer complete: ${transfers.length} records processed.`, "success");
        } catch (e) {
            showToast("Bulk transfer failed.", "error");
        }
    }, [showToast]);

    const handleMassStockUpdate = useCallback(async (updates: { itemId: string; locationId: string; newQty: number }[]) => {
        try {
            const batch = writeBatch(db);
            for (const u of updates) {
                const q = query(collection(db, 'stock'), where('itemId', '==', u.itemId), where('locationId', '==', u.locationId));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    batch.update(snap.docs[0].ref, { quantity: u.newQty });
                }
            }
            await batch.commit();
            setMassStockUpdateOpen(false);
            showToast(`Mass audit complete: ${updates.length} items updated.`, "success");
        } catch (e) {
            showToast("Mass update failed.", "error");
        }
    }, [showToast]);

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
                />
                
                <NavigationView 
                    items={items} 
                    locations={locations} 
                    currentView={currentView}
                    onFilterChange={(t, v) => { 
                        setFilterCategory(t === 'category' ? v : ''); 
                        setFilterLocation(t === 'location' ? v : ''); 
                        setCurrentView('all'); 
                    }}
                    onClearFilters={() => { 
                        setFilterCategory(''); 
                        setFilterLocation(''); 
                        setFilterLowStock(false); 
                    }}
                    onViewChange={setCurrentView}
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
                            <input type="text" className="form-control pl-10" placeholder="SEARCH ID, DESCRIPTION, CATEGORY..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
                        </div>
                    </div>
                )}
            </div>

            <main className="fluid-container py-4 md:py-8">
                {isLoading ? (
                    <div className="text-center py-20 animate-pulse uppercase font-black text-gray-700 tracking-widest">ESTABLISHING SECURE CONNECTION...</div>
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
                                        onLocationsClick={() => { setCurrentView('locations'); }}
                                        onActivityClick={() => showToast("Warehouse Log synced.", "success")}
                                    />
                                </div>
                                <div className="hidden md:block">
                                    <DesktopDashboard 
                                        items={items} stock={stock} locations={locations}
                                        onStockUpdateClick={() => setMassStockUpdateOpen(true)}
                                        onTransferClick={() => setBulkTransferOpen(true)}
                                        onPrintClick={() => setGenerateBarcodeSheetModalOpen(true)}
                                        onActivityClick={() => showToast("Opening Warehouse Logs...", "success")}
                                        onImportExportClick={() => setTailoredExportOpen(true)}
                                        onWarehouseClick={(id) => { setFilterLocation(id); setCurrentView('all'); }}
                                    />
                                </div>
                            </div>
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
                                    view={currentView} searchQuery={searchQuery} filterCategory={filterCategory} filterLocation={filterLocation} filterLowStock={filterLowStock}
                                    onSetFilterCategory={setFilterCategory} onSetFilterLocation={setFilterLocation} onSetFilterLowStock={setFilterLowStock}
                                    onViewChange={setCurrentView}
                                />
                            </div>
                        )}
                    </>
                )}
            </main>

            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-neutral-900 border-t-2 border-em-red h-16 z-50 flex items-center justify-around">
                <button onClick={() => setCurrentView('dashboard')} className={`flex flex-col items-center ${currentView === 'dashboard' ? 'text-em-red' : 'text-neutral-400'}`}>
                    <HomeIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Home</span>
                </button>
                <div className="relative -top-6">
                    <button onClick={() => setScannerOpen(true)} className="bg-em-red text-white p-4 rounded-full border-4 border-stone-50 shadow-lg"><CameraIcon className="w-8 h-8" /></button>
                </div>
                <button onClick={() => setCurrentView('all')} className={`flex flex-col items-center ${currentView !== 'dashboard' ? 'text-em-red' : 'text-neutral-400'}`}>
                    <ListBulletIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase">Stock</span>
                </button>
            </div>

            {/* CUSTOM DELETE CONFIRMATION MODAL */}
            {itemToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-stone-50 w-full max-w-md border-4 border-neutral-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 animate-fade-in-down">
                        <h2 className="font-black uppercase text-xl mb-4 text-red-600">Warning: Permanent Deletion</h2>
                        <p className="font-bold mb-6">Are you sure you want to delete SKU: <span className="text-red-700">{itemToDelete}</span>?</p>
                        <div className="flex gap-4">
                            <button onClick={() => setItemToDelete(null)} className="flex-1 border-2 border-neutral-900 py-2 font-black uppercase hover:bg-gray-100">Cancel</button>
                            <button onClick={() => handleDeleteItem(itemToDelete)} className="flex-1 bg-red-600 text-white py-2 font-black uppercase hover:bg-red-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">Delete Now</button>
                        </div>
                    </div>
                </div>
            )}

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