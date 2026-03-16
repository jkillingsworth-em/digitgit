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
import NavigationView from './components/NavigationView';
const BarcodeScannerModal = lazy(() => import('./components/BarcodeScannerModal'));
const BarcodeSheetModal = lazy(() => import('./components/PrintBarcodeModal'));
const GenerateBarcodeSheetModal = lazy(() => import('./components/CategoryColorModal'));
const DesktopDashboard = lazy(() => import('./components/DesktopDashboard'));
const TailoredExportModal = lazy(() => import('./components/TailoredExportModal'));
const SelectPrintLocationModal = lazy(() => import('./components/SelectPrintLocationModal'));
const InventoryManagementModal = lazy(() => import('./components/InventoryManagementModal'));
const DatabaseAudit = lazy(() => import('./components/DatabaseAudit'));
import Toast from './components/Toast';
import MobileDashboard from './components/MobileDashboard';
import AdminHub from './components/AdminHub';

// Admin Components
import CategoryManager from './components/CategoryManager';
import LocationManager from './components/LocationManager';

// Icon Imports
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
import MobileFooter from './components/MobileFooter';

// Types
type ViewType =
  | 'all'
  | 'categories'
  | 'locations'
  | 'dashboard'
  | 'admin-hub'
  | 'admin-categories'
  | 'admin-locations'
  | 'admin-audit';

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
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [isGenerateBarcodeSheetModalOpen, setGenerateBarcodeSheetModalOpen] = useState(false);
  const [isTailoredExportOpen, setTailoredExportOpen] = useState(false);
  const [isInventoryMgmtOpen, setInventoryMgmtOpen] = useState(false);
  const [inventoryMgmtMode, setInventoryMgmtMode] = useState<'ADD' | 'EDIT' | 'AUDIT' | 'MOVE'>('ADD');
  const [inventoryMgmtFilters, setInventoryMgmtFilters] = useState<{ categories?: string[]; locations?: string[] }>({});

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

  const { items, stock, categoryColors, categoryHierarchyDoc, isLoading, error } = useInventoryData();

  // Derive a simple category -> list of subcategories map for modals/filters
  const categoryHierarchy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const ensure = (cat: string) => {
      const key = cat || 'UNCATEGORIZED';
      if (!map.has(key)) map.set(key, new Set<string>());
      return map.get(key)!;
    };

    const ingestDoc = (main: string, node: any) => {
      const set = ensure(main);
      if (!node || typeof node !== 'object') return;
      Object.entries(node).forEach(([subKey, value]) => {
        set.add(subKey);
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((leaf: any) => {
              if (typeof leaf === 'string' && leaf.trim()) set.add(leaf);
            });
          } else {
            Object.entries(value as Record<string, any>).forEach(([innerKey, innerVal]) => {
              set.add(innerKey);
              if (Array.isArray(innerVal)) {
                innerVal.forEach((leaf: any) => {
                  if (typeof leaf === 'string' && leaf.trim()) set.add(leaf);
                });
              }
            });
          }
        }
      });
    };

    if (categoryHierarchyDoc && typeof categoryHierarchyDoc === 'object') {
      Object.entries(categoryHierarchyDoc).forEach(([main, node]) => {
        ensure(main);
        ingestDoc(main, node);
      });
    }

    items.forEach(item => {
      const set = ensure(item.category || 'UNCATEGORIZED');
      const add = (val?: string | null | undefined) => {
        if (val && val.trim()) set.add(val);
      };
      add(item.subCategory);
      add(item.subCategory3);
      if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(add);
      if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(add);
    });

    if (!map.has('UNCATEGORIZED')) map.set('UNCATEGORIZED', new Set());

    const result: Record<string, string[]> = {};
    map.forEach((set, key) => {
      result[key] = Array.from(set).sort((a, b) => a.localeCompare(b));
    });
    return result;
  }, [items, categoryHierarchyDoc]);

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
  const handleImport = useCallback(
    async (newItems: InventoryItem[], newStock: Stock[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        if (newItems.length + newStock.length > 450) throw new Error('Import too large.');
        const validCategories = new Set(
          definedCategories
            .map(cat => cat.id.toUpperCase().trim())
            .filter(Boolean),
        );
        items
          .map(item => item.category?.toUpperCase().trim())
          .filter(Boolean)
          .forEach(cat => validCategories.add(cat!));
        const validLocations = new Set(locations.map(loc => loc.id.toLowerCase().trim()));
        const existingItemIds = new Set(items.map(item => item.id.toUpperCase().trim()));
        const errors: string[] = [];
        const seenImportedItems = new Set<string>();
        const importedItemIds = new Set<string>();
        const seenStockKeys = new Set<string>();
        const isValidDate = (value: string) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
          const parsed = new Date(`${value}T00:00:00Z`);
          return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
        };

        newItems.forEach(item => {
          const sku = item.id?.toUpperCase().trim();
          if (!sku) {
            errors.push('Import item is missing SKU ID.');
            return;
          }
          if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
            errors.push(`Invalid SKU format "${item.id}".`);
          }
          if (seenImportedItems.has(sku)) {
            errors.push(`Duplicate SKU "${sku}" in import payload.`);
          }
          seenImportedItems.add(sku);
          importedItemIds.add(sku);
          if (!item.description?.trim()) {
            errors.push(`Missing description for SKU ${sku}.`);
          }
          const cat = item.category?.toUpperCase().trim();
          if (!cat) {
            errors.push(`Missing category for SKU ${sku}.`);
          } else if (!validCategories.has(cat)) {
            errors.push(`Unknown category "${cat}" for SKU ${sku}.`);
          }
        });

        newStock.forEach(entry => {
          const sku = entry.itemId?.toUpperCase().trim();
          const loc = entry.locationId?.toLowerCase().trim();
          if (!sku) {
            errors.push('Stock row is missing SKU ID.');
            return;
          }
          if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) {
            errors.push(`Invalid stock SKU format "${entry.itemId}".`);
          }
          if (!loc) {
            errors.push(`Missing location for SKU ${sku}.`);
          } else if (!validLocations.has(loc)) {
            errors.push(`Unknown location "${loc}" for SKU ${sku}.`);
          }
          if (loc) {
            const stockKey = `${sku}|${loc}`;
            if (seenStockKeys.has(stockKey)) {
              errors.push(`Duplicate stock row for SKU ${sku} at location ${loc}.`);
            }
            seenStockKeys.add(stockKey);
          }
          if (!importedItemIds.has(sku) && !existingItemIds.has(sku)) {
            errors.push(`Stock row references unknown SKU ${sku}.`);
          }
          const quantity = Number(entry.quantity);
          if (!Number.isFinite(quantity) || quantity < 0) {
            errors.push(`Invalid quantity for SKU ${sku} at ${loc || 'unknown location'}.`);
          }
          if (!entry.source) {
            errors.push(`Missing source for SKU ${sku}.`);
          } else if (entry.source !== 'OH' && entry.source !== 'PO') {
            errors.push(`Invalid source for SKU ${sku}. Use OH or PO.`);
          }
          if (entry.dateReceived && !isValidDate(entry.dateReceived.trim())) {
            errors.push(`Invalid dateReceived for SKU ${sku}. Use YYYY-MM-DD.`);
          }
        });

        if (errors.length > 0) {
          const maxErrors = 12;
          const visibleErrors = errors.slice(0, maxErrors).join('\n');
          const remaining = errors.length - maxErrors;
          throw new Error(`${visibleErrors}${remaining > 0 ? `\n...and ${remaining} more issue(s).` : ''}`);
        }
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
        throw e;
      }
    },
    [showToast, firestoreDb, definedCategories, items, locations],
  );

  const handleQuickExport = useCallback(() => {
    const headers = ['ID', 'DESCRIPTION', 'CATEGORY', 'LOCATION', 'SOURCE', 'QTY'];
    const rows = [headers.join(',')];
    items.forEach(item => {
      const itemStock = stock.filter(s => s.itemId === item.id);
      if (itemStock.length === 0) {
        rows.push([`"${item.id}"`, `"${item.description}"`, `"${item.category}"`, '""', '"OH"', '0'].join(','));
      } else {
        itemStock.forEach(s => {
          rows.push([`"${item.id}"`, `"${item.description}"`, `"${item.category}"`, `"${s.locationId}"`, `"${s.source || 'OH'}"`, `${s.quantity}`].join(','));
        });
      }
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_export.csv`;
    link.click();
    showToast('Export complete.', 'success');
  }, [items, stock, showToast]);

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

  const handleInventoryManagement = useCallback(
    async (mode: 'ADD' | 'EDIT' | 'AUDIT' | 'MOVE', payload: any, effectiveDate: string) => {
      try {
        if (mode === 'ADD') {
          const batch = writeBatch(firestoreDb);
          payload.forEach((row: any) => {
            if (!row.id || !row.category || !row.locationId) return;
            const draft: InventoryItem = {
              id: row.id,
              name: row.description || row.id,
              description: row.description || '',
              category: row.category,
              subCategory1: Array.isArray(row.subCategory1) ? row.subCategory1 : [],
              subCategory2: Array.isArray(row.subCategory2) ? row.subCategory2 : [],
              subCategory3: typeof row.subCategory3 === 'string' ? row.subCategory3 : '',
              subCategory: row.subCategory || '',
              priorUsage: [],
              lowAlertQuantity: Number(row.lowAlertQuantity) || 0,
              price: Number(row.price) || 0,
            };
            const sanitized = { ...sanitizeInventoryItem(draft), lastModified: effectiveDate } as any;
            batch.set(doc(firestoreDb, 'inventory', sanitized.id), sanitized);
            if (row.quantity) {
              const stockRecord = sanitizeStockItem({
                itemId: sanitized.id,
                locationId: row.locationId,
                quantity: Number(row.quantity) || 0,
                source: row.source || 'OH',
                subLocationDetail: row.subLocationDetail || '',
                locationBarcode: row.locationBarcode || '',
                poNumber: row.poNumber || '',
                dateReceived: effectiveDate,
              } as Stock);
              batch.set(doc(firestoreDb, 'stock', stockRecord.docId!), stockRecord);
            }
          });
          await batch.commit();
          showToast('Inventory batch processed.', 'success');
        } else if (mode === 'EDIT') {
          const batch = writeBatch(firestoreDb);
          if (Array.isArray(payload?.itemChanges)) {
            payload.itemChanges.forEach((change: { originalId: string; newId: string; description: string; category: string }) => {
              const originalId = change.originalId?.toUpperCase().trim();
              const newId = change.newId?.toUpperCase().trim();
              if (!originalId || !newId) return;

              const currentItem = items.find(item => item.id === originalId);
              if (!currentItem) return;

              const merged: InventoryItem = {
                ...currentItem,
                id: newId,
                name: change.description?.trim() || currentItem.name || newId,
                description: change.description?.trim() || currentItem.description,
                category: change.category?.trim() || currentItem.category,
              };

              const sanitized = { ...sanitizeInventoryItem(merged), lastModified: effectiveDate } as any;

              if (newId === originalId) {
                batch.set(doc(firestoreDb, 'inventory', originalId), sanitized, { merge: true });
                return;
              }

              batch.set(doc(firestoreDb, 'inventory', newId), sanitized, { merge: true });
              batch.delete(doc(firestoreDb, 'inventory', originalId));

              const sourceStock = stock.filter(s => s.itemId === originalId);
              const qtyByLocation = sourceStock.reduce<Record<string, number>>((acc, entry) => {
                acc[entry.locationId] = (acc[entry.locationId] || 0) + entry.quantity;
                return acc;
              }, {});

              sourceStock.forEach(entry => {
                if (entry.docId) batch.delete(doc(firestoreDb, 'stock', entry.docId));
              });

              Object.entries(qtyByLocation).forEach(([locationId, quantity]) => {
                const existingDest = stock.find(s => s.itemId === newId && s.locationId === locationId);
                const stockRecord = sanitizeStockItem({
                  itemId: newId,
                  locationId,
                  quantity: (existingDest?.quantity || 0) + quantity,
                  source: existingDest?.source || 'OH',
                  subLocationDetail: existingDest?.subLocationDetail || '',
                  locationBarcode: existingDest?.locationBarcode || '',
                  poNumber: existingDest?.poNumber || '',
                  dateReceived: effectiveDate || existingDest?.dateReceived || '',
                } as Stock);
                batch.set(doc(firestoreDb, 'stock', stockRecord.docId!), stockRecord, { merge: true });
              });
            });
          } else {
            payload.ids.forEach((id: string) => {
              if (!id) return;
              const updates: Record<string, unknown> = { lastModified: effectiveDate };
              if (payload.changes.category) updates.category = payload.changes.category;
              if (Array.isArray(payload.changes.subCategory1)) updates.subCategory1 = payload.changes.subCategory1;
              batch.set(doc(firestoreDb, 'inventory', id), updates, { merge: true });
            });
          }
          await batch.commit();
          showToast('Bulk item updates saved.', 'success');
        } else if (mode === 'AUDIT') {
          const batch = writeBatch(firestoreDb);
          payload.forEach((entry: { itemId: string; locationId: string; qty: number; subLocationDetail?: string }) => {
            if (!entry.itemId || !entry.locationId) return;
            const existing = stock.find(s => s.itemId === entry.itemId && s.locationId === entry.locationId);
            const stockRecord = sanitizeStockItem({
              itemId: entry.itemId,
              locationId: entry.locationId,
              quantity: Number(entry.qty) || 0,
              source: existing?.source || 'OH',
              subLocationDetail: typeof entry.subLocationDetail === 'string' ? entry.subLocationDetail : (existing?.subLocationDetail || ''),
              locationBarcode: existing?.locationBarcode || '',
              poNumber: existing?.poNumber || '',
              dateReceived: effectiveDate || existing?.dateReceived || '',
            } as Stock);
            batch.set(doc(firestoreDb, 'stock', stockRecord.docId!), stockRecord);
          });
          await batch.commit();
          showToast('Audit adjustments applied.', 'success');
        } else if (mode === 'MOVE') {
          const batch = writeBatch(firestoreDb);
          payload.forEach((transfer: { itemId: string; from: string; to: string; qty: number; subLocationDetail?: string }) => {
            if (!transfer.itemId || !transfer.from || !transfer.to || transfer.from === transfer.to) return;
            const qty = Number(transfer.qty) || 0;
            if (qty <= 0) return;
            const canonicalId = transfer.itemId.toUpperCase().trim();
            const sourceEntries = stock.filter(s => s.itemId === canonicalId && s.locationId === transfer.from);
            const available = sourceEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            if (available < qty) throw new Error(`Insufficient stock at ${transfer.from} for ${canonicalId}.`);
            let remaining = qty;
            sourceEntries.forEach(entry => {
              if (!entry.docId || remaining <= 0) return;
              const ref = doc(firestoreDb, 'stock', entry.docId);
              if (entry.quantity <= remaining) {
                batch.delete(ref);
                remaining -= entry.quantity;
              } else {
                batch.update(ref, { quantity: entry.quantity - remaining });
                remaining = 0;
              }
            });
            const existingDest = stock.find(s => s.itemId === canonicalId && s.locationId === transfer.to);
            const destRecord = sanitizeStockItem({
              itemId: canonicalId,
              locationId: transfer.to,
              quantity: (existingDest?.quantity || 0) + qty,
              source: existingDest?.source || 'OH',
              subLocationDetail: (transfer.subLocationDetail || '').trim() || existingDest?.subLocationDetail || '',
              locationBarcode: existingDest?.locationBarcode || '',
              poNumber: existingDest?.poNumber || '',
              dateReceived: effectiveDate || existingDest?.dateReceived || '',
            } as Stock);
            batch.set(doc(firestoreDb, 'stock', destRecord.docId!), destRecord);
          });
          await batch.commit();
          showToast('Transfers completed.', 'success');
        }
      } catch (err: any) {
        console.error(err);
        showToast(err?.message || 'Inventory management failed.', 'error');
        throw err;
      }
    },
    [firestoreDb, stock, items, showToast],
  );

  const openInventoryManagement = useCallback(
    (mode: 'ADD' | 'EDIT' | 'AUDIT' | 'MOVE', filters?: { categories?: string[]; locations?: string[] }) => {
      setInventoryMgmtMode(mode);
      setInventoryMgmtFilters(filters || {});
      setInventoryMgmtOpen(true);
    },
    [],
  );

  const handleAddLocationRecord = useCallback(
    async ({ id, name, prompt }: { id: string; name: string; prompt: string }) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Location name required.');
      const canonicalId = (id || trimmedName)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!canonicalId) throw new Error('Location ID invalid.');
      const ref = doc(firestoreDb, 'locations', canonicalId);
      const payload = { name: trimmedName.toUpperCase(), subLocationPrompt: prompt.trim(), subLocations: [] as string[] };
      await setDoc(ref, payload, { merge: false });
      setLocations(prev => {
        if (prev.some(loc => loc.id === canonicalId)) {
          return prev.map(loc => (loc.id === canonicalId ? { ...loc, ...payload, id: canonicalId } : loc));
        }
        return [...prev, { id: canonicalId, ...payload }];
      });
      showToast(`Location ${payload.name} added.`, 'success');
    },
    [firestoreDb, showToast],
  );

  const handleUpdateLocationRecord = useCallback(
    async ({ id, name, prompt }: { id: string; name: string; prompt: string }) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Location name required.');
      const ref = doc(firestoreDb, 'locations', id);
      await updateDoc(ref, { name: trimmedName.toUpperCase(), subLocationPrompt: prompt.trim() });
      setLocations(prev => prev.map(loc => (loc.id === id ? { ...loc, name: trimmedName.toUpperCase(), subLocationPrompt: prompt.trim() } : loc)));
      showToast(`Location ${trimmedName.toUpperCase()} updated.`, 'success');
    },
    [firestoreDb, showToast],
  );

  const handleDeleteLocationRecord = useCallback(
    async (id: string) => {
      const hasStock = stock.some(entry => entry.locationId === id);
      if (hasStock && !window.confirm('This location has inventory assigned. Remove anyway?')) return;
      await deleteDoc(doc(firestoreDb, 'locations', id));
      setLocations(prev => prev.filter(loc => loc.id !== id));
      showToast('Location removed.', 'success');
    },
    [firestoreDb, showToast, stock],
  );

  const handleAddSubLocation = useCallback(
    async (locationId: string, subLocationName: string) => {
      const trimmed = subLocationName.trim().toUpperCase();
      if (!trimmed) throw new Error('Sub-location name required.');
      const ref = doc(firestoreDb, 'locations', locationId);
      await updateDoc(ref, { subLocations: arrayUnion(trimmed) });
      setLocations(prev =>
        prev.map(loc =>
          loc.id === locationId
            ? { ...loc, subLocations: Array.from(new Set([...(loc.subLocations || []), trimmed])) }
            : loc,
        ),
      );
      showToast(`Sub-location ${trimmed} added.`, 'success');
    },
    [firestoreDb, showToast],
  );

  const handleRemoveSubLocation = useCallback(
    async (locationId: string, subLocationName: string) => {
      const trimmed = subLocationName.trim().toUpperCase();
      if (!trimmed) return;
      const ref = doc(firestoreDb, 'locations', locationId);
      await updateDoc(ref, { subLocations: arrayRemove(trimmed) });
      setLocations(prev =>
        prev.map(loc =>
          loc.id === locationId
            ? { ...loc, subLocations: (loc.subLocations || []).filter(s => s !== trimmed) }
            : loc,
        ),
      );
      showToast(`Removed ${trimmed}.`, 'success');
    },
    [firestoreDb, showToast],
  );

  const handlePrintLocationLabels = useCallback(
    (locationId: string) => {
      const location = locations.find(loc => loc.id === locationId);
      if (!location) {
        showToast('Location not found.', 'error');
        return;
      }
      const locationStock = stock.filter(entry => entry.locationId === locationId);
      if (locationStock.length === 0) {
        showToast('No inventory at this location.', 'error');
        return;
      }
      const labels: PrintableLabel[] = locationStock.map(entry => {
        const item = items.find(i => i.id === entry.itemId);
        return {
          itemId: entry.itemId,
          description: item?.description || item?.name || entry.itemId,
          locationName: location.name,
          subLocationDetail: entry.subLocationDetail,
        };
      });
      setPrintableLabels(labels);
      showToast(`Prepared ${labels.length} labels for ${location.name}.`, 'success');
    },
    [items, locations, showToast, stock],
  );

  const handleFixInvalidItem = useCallback(
    async (item: InventoryItem) => {
      try {
        const sanitized = sanitizeInventoryItem(item);
        await setDoc(doc(firestoreDb, 'inventory', sanitized.id), sanitized, { merge: true });
        showToast(`Item ${sanitized.id} normalized.`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Failed to fix item.', 'error');
        throw err;
      }
    },
    [firestoreDb, showToast],
  );

  const handleDeleteStockEntry = useCallback(
    async (entry: Stock) => {
      if (!entry.docId) return;
      try {
        await deleteDoc(doc(firestoreDb, 'stock', entry.docId));
        showToast('Stock record removed.', 'success');
      } catch (err) {
        console.error(err);
        showToast('Failed to remove stock record.', 'error');
        throw err;
      }
    },
    [firestoreDb, showToast],
  );

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
          onHomeClick={() => {
            setCurrentView('dashboard');
            setFilterCategory('');
            setFilterLocation('');
            setFilterLowStock(false);
            setSearchQuery('');
          }}
          onAddItemClick={() => {
            setItemToDuplicate(null);
            setAddItemModalOpen(true);
          }}
          onMoveClick={() => openInventoryManagement('MOVE')}
          onAuditClick={() => openInventoryManagement('AUDIT')}
          onPrintBatchClick={() => setGenerateBarcodeSheetModalOpen(true)}
          onImportClick={() => setImportModalOpen(true)}
          onQuickExportClick={handleQuickExport}
          onSmartExportClick={() => setTailoredExportOpen(true)}
          onSearchClick={() => setIsSearchVisible(p => !p)}
          onScanClick={() => setScannerOpen(true)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
        />

        <div className="md:hidden h-[64px]" />

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
        />

        {isSearchVisible && (
          <div className="bg-amber-50 text-black text-center py-2 font-black text-xs uppercase tracking-widest sticky top-[64px] md:top-0 z-[60] shadow-sm flex items-center justify-center gap-2">
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
                      onViewAllInventory={() => setCurrentView('all')}
                      onViewCategories={() => setCurrentView('categories')}
                      onViewLocations={() => setCurrentView('locations')}
                      onWarehouseClick={id => {
                        setFilterLocation(id);
                        setCurrentView('all');
                      }}
                    />
                  </div>

                  <div className="hidden md:block">
                    <Suspense fallback={<div className="text-center py-8">Loading dashboard...</div>}>
                      <DesktopDashboard
                        items={items}
                        stock={stock}
                        locations={locations}
                        onInventoryManagement={() => openInventoryManagement('EDIT')}
                        onPrintClick={() => setGenerateBarcodeSheetModalOpen(true)}
                        onAuditLogClick={() => openInventoryManagement('AUDIT')}
                        onImportExportClick={() => setTailoredExportOpen(true)}
                        onWarehouseClick={id => {
                          setFilterLocation(id);
                          setCurrentView('all');
                        }}
                        onAdminCategories={() => setCurrentView('admin-categories')}
                        onAdminLocations={() => setCurrentView('admin-locations')}
                        onDatabaseManagement={() => setCurrentView('admin-audit')}
                      />
                    </Suspense>
                  </div>
                </>
              ) : currentView === 'admin-hub' ? (
                <AdminHub
                  onOpenInventoryConsole={() => openInventoryManagement('EDIT')}
                  onOpenMoveStock={() => openInventoryManagement('MOVE')}
                  onOpenAudit={() => openInventoryManagement('AUDIT')}
                  onOpenBarcode={() => setGenerateBarcodeSheetModalOpen(true)}
                  onOpenImport={() => setImportModalOpen(true)}
                  onOpenQuickExport={handleQuickExport}
                  onOpenSmartExport={() => setTailoredExportOpen(true)}
                  onGoToCategories={() => setCurrentView('admin-categories')}
                  onGoToLocations={() => setCurrentView('admin-locations')}
                  onGoToDatabase={() => setCurrentView('admin-audit')}
                />
              ) : currentView === 'admin-categories' ? (
                <CategoryManager onBack={() => setCurrentView('dashboard')} />
              ) : currentView === 'admin-locations' ? (
                <LocationManager
                  locations={locations}
                  items={items}
                  stock={stock}
                  onAddLocation={handleAddLocationRecord}
                  onUpdateLocation={handleUpdateLocationRecord}
                  onDeleteLocation={handleDeleteLocationRecord}
                  onAddSubLocation={handleAddSubLocation}
                  onRemoveSubLocation={handleRemoveSubLocation}
                  onManageInventory={locId => openInventoryManagement('MOVE', { locations: [locId] })}
                  onPrintLocation={handlePrintLocationLabels}
                  onBack={() => setCurrentView('dashboard')}
                />
              ) : currentView === 'admin-audit' ? (
                <Suspense fallback={<div className="text-center py-20">Loading audit tools...</div>}>
                  <DatabaseAudit
                    items={items}
                    stock={stock}
                    onFixItem={handleFixInvalidItem}
                    onDeleteStock={handleDeleteStockEntry}
                    onBack={() => setCurrentView('dashboard')}
                    onTriggerPurge={handlePurgeDatabase}
                  />
                </Suspense>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <Suspense fallback={<div className="text-center py-20">Loading table...</div>}>
                    <InventoryTable
                      items={items}
                      locations={locations}
                      stock={stock}
                      categoryHierarchyMap={categoryHierarchy}
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
                      onBulkEditClick={() => openInventoryManagement('EDIT')}
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
          onMoveClick={() => openInventoryManagement('MOVE')}
          onAuditClick={() => openInventoryManagement('AUDIT')}
          onAddClick={() => {
            setItemToDuplicate(null);
            setAddItemModalOpen(true);
          }}
          onSearchClick={() => setIsSearchVisible(p => !p)}
          onScanClick={() => setScannerOpen(true)}
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
              availableCategories={Object.keys(categoryHierarchy).sort((a, b) => a.localeCompare(b))}
              onShowToast={showToast}
              onManageCategories={() => {
                setAddItemModalOpen(false);
                setCurrentView('admin-categories');
              }}
            />
          </Suspense>
        )}

        {/* Modals */}
        {isInventoryMgmtOpen && (
          <Suspense fallback={<div className="p-6">Opening Inventory Console…</div>}>
            <InventoryManagementModal
              isOpen={isInventoryMgmtOpen}
              onClose={() => setInventoryMgmtOpen(false)}
              items={items}
              stock={stock}
              locations={locations}
              categoryHierarchy={categoryHierarchy}
              initialMode={inventoryMgmtMode}
              initialFilters={inventoryMgmtFilters}
              onSave={handleInventoryManagement}
              onOpenItemDetails={(item) => {
                const canonical = items.find(i => i.id === item.id) ?? item;
                setInventoryMgmtOpen(false);
                setItemToEdit(canonical);
                setEditModalOpen(true);
              }}
            />
          </Suspense>
        )}
        {isMoveModalOpen && itemToMove && (
          <Suspense fallback={<div className="p-6">Loading Move Stock…</div>}>
            <MoveStockModal item={itemToMove} locations={locations} stock={stock} onClose={() => setMoveModalOpen(false)} onMoveStock={handleMoveStock} />
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