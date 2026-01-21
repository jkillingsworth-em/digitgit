import React, { useState, useCallback, useEffect, Suspense, lazy, useMemo } from 'react';
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
  updateDoc,
  increment,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { InventoryItem, Location, Stock, ReportDataItem, PrintableLabel } from './types';
import { useInventoryData } from './hooks/useInventoryData';
import { DbProvider } from './context/DbContext';

// Component Imports
import Header from './components/Header';
const InventoryTable = lazy(() => import('./components/InventoryTable'));
const AddItemModal = lazy(() => import('./components/AddItemModal'));
const EditItemModal = lazy(() => import('./components/EditItemModal'));
const MoveStockModal = lazy(() => import('./components/MoveStockModal'));
const ImportDataModal = lazy(() => import('./components/ImportDataModal'));
const GenerateReportModal = lazy(() => import('./components/GenerateReportModal'));
const ReportPreviewModal = lazy(() => import('./components/ReportPreviewModal'));
const InventoryManagementModal = lazy(() => import('./components/InventoryManagementModal'));
const InventoryManagerUnified = lazy(() => import('./components/InventoryManagerUnified'));
import NavigationView from './components/NavigationView';
const BarcodeScannerModal = lazy(() => import('./components/BarcodeScannerModal'));
const BarcodeSheetModal = lazy(() => import('./components/PrintBarcodeModal'));
const GenerateBarcodeSheetModal = lazy(() => import('./components/CategoryColorModal'));
const DesktopDashboard = lazy(() => import('./components/DesktopDashboard'));
const TailoredExportModal = lazy(() => import('./components/TailoredExportModal'));
const BulkTransferModal = lazy(() => import('./components/BulkTransferModal'));
const MassStockUpdateModal = lazy(() => import('./components/MassStockUpdateModal'));
const SelectPrintLocationModal = lazy(() => import('./components/SelectPrintLocationModal'));
import Toast from './components/Toast';
import StatsOverview from './components/StatsOverview';
import MobileDashboard from './components/MobileDashboard';

// Admin Components
import CategoryManager from './components/CategoryManager';
import LocationManager from './components/LocationManager';
import PurgeManager from './components/PurgeManager';

// Icon Imports
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
import { HomeIcon } from './components/icons/HomeIcon';
import { CameraIcon } from './components/icons/CameraIcon';
import { ListBulletIcon } from './components/icons/ListBulletIcon';
import MobileFooter from './components/MobileFooter';

// Types
type ViewType =
  | 'all'
  | 'categories'
  | 'locations'
  | 'dashboard'
  | 'admin-categories'
  | 'admin-locations'
  | 'admin-purge';

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
  name: item.name || item.description || 'UNNAMED',
  description: item.description || '',
  category: item.category || '',
  subCategory: item.subCategory || '',
  // Include new fields
  subCategory1: item.subCategory1 || [],
  subCategory2: item.subCategory2 || [],
  subCategory3: item.subCategory3 || '',
  lowAlertQuantity: Number(item.lowAlertQuantity || 0),
  price: Number(item.price || 0),
  priorUsage: (item.priorUsage || []).map(u => ({ year: Number(u.year), usage: Number(u.usage) })),
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
    subLocationDetail: stockItem.subLocationDetail || '',
    locationBarcode: stockItem.locationBarcode || '',
    poNumber: stockItem.poNumber || '',
    dateReceived: stockItem.dateReceived || '',
    docId,
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

  // Derive a simple category -> list of subcategories map for modals/filters
  const categoryHierarchy = useMemo(() => {
    const h: Record<string, string[]> = {};
    items.forEach(item => {
      const cat = item.category || 'UNCATEGORIZED';
      if (!h[cat]) h[cat] = [];
      const add = (s?: string) => { if (s && !h[cat].includes(s)) h[cat].push(s); };
      add(item.subCategory);
      add(item.subCategory3);
      if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(add);
      if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(add);
    });
    return h;
  }, [items]);

  // Ensure TypeScript sees the correct Firestore type for the imported db
  const firestoreDb = db as Firestore;

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  // -- Fetch Data --
  useEffect(() => {
    const fetchAuxData = async () => {
      try {
        // Fetch Locations
        const locSnap = await getDocs(collection(firestoreDb, 'locations'));
        if (!locSnap.empty) {
          setLocations(locSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location)));
        }

        // Fetch Categories
        const catSnap = await getDocs(collection(firestoreDb, 'categories'));
        if (!catSnap.empty) {
          setDefinedCategories(catSnap.docs.map(d => ({ id: d.id, ...d.data() } as CategoryDefinition)));
        }
      } catch (e) {
        console.warn('Using defaults for locations/categories.', e);
      }
    };
    fetchAuxData();
  }, [firestoreDb]);

  // --- HANDLERS ---

  const handleBatchDeleteItems = async (ids: string[]) => {
    try {
      const batchLimit = 400;
      let batch = writeBatch(firestoreDb);
      let count = 0;

      const commitBatch = async () => {
        if (count > 0) {
          await batch.commit();
          batch = writeBatch(firestoreDb);
          count = 0;
        }
      };

      for (const id of ids) {
        batch.delete(doc(firestoreDb, 'inventory', id));
        count++;

        const relatedStock = stock.filter(s => s.itemId === id);
        for (const s of relatedStock) {
          if (s.docId) {
            batch.delete(doc(firestoreDb, 'stock', s.docId));
            count++;
            if (count >= batchLimit) await commitBatch();
          }
        }
        if (count >= batchLimit) await commitBatch();
      }
      await commitBatch();
      showToast(`Purged ${ids.length} items successfully.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Batch delete failed.', 'error');
    }
  };

  const handleDeleteItem = useCallback(
    async (itemId: string) => {
      try {
        const batch = writeBatch(firestoreDb);
        batch.delete(doc(firestoreDb, 'inventory', itemId));
        const q = query(collection(firestoreDb, 'stock'), where('itemId', '==', itemId));
        const snap = await getDocs(q);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        showToast(`SKU ${itemId} purged.`, 'success');
        setItemToDelete(null);
        setEditModalOpen(false);
      } catch (e) {
        console.error(e);
        showToast('Deletion failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleAddItem = useCallback(
    async (item: InventoryItem, stockEntries: Omit<Stock, 'itemId'>[], colors?: { category?: string; subCategory?: string }) => {
      try {
        const batch = writeBatch(firestoreDb);
        batch.set(doc(firestoreDb, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item));
        stockEntries.forEach(se => {
          const stockItem = sanitizeStockItem({ ...se, itemId: item.id } as Stock);
          batch.set(doc(firestoreDb, 'stock', stockItem.docId!), stockItem);
        });
        if (colors) {
          if (colors.category && item.category) batch.set(doc(firestoreDb, 'categoryColors', item.category), { color: colors.category });
          if (colors.subCategory && item.subCategory) batch.set(doc(firestoreDb, 'categoryColors', item.subCategory), { color: colors.subCategory });
        }
        await batch.commit();
        setAddItemModalOpen(false);
        setItemToDuplicate(null);
        showToast(`Item added.`, 'success');
      } catch (e) {
        console.error(e);
        showToast('Failed to add item.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  // Updated Bulk Edit Handler to support new hierarchy
  const handleBulkEdit = useCallback(
    async (changes: { category?: string; subCategory1?: string[]; subCategory2?: string[]; subCategory3?: string[] }) => {
      if (selectedItemIds.size === 0) return;
      try {
        const batch = writeBatch(firestoreDb);
        Array.from(selectedItemIds).forEach((id: string) => {
          const updateData: any = {};
          if (changes.category) updateData.category = changes.category;
          if (changes.subCategory1) updateData.subCategory1 = changes.subCategory1;
          if (changes.subCategory2) updateData.subCategory2 = changes.subCategory2;
          if (changes.subCategory3) updateData.subCategory3 = changes.subCategory3;
          batch.update(doc(firestoreDb, 'inventory', id), updateData);
        });
        await batch.commit();
        setBulkEditModalOpen(false);
        setSelectedItemIds(new Set());
        showToast('Bulk updated items.', 'success');
      } catch (e) {
        console.error(e);
        showToast('Bulk update failed.', 'error');
      }
    },
    [selectedItemIds, showToast, firestoreDb],
  );

  const handleImport = useCallback(
    async (newItems: InventoryItem[], newStock: Stock[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        if (newItems.length + newStock.length > 450) throw new Error('Import too large.');
        newItems.forEach(item => batch.set(doc(firestoreDb, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item), { merge: true }));
        newStock.forEach(s => {
          const stockItem = sanitizeStockItem(s);
          batch.set(doc(firestoreDb, 'stock', stockItem.docId!), stockItem, { merge: true });
        });
        await batch.commit();
        setImportModalOpen(false);
        showToast(`Import processed.`, 'success');
      } catch (e: any) {
        console.error(e);
        showToast(e.message || 'Import failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleQuickExport = useCallback(() => {
    const headers = ['ID', 'DESCRIPTION', 'CATEGORY', 'LOCATION', 'QTY'];
    const rows = [headers.join(',')];
    items.forEach(item => {
      const itemStock = stock.filter(s => s.itemId === item.id);
      if (itemStock.length === 0) {
        rows.push([`"${item.id}"`, `"${item.description}"`, `"${item.category}"`, '""', '0'].join(','));
      } else {
        itemStock.forEach(s => {
          const loc = locations.find(l => l.id === s.locationId);
          rows.push([`"${item.id}"`, `"${item.description}"`, `"${item.category}"`, `"${loc ? loc.name : s.locationId}"`, `${s.quantity}`].join(','));
        });
      }
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_export.csv`;
    link.click();
    showToast('Export complete.', 'success');
  }, [items, stock, locations, showToast]);

  const handleEditItem = useCallback(
    async (item: InventoryItem, updatedStock: Stock[], colors?: { category?: string; subCategory?: string }) => {
      try {
        const batch = writeBatch(firestoreDb);
        batch.set(doc(firestoreDb, 'inventory', item.id), sanitizeInventoryItem(item), { merge: true });
        if (colors) {
          if (colors.category && item.category) batch.set(doc(firestoreDb, 'categoryColors', item.category), { color: colors.category });
          if (colors.subCategory && item.subCategory) batch.set(doc(firestoreDb, 'categoryColors', item.subCategory), { color: colors.subCategory });
        }
        const q = query(collection(firestoreDb, 'stock'), where('itemId', '==', item.id));
        const snap = await getDocs(q);
        snap.docs.forEach(d => batch.delete(d.ref));
        updatedStock.forEach(s => {
          const stockItem = sanitizeStockItem({ ...s, itemId: item.id });
          batch.set(doc(firestoreDb, 'stock', stockItem.docId!), stockItem);
        });
        await batch.commit();
        setEditModalOpen(false);
        showToast(`SKU ${item.id} updated.`, 'success');
      } catch (e) {
        console.error(e);
        showToast('Update failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleMoveStock = useCallback(
    async (itemId: string, fromLoc: string, toLoc: string, qty: number, subDetail?: string) => {
      try {
        await runTransaction(firestoreDb, async tx => {
          const q = query(collection(firestoreDb, 'stock'), where('itemId', '==', itemId), where('locationId', '==', fromLoc));
          const snap = await getDocs(q);
          if (snap.empty) throw new Error('No stock at source.');
          const fromRef = snap.docs[0].ref;
          const fromData = snap.docs[0].data() as Stock;
          if (fromData.quantity < qty) throw new Error('Insufficient units.');
          const toDocId = `${itemId.toUpperCase().trim()}_${toLoc.toLowerCase().trim()}`;
          const toRef = doc(firestoreDb, 'stock', toDocId);
          const toDoc = await tx.get(toRef);

          if (fromData.quantity - qty === 0) tx.delete(fromRef);
          else tx.update(fromRef, { quantity: fromData.quantity - qty });

          if (toDoc.exists()) tx.update(toRef, { quantity: toDoc.data().quantity + qty, subLocationDetail: subDetail || toDoc.data().subLocationDetail });
          else tx.set(toRef, sanitizeStockItem({ itemId, locationId: toLoc, quantity: qty, subLocationDetail: subDetail || '', source: fromData.source }));
        });
        setMoveModalOpen(false);
        showToast('Transfer successful.', 'success');
      } catch (e: any) {
        console.error(e);
        showToast(e.message || 'Transfer failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleBulkTransfer = useCallback(
    async (transfers: any[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        for (const t of transfers) {
          const fromId = `${t.itemId}_${t.fromLoc}`;
          const toId = `${t.itemId}_${t.toLoc}`;
          const fromRef = doc(firestoreDb, 'stock', fromId);
          const toRef = doc(firestoreDb, 'stock', toId);

          // Use statically imported `increment` to avoid mixed dynamic/static firestore imports
          batch.update(fromRef, { quantity: increment(-t.qty) });
          batch.set(toRef, { itemId: t.itemId, locationId: t.toLoc, quantity: increment(t.qty), source: 'OH' }, { merge: true });
        }
        await batch.commit();
        setBulkEditModalOpen(false);
        setSelectedItemIds(new Set()); // clear selection
        showToast('Bulk transfer processed.', 'success');
      } catch (e) {
        console.error(e);
        showToast('Transfer failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleBulkQuantityUpdate = useCallback(
    async (updates: any[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        for (const u of updates) {
          const docId = `${u.itemId}_${u.locationId}`;
          batch.set(
            doc(firestoreDb, 'stock', docId),
            {
              itemId: u.itemId,
              locationId: u.locationId,
              quantity: u.newQty,
              source: 'OH', // Defaulting if new
            },
            { merge: true },
          );
        }
        await batch.commit();
        setBulkEditModalOpen(false);
        setSelectedItemIds(new Set()); // clear selection
        showToast('Mass update complete.', 'success');
      } catch (e) {
        console.error(e);
        showToast('Update failed.', 'error');
      }
    },
    [showToast, firestoreDb],
  );

  const handleBulkPrint = useCallback((labels: PrintableLabel[]) => {
    setPrintableLabels(labels);
    setBulkEditModalOpen(false);
    // Note: Don't clear selection, user might want to do other things
  }, []);

  const handlePurgeDatabase = useCallback(async () => {
    if (!window.confirm('CRITICAL WARNING: PURGE ALL DATA?')) return;
    if (!window.confirm('Final Warning: Undone.')) return;
    try {
      const batchLimit = 400;
      let batch = writeBatch(firestoreDb);
      let count = 0;
      const commit = async () => {
        if (count > 0) {
          await batch.commit();
          batch = writeBatch(firestoreDb);
          count = 0;
        }
      };
      const sSnap = await getDocs(collection(firestoreDb, 'stock'));
      for (const d of sSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= batchLimit) await commit();
      }
      const iSnap = await getDocs(collection(firestoreDb, 'inventory'));
      for (const d of iSnap.docs) {
        batch.delete(d.ref);
        count++;
        if (count >= batchLimit) await commit();
      }
      await commit();
      showToast('Database wiped.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Purge failed.', 'error');
    }
  }, [showToast, firestoreDb]);

  if (error) return <div className="p-4 text-red-600 font-bold">{error}</div>;

  return (
    <DbProvider db={db}>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/** Top Header + Controls (ALT Layout) */}
        <Header
          onAddItemClick={() => {
            setItemToDuplicate(null);
            setAddItemModalOpen(true);
          }}
          onImportClick={() => setImportModalOpen(true)}
          onExportClick={handleQuickExport}
          onReportClick={() => setReportModalOpen(true)}
          onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
          onSearchClick={() => setIsSearchVisible(p => !p)}
          onScanClick={() => setScannerOpen(true)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <NavigationView
          currentView={currentView as any}
          onViewChange={v => setCurrentView(v as ViewType)}
          onFilterChange={(type, val) => {
            if (type === 'category') setFilterCategory(val);
            else setFilterLocation(val);
            setCurrentView('all');
          }}
          onClearFilters={() => {
            setFilterCategory('');
            setFilterLocation('');
            setFilterLowStock(false);
            setSearchQuery('');
          }}
          items={items}
          locations={locations}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
          onImportClick={() => setImportModalOpen(true)}
          onExportClick={handleQuickExport}
          onReportClick={() => setReportModalOpen(true)}
          onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
          onAddItemClick={() => {
            setItemToDuplicate(null);
            setAddItemModalOpen(true);
          }}
          onScanClick={() => setScannerOpen(true)}
        />

        {isSearchVisible && (
          <div className="bg-amber-50 text-black text-center py-2 font-black text-xs uppercase tracking-widest sticky top-0 z-[60] shadow-sm flex items-center justify-center gap-2">
            <div className="fluid-container py-3 relative w-full">
              <MagnifyingGlassIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
              <input type="text" className="form-control pl-10" placeholder="SEARCH..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
            </div>
          </div>
        )}

        <div className="flex-grow p-4 md:p-8 max-w-[1920px] mx-auto w-full">
          {isLoading ? (
            <div className="h-screen flex items-center justify-center font-black text-gray-400 animate-pulse uppercase tracking-widest">Loading Electro-Mech Database...</div>
          ) : (
            <>
              {currentView === 'dashboard' ? (
                <>
                  <div className="md:hidden">
                    <MobileDashboard
                      items={items}
                      stock={stock}
                      locations={locations}
                      onStockUpdateClick={() => setBulkEditModalOpen(true)}
                      onTransferClick={() => setBulkTransferOpen(true)}
                      onPrintClick={() => setGenerateBarcodeSheetModalOpen(true)}
                      onActivityClick={() => showToast('Opening Log...', 'success')}
                      onImportExportClick={() => setTailoredExportOpen(true)}
                      onWarehouseClick={id => {
                        setFilterLocation(id);
                        setCurrentView('all');
                      }}
                      onAdminCategories={() => setCurrentView('admin-categories')}
                      onAdminLocations={() => setCurrentView('admin-locations')}
                      onAdminPurge={() => setCurrentView('admin-purge')}
                    />
                  </div>

                  <div className="hidden md:block">
                    <Suspense fallback={<div className="text-center py-8">Loading dashboard...</div>}>
                      <DesktopDashboard
                        items={items}
                        stock={stock}
                        locations={locations}
                        onStockUpdateClick={() => setBulkEditModalOpen(true)}
                        onTransferClick={() => setBulkTransferOpen(true)}
                        onPrintClick={() => setGenerateBarcodeSheetModalOpen(true)}
                        onActivityClick={() => showToast('Opening Log...', 'success')}
                        onImportExportClick={() => setTailoredExportOpen(true)}
                        onWarehouseClick={id => {
                          setFilterLocation(id);
                          setCurrentView('all');
                        }}
                        onAdminCategories={() => setCurrentView('admin-categories')}
                        onAdminLocations={() => setCurrentView('admin-locations')}
                        onAdminPurge={() => setCurrentView('admin-purge')}
                      />
                    </Suspense>
                  </div>
                </>
              ) : currentView === 'admin-categories' ? (
                <CategoryManager onBack={() => setCurrentView('dashboard')} />
              ) : currentView === 'admin-locations' ? (
                <LocationManager
                  locations={locations}
                  onAddLocation={() => Promise.resolve()}
                  onUpdateLocation={() => Promise.resolve()}
                  onDeleteLocation={() => Promise.resolve()}
                  onAssignItems={locId => {
                    setFilterLocation(locId);
                    setMassStockUpdateOpen(true);
                  }}
                  onBack={() => setCurrentView('dashboard')}
                  onSync={async () => {}}
                />
              ) : currentView === 'admin-purge' ? (
                <PurgeManager items={items} stock={stock} locations={locations} onBatchDelete={handleBatchDeleteItems} onBack={() => setCurrentView('dashboard')} categoryColors={categoryColors} />
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <Suspense fallback={<div className="text-center py-20">Loading table...</div>}>
                    <InventoryTable
                      items={items}
                      locations={locations}
                      stock={stock}
                      selectedItemIds={selectedItemIds}
                      onSelectionChange={id => {
                        const next = new Set(selectedItemIds);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        setSelectedItemIds(next);
                      }}
                      onSelectAll={(ids, s) => setSelectedItemIds(s ? new Set(ids) : new Set())}
                      onMoveClick={item => {
                        const canonical = items.find(i => i.id === (item as InventoryItem).id) ?? (item as InventoryItem);
                        setItemToMove(canonical);
                        setMoveModalOpen(true);
                      }}
                      onDeleteClick={id => setItemToDelete(id)}
                      onDuplicateClick={() => setAddItemModalOpen(true)}
                      onEditClick={item => {
                        const canonical = items.find(i => i.id === (item as InventoryItem).id) ?? (item as InventoryItem);
                        setItemToEdit(canonical);
                        setEditModalOpen(true);
                      }}
                      onRowClick={setItemToEdit as any}
                      onPrintBarcode={i => setPrintableLabels([{ itemId: i.id, description: i.description, locationName: i.locationsWithStock?.[0]?.locationName || 'SKU' }])}
                      onPrintSpecificLabel={l => setPrintableLabels([l])}
                      onGenerateReportForItem={id => {
                        setReportData([{ ...items.find(i => i.id === id)!, locationName: 'ALL', quantity: 0, source: 'OH' }]);
                      }}
                      categoryColors={categoryColors}
                      view={currentView as any}
                      searchQuery={searchQuery}
                      filterCategory={filterCategory}
                      filterLocation={filterLocation}
                      filterLowStock={filterLowStock}
                      onSetFilterCategory={setFilterCategory}
                      onSetFilterLocation={setFilterLocation}
                      onSetFilterLowStock={setFilterLowStock}
                      onViewChange={v => setCurrentView(v as ViewType)}
                    />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>

        <MobileFooter
          onHomeClick={() => setCurrentView('dashboard')}
          onScanClick={() => setScannerOpen(true)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        {isAddItemModalOpen && (
          <Suspense fallback={<div className="p-6">Opening Add Item…</div>}>
            <AddItemModal
              onClose={() => setAddItemModalOpen(false)}
              onAddItem={handleAddItem}
              locations={locations}
              existingItemIds={items.map(i => i.id)}
              itemToDuplicate={itemToDuplicate}
              currentCategoryColors={categoryColors}
              onShowToast={showToast}
            />
          </Suspense>
        )}

        {/* Modals */}
        {isBulkEditModalOpen && (
          <Suspense fallback={<div className="p-6">Opening Inventory Management…</div>}>
            <InventoryManagerUnified
              isOpen={isBulkEditModalOpen}
              onClose={() => setBulkEditModalOpen(false)}
              items={items}
              stock={stock}
              locations={locations}
              categoryHierarchy={categoryHierarchy}
              selectedItemIds={selectedItemIds}
              setSelectedItemIds={setSelectedItemIds}
              onBulkQuantityUpdate={handleBulkQuantityUpdate}
              onBulkTransfer={handleBulkTransfer}
              onBulkEdit={handleBulkEdit}
              onPrintLabels={handleBulkPrint}
            />
          </Suspense>
        )}
        {isMoveModalOpen && itemToMove && (
          <Suspense fallback={<div className="p-6">Loading Move Stock…</div>}>
            <MoveStockModal item={itemToMove} locations={locations} stock={stock} onClose={() => setMoveModalOpen(false)} onMoveStock={handleMoveStock} />
          </Suspense>
        )}
        {isBulkTransferOpen && (
          <Suspense fallback={<div className="p-6">Opening Bulk Transfer…</div>}>
            <BulkTransferModal items={items} locations={locations} stock={stock} onClose={() => setBulkTransferOpen(false)} onTransfer={handleBulkTransfer} />
          </Suspense>
        )}
        {isMassStockUpdateOpen && (
          <Suspense fallback={<div className="p-6">Opening Mass Update…</div>}>
            <MassStockUpdateModal items={items} locations={locations} stock={stock} onClose={() => setMassStockUpdateOpen(false)} onUpdate={handleBulkQuantityUpdate} />
          </Suspense>
        )}
        {isTailoredExportOpen && (
          <Suspense fallback={<div className="p-6">Opening Export…</div>}>
            <TailoredExportModal onClose={() => setTailoredExportOpen(false)} onExport={() => {}} />
          </Suspense>
        )}
        {isImportModalOpen && (
          <Suspense fallback={<div className="p-6">Loading Import…</div>}>
            <ImportDataModal onClose={() => setImportModalOpen(false)} onImport={handleImport} />
          </Suspense>
        )}
        {isScannerOpen && (
          <Suspense fallback={<div className="p-6">Opening Scanner…</div>}>
            <BarcodeScannerModal
              isOpen={isScannerOpen}
              onClose={() => setScannerOpen(false)}
              onScan={res => {
                const it = items.find(i => i.id === res);
                if (it) {
                  setItemToMove(it);
                  setMoveModalOpen(true);
                } else {
                  showToast('SKU Not Found.', 'error');
                }
                setScannerOpen(false);
              }}
            />
          </Suspense>
        )}
        {printableLabels && (
          <Suspense fallback={<div className="p-6">Rendering Barcode Sheet…</div>}>
            <BarcodeSheetModal labels={printableLabels} onClose={() => setPrintableLabels(null)} />
          </Suspense>
        )}
        {isGenerateBarcodeSheetModalOpen && (
          <Suspense fallback={<div className="p-6">Preparing Barcode Generator…</div>}>
            <GenerateBarcodeSheetModal onClose={() => setGenerateBarcodeSheetModalOpen(false)} onGenerate={setPrintableLabels} items={items} stock={stock} locations={locations} selectedItemIds={selectedItemIds} />
          </Suspense>
        )}
        {isReportModalOpen && (
          <Suspense fallback={<div className="p-6">Preparing Report…</div>}>
            <GenerateReportModal onClose={() => setReportModalOpen(false)} onGenerate={() => {}} items={items} selectedItemCount={selectedItemIds.size} lowAlertItemCount={0} />
          </Suspense>
        )}
        {reportData && (
          <Suspense fallback={<div className="p-6">Loading Report Preview…</div>}>
            <ReportPreviewModal reportData={reportData} onClose={() => setReportData(null)} onPrintSpecificLabel={l => setPrintableLabels([l])} />
          </Suspense>
        )}

        {itemToPrint && (
          <Suspense fallback={<div className="p-6">Preparing Print…</div>}>
            <SelectPrintLocationModal
              isOpen={!!itemToPrint}
              onClose={() => setItemToPrint(null)}
              onGenerate={label => {
                setPrintableLabels([label]);
                setItemToPrint(null);
              }}
              item={itemToPrint}
              stockLocations={stock.filter(s => s.itemId === itemToPrint.id)}
              locations={locations}
            />
          </Suspense>
        )}

        {/* Edit Item Modal: shown when a single item is selected for editing */}
        {isEditModalOpen && itemToEdit && (
          <Suspense fallback={<div className="p-6">Loading editor…</div>}>
            <EditItemModal
              item={itemToEdit}
              stock={stock.filter(s => s.itemId === itemToEdit.id)}
              locations={locations}
              onClose={() => {
                setEditModalOpen(false);
                setItemToEdit(null);
              }}
              onEditItem={(updatedItem, updatedStock, colors) => {
                handleEditItem(updatedItem, updatedStock, colors);
                // handleEditItem will close modal on success, but ensure local state cleaned
                // setEditModalOpen(false); // handleEditItem already closes
                setItemToEdit(null);
              }}
              onDelete={() => {
                if (itemToEdit) handleDeleteItem(itemToEdit.id);
              }}
              onPrintSpecificLabel={(label) => {
                setPrintableLabels([label]);
              }}
              currentCategoryColors={categoryColors}
              fieldToFocus={null}
            />
          </Suspense>
        )}
      </div>
    </DbProvider>
  );
};

export default App;