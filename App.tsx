import React, { useState, useCallback, useEffect, Suspense, lazy, useMemo } from 'react';
import { db, auth } from './firebase';
import {
  collection,
  query,
  where,
  writeBatch,
  runTransaction,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  updateDoc,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { InventoryItem, Location, PurchaseOrderRecord, Stock, ReportDataItem, PrintableLabel, CycleCountSession } from './types';
import { useInventoryData } from './hooks/useInventoryData';
import { DbProvider } from './context/DbContext';

// Component Imports
import Header from './components/Header';
const InventoryTable = lazy(() => import('./components/InventoryTable'));
const AddItemModal = lazy(() => import('./components/AddItemModal'));
const EditItemModal = lazy(() => import('./components/EditItemModal'));
const MoveStockModal = lazy(() => import('./components/MoveStockModal'));
const ImportDataModal = lazy(() => import('./components/ImportDataModal'));
const EmDigitSheetsSyncModal = lazy(() => import('./components/EmDigitSheetsSyncModal'));
const GenerateReportModal = lazy(() => import('./components/GenerateReportModal'));
const ReportPreviewModal = lazy(() => import('./components/ReportPreviewModal'));
import NavigationView from './components/NavigationView';
const BarcodeScannerModal = lazy(() => import('./components/BarcodeScannerModal'));
const BarcodeSheetModal = lazy(() => import('./components/PrintBarcodeModal'));
const GenerateBarcodeSheetModal = lazy(() => import('./components/GenerateBarcodeSheetModal'));
const DesktopDashboard = lazy(() => import('./components/DesktopDashboard'));
const DashboardMetricDetail = lazy(() => import('./components/DashboardMetricDetail'));
const TailoredExportModal = lazy(() => import('./components/TailoredExportModal'));
const SelectPrintLocationModal = lazy(() => import('./components/SelectPrintLocationModal'));
const InventoryManagementModal = lazy(() => import('./components/InventoryManagementModal'));
const DatabaseAudit = lazy(() => import('./components/DatabaseAudit'));
const ExceptionsDashboard = lazy(() => import('./components/ExceptionsDashboard'));
const CycleCountView = lazy(() => import('./components/CycleCountView'));
import type { CycleCountPostPayload } from './components/CycleCountView';
import Toast from './components/Toast';
import MobileDashboard from './components/MobileDashboard';
import AdminHub from './components/AdminHub';
import type { DashboardMetricDetailView } from './components/DashboardMetricDetail';

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
  | 'dashboard-sku'
  | 'dashboard-warehouse-load'
  | 'dashboard-critical-alerts'
  | 'admin-hub'
  | 'admin-categories'
  | 'admin-locations'
  | 'admin-audit'
  | 'exceptions'
  | 'cycle-count';

/** Views that mount InventoryTable (where searchQuery is applied). */
const INVENTORY_LIST_VIEWS: ViewType[] = ['all', 'categories', 'locations'];

type BarcodeGeneratorPrintType = 'selected' | 'category' | 'location' | 'search';

interface BarcodeGeneratorContext {
  selectedItemIds?: string[];
  initialPrintType: BarcodeGeneratorPrintType;
  zIndexClassName?: string;
}

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

const omitUndefinedFields = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined && !(typeof value === 'number' && Number.isNaN(value))),
  ) as T;

const sanitizeInventoryItem = (item: InventoryItem): InventoryItem => {
  const threeYearAvgRaw = item.threeYearAvg;
  const sageQtyRaw = item.sageQty;
  const threeYearAvg =
    threeYearAvgRaw !== undefined && threeYearAvgRaw !== null && Number.isFinite(Number(threeYearAvgRaw))
      ? Number(threeYearAvgRaw)
      : undefined;
  const sageQty =
    sageQtyRaw !== undefined && sageQtyRaw !== null && Number.isFinite(Number(sageQtyRaw))
      ? Number(sageQtyRaw)
      : undefined;

  // Firestore rejects `undefined` field values — omit optional empties instead of writing them.
  return omitUndefinedFields({
    id: item.id.toUpperCase().trim(),
    name: item.name || item.description || 'UNNAMED',
    description: item.description || '',
    category: item.category || '',
    subCategory: item.subCategory || '',
    subCategory1: item.subCategory1 || [],
    subCategory2: item.subCategory2 || [],
    subCategory3: item.subCategory3 || '',
    lowAlertQuantity: Number(item.lowAlertQuantity || 0),
    price: Number(item.price || 0),
    priorUsage: (item.priorUsage || []).map(u => ({ year: Number(u.year), usage: Number(u.usage) })),
    color: item.color || '',
    threeYearAvg,
    sageQty,
    sageAsOf: (item.sageAsOf || '').trim() || undefined,
  }) as InventoryItem;
};

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

const sanitizePurchaseOrderRecord = (record: PurchaseOrderRecord): PurchaseOrderRecord => {
  const poNumber = (record.poNumber || '').toUpperCase().trim();
  const arrivalDates = Array.from(new Set((record.arrivalDates || []).map(date => (date || '').trim()).filter(Boolean))).sort();
  const itemIds = Array.from(new Set((record.itemIds || []).map(itemId => (itemId || '').toUpperCase().trim()).filter(Boolean))).sort();

  return {
    poNumber,
    vendor: (record.vendor || '').trim(),
    notes: (record.notes || '').trim(),
    arrivalDates,
    itemIds,
    createdDate: record.createdDate || arrivalDates[0] || '',
    updatedDate: record.updatedDate || new Date().toISOString().split('T')[0],
    docId: poNumber,
  };
};

interface AppProps {
  userEmail?: string | null;
  onSignOut: () => void | Promise<void>;
}

const App: React.FC<AppProps> = ({ userEmail, onSignOut }) => {
  // -- State --
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [definedCategories, setDefinedCategories] = useState<CategoryDefinition[]>([]);

  const [isAddItemModalOpen, setAddItemModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isMoveModalOpen, setMoveModalOpen] = useState(false);
  const [isImportModalOpen, setImportModalOpen] = useState(false);
  const [isEmDigitSyncOpen, setEmDigitSyncOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isScannerOpen, setScannerOpen] = useState(false);
  const [barcodeGeneratorContext, setBarcodeGeneratorContext] = useState<BarcodeGeneratorContext | null>(null);
  const [isTailoredExportOpen, setTailoredExportOpen] = useState(false);
  const [isInventoryMgmtOpen, setInventoryMgmtOpen] = useState(false);
  const [inventoryMgmtMode, setInventoryMgmtMode] = useState<'ADD' | 'EDIT' | 'AUDIT' | 'MOVE'>('ADD');
  const [inventoryMgmtFilters, setInventoryMgmtFilters] = useState<{ categories?: string[]; locations?: string[] }>({});
  const [inventoryMgmtItemIds, setInventoryMgmtItemIds] = useState<string[]>([]);

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
  const [isAdmin, setIsAdmin] = useState(false);
  const adminViews = new Set<ViewType>(['admin-hub', 'admin-categories', 'admin-locations', 'admin-audit']);
  useEffect(() => {
    let active = true;
    void auth.currentUser?.getIdTokenResult().then(result => {
      if (active) setIsAdmin(result.claims.admin === true);
    }).catch(console.error);
    return () => { active = false; };
  }, []);

  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterLocations, setFilterLocations] = useState<string[]>([]);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [navigationCategoryLink, setNavigationCategoryLink] = useState<string | null>(null);
  const [navigationLocationLink, setNavigationLocationLink] = useState<string | null>(null);

  const { items, stock, purchaseOrders, categoryHierarchyDoc, isLoading, error, syncWarning } = useInventoryData();

  // Derive a simple category -> list of subcategories map for modals/filters
  const categoryHierarchy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const hierarchyEntries =
      categoryHierarchyDoc && typeof categoryHierarchyDoc === 'object'
        ? Object.entries(categoryHierarchyDoc).filter(([main]) => (main || '').trim().length > 0)
        : [];
    const hasHierarchyDoc = hierarchyEntries.length > 0;

    const ensure = (cat: string) => {
      const key = (cat || '').trim();
      if (!key) return null;
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

    if (hasHierarchyDoc) {
      hierarchyEntries.forEach(([main, node]) => {
        const set = ensure(main);
        if (!set) return;
        ingestDoc(main, node);
      });
    }

    items.forEach(item => {
      const categoryKey = (item.category || '').trim();
      if (!categoryKey) return;
      if (hasHierarchyDoc && !map.has(categoryKey)) return;

      const set = ensure(categoryKey);
      if (!set) return;
      const add = (val?: string | null | undefined) => {
        if (val && val.trim()) set.add(val);
      };
      add(item.subCategory);
      add(item.subCategory3);
      if (Array.isArray(item.subCategory1)) item.subCategory1.forEach(add);
      if (Array.isArray(item.subCategory2)) item.subCategory2.forEach(add);
    });

    const result: Record<string, string[]> = {};
    map.forEach((set, key) => {
      result[key] = Array.from(set);
    });
    return result;
  }, [items, categoryHierarchyDoc]);

  // Ensure TypeScript sees the correct Firestore type for the imported db
  const firestoreDb = db as Firestore;

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const saveLocationOrder = useCallback(
    async (orderedLocationIds: string[]) => {
      await setDoc(doc(firestoreDb, 'settings', 'locationOrder'), { ids: orderedLocationIds }, { merge: true });
    },
    [firestoreDb],
  );

  // -- Fetch Data --
  useEffect(() => {
    const fetchAuxData = async () => {
      try {
        // Fetch Locations + persisted location order
        const [locSnap, locationOrderSnap] = await Promise.all([
          getDocs(collection(firestoreDb, 'locations')),
          getDoc(doc(firestoreDb, 'settings', 'locationOrder')),
        ]);
        if (!locSnap.empty) {
          const fetchedLocations = locSnap.docs.map(d => ({ id: d.id, ...d.data() } as Location));
          const persistedOrder =
            locationOrderSnap.exists() && Array.isArray(locationOrderSnap.data()?.ids)
              ? (locationOrderSnap.data()?.ids as string[])
              : [];

          setLocations(prev => {
            const fetchedById = new Map(fetchedLocations.map(loc => [loc.id, loc]));
            const ordered: Location[] = [];

            if (persistedOrder.length > 0) {
              persistedOrder.forEach(id => {
                const next = fetchedById.get(id);
                if (!next) return;
                ordered.push(next);
                fetchedById.delete(id);
              });
            } else {
              prev.forEach(existing => {
                const next = fetchedById.get(existing.id);
                if (!next) return;
                ordered.push(next);
                fetchedById.delete(existing.id);
              });
            }

            ordered.push(...Array.from(fetchedById.values()));
            return ordered;
          });
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
    async (item: InventoryItem, stockEntries: Omit<Stock, 'itemId'>[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        batch.set(doc(firestoreDb, 'inventory', item.id.toUpperCase()), sanitizeInventoryItem(item));
        stockEntries.forEach(se => {
          const stockItem = sanitizeStockItem({ ...se, itemId: item.id } as Stock);
          batch.set(doc(firestoreDb, 'stock', stockItem.docId!), stockItem);
        });
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
            // Allow seed/import of new categories (e.g. DIGITS from EM Digit Inventory).
            validCategories.add(cat);
            batch.set(doc(firestoreDb, 'categories', cat), { id: cat, subCategories: [] }, { merge: true });
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

  const handleEmDigitPull = useCallback(
    async (pulledItems: InventoryItem[]) => {
      // Pull is a narrow sheet → Firebase patch:
      // - Existing items: ONLY threeYearAvg + sageQty (+ sageAsOf when present).
      // - Brand-new sheet SKUs: minimal create (id/name/description); category left empty.
      // Never overwrite category, description, color, or stock. Push remains qty-only.
      try {
        if (pulledItems.length > 450) throw new Error('Pull too large.');
        const existingById = new Map(
          items.map(item => [item.id.toUpperCase().trim(), item] as const),
        );
        const batch = writeBatch(firestoreDb);
        let updated = 0;
        let created = 0;

        for (const pulled of pulledItems) {
          const sku = pulled.id?.toUpperCase().trim();
          if (!sku) continue;
          const existing = existingById.get(sku);

          if (existing) {
            const patch: Record<string, unknown> = {};
            if (pulled.threeYearAvg !== undefined && Number.isFinite(Number(pulled.threeYearAvg))) {
              patch.threeYearAvg = Number(pulled.threeYearAvg);
            }
            if (pulled.sageQty !== undefined && Number.isFinite(Number(pulled.sageQty))) {
              patch.sageQty = Number(pulled.sageQty);
            }
            const sageAsOf = (pulled.sageAsOf || '').trim();
            if (sageAsOf) patch.sageAsOf = sageAsOf;
            if (Object.keys(patch).length === 0) continue;
            batch.set(doc(firestoreDb, 'inventory', sku), omitUndefinedFields(patch), { merge: true });
            updated += 1;
          } else {
            if (!pulled.description?.trim() && !pulled.name?.trim()) {
              throw new Error(`Cannot create SKU ${sku} from sheet: missing description.`);
            }
            // Minimal seed only — app owns category/color going forward.
            const seeded = omitUndefinedFields({
              id: sku,
              name: pulled.name || pulled.description || 'UNNAMED',
              description: pulled.description || pulled.name || '',
              category: '',
              subCategory: '',
              subCategory1: [] as string[],
              subCategory2: [] as string[],
              subCategory3: '',
              lowAlertQuantity: 0,
              price: 0,
              priorUsage: [] as { year: number; usage: number }[],
              threeYearAvg:
                pulled.threeYearAvg !== undefined && Number.isFinite(Number(pulled.threeYearAvg))
                  ? Number(pulled.threeYearAvg)
                  : undefined,
              sageQty:
                pulled.sageQty !== undefined && Number.isFinite(Number(pulled.sageQty))
                  ? Number(pulled.sageQty)
                  : undefined,
              sageAsOf: (pulled.sageAsOf || '').trim() || undefined,
            }) as InventoryItem;
            batch.set(doc(firestoreDb, 'inventory', sku), seeded, { merge: false });
            created += 1;
          }
        }

        await batch.commit();
        showToast(
          `Pull complete: ${updated} updated (SAGE/3yr avg), ${created} created (minimal). Stock unchanged.`,
          'success',
        );
      } catch (e: any) {
        console.error(e);
        showToast(e.message || 'Pull failed.', 'error');
        throw e;
      }
    },
    [firestoreDb, items, showToast],
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
    async (item: InventoryItem, updatedStock: Stock[]) => {
      try {
        const batch = writeBatch(firestoreDb);
        batch.set(doc(firestoreDb, 'inventory', item.id), sanitizeInventoryItem(item), { merge: true });
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
    async (rawItemId: string, rawFromLoc: string, rawToLoc: string, qty: number, subDetail?: string) => {
      try {
        const itemId = rawItemId.toUpperCase().trim();
        const fromLoc = rawFromLoc.toLowerCase().trim();
        const toLoc = rawToLoc.toLowerCase().trim();
        if (!itemId || !fromLoc || !toLoc || fromLoc === toLoc) {
          throw new Error('Choose a valid SKU and two different locations.');
        }
        if (!Number.isSafeInteger(qty) || qty <= 0) {
          throw new Error('Transfer quantity must be a positive whole number.');
        }
        const stockAt = async (locationId: string) => getDocs(query(
          collection(firestoreDb, 'stock'),
          where('itemId', '==', itemId), where('locationId', '==', locationId),
        ));
        const [sourceMatches, destMatches] = await Promise.all([stockAt(fromLoc), stockAt(toLoc)]);
        if (sourceMatches.empty) throw new Error('No stock at source.');
        if (sourceMatches.size !== 1 || destMatches.size > 1) {
          throw new Error('Duplicate stock records found; reconcile them before transferring.');
        }
        // Preserve legacy document IDs on BOTH sides of the transfer.
        const fromRef = sourceMatches.docs[0].ref;
        const toRef = destMatches.docs[0]?.ref || doc(firestoreDb, 'stock', `${itemId}_${toLoc}`);
        await runTransaction(firestoreDb, async tx => {
          const [fromDoc, toDoc] = await Promise.all([tx.get(fromRef), tx.get(toRef)]);
          if (!fromDoc.exists()) throw new Error('Source stock changed; please retry.');
          const fromData = fromDoc.data() as Stock;
          const fromQty = Number(fromData.quantity);
          const toQty = toDoc.exists() ? Number(toDoc.data().quantity) : 0;
          if (!Number.isSafeInteger(fromQty) || fromQty < qty || !Number.isSafeInteger(toQty) || toQty < 0) {
            throw new Error('Insufficient or invalid stock quantity. Refresh before transferring.');
          }
          if (fromQty === qty) tx.delete(fromRef);
          else tx.update(fromRef, { quantity: fromQty - qty });

          if (toDoc.exists()) {
            const updates: { quantity: number; subLocationDetail?: string } = { quantity: toQty + qty };
            if (subDetail?.trim()) updates.subLocationDetail = subDetail.trim();
            tx.update(toRef, updates);
          } else {
            tx.set(toRef, sanitizeStockItem({
              itemId, locationId: toLoc, quantity: qty,
              subLocationDetail: subDetail?.trim() || '', source: fromData.source || 'OH',
            } as Stock));
          }
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
          const addKind = Array.isArray(payload) ? 'new' : payload?.kind === 'existing' ? 'existing' : 'new';
          const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
          const batch = writeBatch(firestoreDb);
          if (addKind === 'existing') {
            const groupedRows = rows.reduce((acc: Record<string, { itemId: string; locationId: string; quantity: number; source: 'OH' | 'PO'; poNumber: string; subLocationDetail: string }>, row: any) => {
              const itemId = row?.itemId?.toUpperCase().trim();
              const locationId = row?.locationId?.toLowerCase().trim();
              const quantity = Number(row?.quantity) || 0;
              const poNumber = typeof row?.poNumber === 'string' ? row.poNumber.trim().toUpperCase() : '';

              if (!itemId || !locationId || quantity <= 0) return acc;

              const key = `${itemId}|${locationId}`;
              if (!acc[key]) {
                acc[key] = {
                  itemId,
                  locationId,
                  quantity: 0,
                  source: row?.source === 'PO' ? 'PO' : 'OH',
                  poNumber: row?.source === 'PO' ? poNumber : '',
                  subLocationDetail: typeof row?.subLocationDetail === 'string' ? row.subLocationDetail.trim() : '',
                };
              }

              acc[key].quantity += quantity;
              if (row?.source === 'PO' || row?.source === 'OH') {
                acc[key].source = row.source;
                acc[key].poNumber = row.source === 'PO' ? poNumber : '';
              }
              if (typeof row?.subLocationDetail === 'string' && row.subLocationDetail.trim()) {
                acc[key].subLocationDetail = row.subLocationDetail.trim();
              }

              return acc;
            }, {});

            const staged = Object.values(groupedRows).filter(row =>
              items.some(item => item.id === row.itemId)
            );
            if (!staged.length) throw new Error('No valid existing inventory rows were staged.');
            // Discover actual Firestore document IDs (including legacy IDs)
            // before the transaction, and reject ambiguous duplicate records.
            const matches = await Promise.all(staged.map(row => getDocs(query(
              collection(firestoreDb, 'stock'),
              where('itemId', '==', row.itemId), where('locationId', '==', row.locationId),
            ))));
            if (matches.some(result => result.size > 1)) {
              throw new Error('Duplicate stock records detected; reconcile before receiving.');
            }
            const refs = staged.map((row, index) =>
              matches[index].docs[0]?.ref || doc(firestoreDb, 'stock', `${row.itemId}_${row.locationId}`)
            );
            await runTransaction(firestoreDb, async tx => {
              const docs = await Promise.all(refs.map(ref => tx.get(ref)));
              staged.forEach((row, index) => {
                const current = docs[index];
                const existing = current.exists() ? current.data() as Stock : null;
                const previous = existing ? Number(existing.quantity) : 0;
                if (!Number.isSafeInteger(previous) || previous < 0 ||
                    !Number.isSafeInteger(row.quantity) || row.quantity <= 0 ||
                    !Number.isSafeInteger(previous + row.quantity)) {
                  throw new Error('Invalid stock quantity; reconcile before receiving.');
                }
                // Keep existing barcode, source, and receipt history unless
                // the receipt explicitly supplies replacement metadata.
                const record = sanitizeStockItem({
                  itemId: row.itemId, locationId: row.locationId,
                  quantity: previous + row.quantity,
                  source: row.source || existing?.source || 'OH',
                  subLocationDetail: row.subLocationDetail || existing?.subLocationDetail || '',
                  locationBarcode: existing?.locationBarcode || '',
                  poNumber: row.source === 'PO' ? row.poNumber : existing?.poNumber || '',
                  dateReceived: effectiveDate || existing?.dateReceived || '',
                } as Stock);
                tx.set(current.ref, record);
              });
            });
          } else {
            rows.forEach((row: any) => {
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
                  poNumber: row.source === 'PO' ? row.poNumber || '' : '',
                  dateReceived: effectiveDate,
                } as Stock);
                batch.set(doc(firestoreDb, 'stock', stockRecord.docId!), stockRecord);
              }
            });
          }
          if (addKind !== 'existing') await batch.commit();
          showToast('Inventory batch processed.', 'success');
        } else if (mode === 'EDIT') {
          const batch = writeBatch(firestoreDb);
          if (Array.isArray(payload?.itemChanges)) {
            payload.itemChanges.forEach((change: {
              originalId: string;
              newId: string;
              description: string;
              category: string;
              subCategory?: string;
              subCategory1?: string[];
              subCategory2?: string[];
              subCategory3?: string;
            }) => {
              const originalId = change.originalId?.toUpperCase().trim();
              const newId = change.newId?.toUpperCase().trim();
              if (!originalId || !newId) return;

              const currentItem = items.find(item => item.id === originalId);
              if (!currentItem) return;

              const nextSub1 = Array.isArray(change.subCategory1)
                ? change.subCategory1.map(value => String(value || '').trim()).filter(Boolean)
                : (currentItem.subCategory1 || []);
              const nextSub2 = Array.isArray(change.subCategory2)
                ? change.subCategory2.map(value => String(value || '').trim()).filter(Boolean)
                : (currentItem.subCategory2 || []);
              const nextSub3 = typeof change.subCategory3 === 'string'
                ? change.subCategory3.trim()
                : typeof change.subCategory === 'string'
                  ? change.subCategory.trim()
                  : (currentItem.subCategory3 || currentItem.subCategory || '').trim();
              const nextLegacy = nextSub3 || nextSub2[0] || nextSub1[0] || '';

              const merged: InventoryItem = {
                ...currentItem,
                id: newId,
                name: change.description?.trim() || currentItem.name || newId,
                description: change.description?.trim() || currentItem.description,
                category: change.category?.trim() || currentItem.category,
                subCategory1: nextSub1,
                subCategory2: nextSub2,
                subCategory3: nextSub3,
                subCategory: nextLegacy,
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
          const adjustments = (payload as Array<{ itemId: string; locationId: string; qty: number; subLocationDetail?: string }>).map(entry => ({
            itemId: (entry.itemId || '').trim().toUpperCase(),
            locationId: (entry.locationId || '').trim().toLowerCase(),
            quantity: Number(entry.qty),
            subLocationDetail: entry.subLocationDetail,
          }));
          if (!adjustments.length || adjustments.length > 200) {
            throw new Error('An audit must contain 1–200 stock adjustments.');
          }
          const keys = new Set<string>();
          adjustments.forEach(entry => {
            const key = JSON.stringify([entry.itemId, entry.locationId]);
            if (!entry.itemId || !entry.locationId || !Number.isSafeInteger(entry.quantity) ||
                entry.quantity < 0 || keys.has(key)) {
              throw new Error('Invalid or duplicate audit adjustment.');
            }
            keys.add(key);
          });
          // Determine the exact document ID before transacting; legacy stock
          // documents must not be silently duplicated under a canonical ID.
          const matches = await Promise.all(adjustments.map(entry => getDocs(query(
            collection(firestoreDb, 'stock'),
            where('itemId', '==', entry.itemId), where('locationId', '==', entry.locationId),
          ))));
          if (matches.some(result => result.size > 1)) {
            throw new Error('Duplicate stock records detected; reconcile before auditing.');
          }
          const refs = adjustments.map((entry, index) =>
            matches[index].docs[0]?.ref || doc(firestoreDb, 'stock', `${entry.itemId}_${entry.locationId}`)
          );
          await runTransaction(firestoreDb, async tx => {
            const docs = await Promise.all(refs.map(ref => tx.get(ref)));
            adjustments.forEach((entry, index) => {
              const current = docs[index];
              const previous = current.exists() ? current.data() as Stock : null;
              const previousQty = previous ? Number(previous.quantity) : 0;
              const displayedEntries = stock.filter(s => s.itemId === entry.itemId && s.locationId === entry.locationId);
              const displayedQty = displayedEntries.reduce((total, record) => total + Number(record.quantity), 0);
              // A user must refresh/review an audit if stock changed since
              // the quantity displayed when the audit was opened.
              if (displayedEntries.length > 1 || !Number.isSafeInteger(previousQty) ||
                  !Number.isSafeInteger(displayedQty) || displayedQty !== previousQty) {
                throw new Error(`Stock changed for ${entry.itemId} at ${entry.locationId}. Refresh the audit before applying.`);
              }
              if (entry.quantity === 0) {
                if (current.exists()) tx.delete(current.ref);
              } else {
                const next = sanitizeStockItem({
                  itemId: entry.itemId, locationId: entry.locationId,
                  quantity: entry.quantity,
                  source: previous?.source || 'OH',
                  subLocationDetail: typeof entry.subLocationDetail === 'string'
                    ? entry.subLocationDetail : previous?.subLocationDetail || '',
                  locationBarcode: previous?.locationBarcode || '',
                  poNumber: previous?.poNumber || '',
                  dateReceived: effectiveDate || previous?.dateReceived || '',
                } as Stock);
                tx.set(current.ref, next);
              }
            });
          });
          showToast('Audit adjustments applied.', 'success');
        } else if (mode === 'MOVE') {
          // Resolve legacy stock document IDs once, then read EVERY affected
          // record inside one transaction. The Firestore transaction retries if
          // another transfer/receipt changes a quantity before commit.
          const transfers = (payload as Array<{ itemId: string; from: string; to: string; qty: number; subLocationDetail?: string }>).map(t => {
            const itemId = (t.itemId || '').toUpperCase().trim();
            const from = (t.from || '').toLowerCase().trim();
            const to = (t.to || '').toLowerCase().trim();
            const qty = Number(t.qty);
            if (!itemId || !from || !to || from === to || !Number.isSafeInteger(qty) || qty <= 0) {
              throw new Error('Each transfer needs a valid SKU, two different locations, and a positive whole-number quantity.');
            }
            return { itemId, from, to, qty, subLocationDetail: (t.subLocationDetail || '').trim() };
          });
          if (!transfers.length) throw new Error('No transfers were provided.');
          const keyOf = (itemId: string, locationId: string) => JSON.stringify([itemId, locationId]);
          const locationsByKey = new Map<string, { itemId: string; locationId: string }>();
          transfers.forEach(t => {
            locationsByKey.set(keyOf(t.itemId, t.from), { itemId: t.itemId, locationId: t.from });
            locationsByKey.set(keyOf(t.itemId, t.to), { itemId: t.itemId, locationId: t.to });
          });
          if (locationsByKey.size > 200) throw new Error('Please transfer fewer items at once.');
          const keys = [...locationsByKey.keys()];
          const locationsToRead = [...locationsByKey.values()];
          const matches = await Promise.all(locationsToRead.map(({ itemId, locationId }) =>
            getDocs(query(collection(firestoreDb, 'stock'),
              where('itemId', '==', itemId), where('locationId', '==', locationId)))
          ));
          if (matches.some(result => result.size > 1)) {
            throw new Error('Duplicate stock records detected; reconcile them before transferring.');
          }
          const refs = locationsToRead.map(({ itemId, locationId }, index) =>
            matches[index].docs[0]?.ref || doc(firestoreDb, 'stock', `${itemId}_${locationId}`)
          );
          await runTransaction(firestoreDb, async tx => {
            const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
            const states = new Map(keys.map((key, index) => {
              const snap = snapshots[index];
              const existing = snap.exists() ? snap.data() as Stock : null;
              const quantity = existing ? Number(existing.quantity) : 0;
              if (!Number.isSafeInteger(quantity) || quantity < 0) {
                throw new Error('Invalid stock quantity; reconcile before transferring.');
              }
              return [key, { ref: refs[index], existing, quantity }] as const;
            }));
            const outgoing = new Map<string, number>();
            const incoming = new Map<string, number>();
            const incomingDetail = new Map<string, string>();
            transfers.forEach(t => {
              const source = keyOf(t.itemId, t.from);
              const dest = keyOf(t.itemId, t.to);
              outgoing.set(source, (outgoing.get(source) || 0) + t.qty);
              incoming.set(dest, (incoming.get(dest) || 0) + t.qty);
              if (t.subLocationDetail) incomingDetail.set(dest, t.subLocationDetail);
            });
            keys.forEach(key => {
              const current = states.get(key)!;
              if ((outgoing.get(key) || 0) > current.quantity) {
                const loc = locationsByKey.get(key)!;
                throw new Error(`Insufficient stock at ${loc.locationId} for ${loc.itemId}.`);
              }
            });
            keys.forEach(key => {
              const state = states.get(key)!;
              const nextQty = state.quantity - (outgoing.get(key) || 0) + (incoming.get(key) || 0);
              if (nextQty === state.quantity && !incomingDetail.has(key)) return;
              if (nextQty === 0) {
                if (state.existing) tx.delete(state.ref);
              } else if (state.existing) {
                const detail = incomingDetail.get(key);
                tx.update(state.ref, detail
                  ? { quantity: nextQty, subLocationDetail: detail }
                  : { quantity: nextQty });
              } else {
                const loc = locationsByKey.get(key)!;
                tx.set(state.ref, sanitizeStockItem({
                  itemId: loc.itemId, locationId: loc.locationId, quantity: nextQty,
                  source: 'OH', subLocationDetail: incomingDetail.get(key) || '',
                  dateReceived: effectiveDate || '',
                } as Stock));
              }
            });
          });
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

  // Employees submit a pending session. Only the privileged approval path changes stock.
  const handleCycleCountPost = useCallback(async (payload: CycleCountPostPayload) => {
    const locationId = (payload.locationId || '').toLowerCase().trim();
    if (!locationId) throw new Error('Location is required.');
    if (!payload.lines?.length || payload.lines.length > 400) throw new Error('A count must contain 1–400 lines.');
    const unique = new Set<string>();
    const lines = payload.lines.map(line => {
      const itemId = (line.itemId || '').trim().toUpperCase();
      const countedQty = Number(line.countedQty);
      if (!itemId || unique.has(itemId) || !Number.isSafeInteger(countedQty) || countedQty < 0) {
        throw new Error('Invalid or duplicate count line.');
      }
      unique.add(itemId);
      return { itemId, countedQty, bookQty: Number(line.bookQty) || 0,
        variance: countedQty - (Number(line.bookQty) || 0),
        ...(line.subLocationDetail ? { subLocationDetail: line.subLocationDetail } : {}) };
    });
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in before submitting a count.');
    const sessionRef = doc(collection(firestoreDb, 'cycleCounts'));
    const now = new Date().toISOString();
    const session: CycleCountSession = {
      id: sessionRef.id, locationId, startedAt: payload.startedAt || now,
      completedAt: now, countedBy: user.email || user.uid,
      blindMode: Boolean(payload.blindMode), note: payload.note || '',
      lines, posted: false, status: 'pending',
    };
    await setDoc(sessionRef, session);
    showToast('Cycle count submitted for approval. No stock changed.', 'success');
    return { varianceCount: lines.filter(l => l.variance !== 0).length, sessionId: session.id };
  }, [firestoreDb, showToast]);

  const handleReviewCycleCount = useCallback(async (sessionId: string, approve: boolean) => {
    const reviewer = auth.currentUser;
    if (!reviewer || (await reviewer.getIdTokenResult(true)).claims.admin !== true) {
      throw new Error('Only an administrator can review cycle counts.');
    }
    const sessionRef = doc(firestoreDb, 'cycleCounts', sessionId);
    // Determine existing stock records, including legacy document IDs, before the
    // transaction. Read and validate the records AGAIN inside the transaction.
    const existingSession = await getDoc(sessionRef);
    if (!existingSession.exists() || existingSession.data().status !== 'pending') {
      throw new Error('This count has already been reviewed.');
    }
    const submitted = existingSession.data() as CycleCountSession;
    const sourceEntries = await Promise.all(submitted.lines.map(line =>
      getDocs(query(collection(firestoreDb, 'stock'),
        where('itemId', '==', line.itemId), where('locationId', '==', submitted.locationId)))
    ));
    if (sourceEntries.some(snapshot => snapshot.size > 1)) {
      throw new Error('Duplicate stock records detected. Reconcile before approving.');
    }
    const now = new Date().toISOString();
    await runTransaction(firestoreDb, async tx => {
      const sessionDoc = await tx.get(sessionRef);
      if (!sessionDoc.exists() || sessionDoc.data().status !== 'pending') {
        throw new Error('Count already reviewed. Refresh the approval list.');
      }
      const currentSession = sessionDoc.data() as CycleCountSession;
      if (currentSession.lines.length !== submitted.lines.length ||
          currentSession.locationId !== submitted.locationId) {
        throw new Error('Count changed during review; refresh.');
      }
      const stockRefs = submitted.lines.map((line, index) =>
        sourceEntries[index].docs[0]?.ref ||
          doc(firestoreDb, 'stock', `${line.itemId}_${submitted.locationId}`));
      const stockDocs = await Promise.all(stockRefs.map(ref => tx.get(ref)));
      if (approve) {
        submitted.lines.forEach((line, index) => {
          const current = stockDocs[index];
          const existing = current.exists() ? current.data() as Stock : null;
          const currentQty = existing ? Number(existing.quantity) : 0;
          if (!Number.isFinite(currentQty) || currentQty !== line.bookQty) {
            throw new Error(`Quantity changed for ${line.itemId}. Recount or resubmit before approval.`);
          }
          if (!Number.isSafeInteger(line.countedQty) || line.countedQty < 0) {
            throw new Error(`Invalid count for ${line.itemId}.`);
          }
          if (line.countedQty === 0) {
            if (current.exists()) tx.delete(current.ref);
          } else {
            const updated = sanitizeStockItem({
              itemId: line.itemId, locationId: submitted.locationId,
              quantity: line.countedQty, source: existing?.source || 'OH',
              subLocationDetail: line.subLocationDetail || existing?.subLocationDetail || '',
              locationBarcode: existing?.locationBarcode || '', poNumber: existing?.poNumber || '',
              dateReceived: existing?.dateReceived || now.slice(0, 10),
            } as Stock);
            tx.set(current.ref, updated);
          }
        });
      }
      tx.update(sessionRef, { status: approve ? 'approved' : 'rejected',
        posted: approve, reviewedAt: now, reviewedBy: reviewer.email || reviewer.uid });
    });
    showToast(approve ? 'Cycle count approved and inventory updated.' : 'Cycle count rejected.', 'success');
  }, [firestoreDb, showToast]);

  const handleUpsertPurchaseOrder = useCallback(
    async (record: PurchaseOrderRecord) => {
      const today = new Date().toISOString().split('T')[0];
      const sanitized = sanitizePurchaseOrderRecord({ ...record, updatedDate: today });

      if (!sanitized.poNumber) {
        throw new Error('PO number is required.');
      }

      const ref = doc(firestoreDb, 'purchaseOrders', sanitized.poNumber);
      const existingSnap = await getDoc(ref);
      const existing = existingSnap.exists() ? sanitizePurchaseOrderRecord(existingSnap.data() as PurchaseOrderRecord) : null;

      const merged = sanitizePurchaseOrderRecord({
        poNumber: sanitized.poNumber,
        vendor: sanitized.vendor,
        notes: sanitized.notes,
        arrivalDates: [...(existing?.arrivalDates || []), ...(sanitized.arrivalDates || [])],
        itemIds: [...(existing?.itemIds || []), ...(sanitized.itemIds || [])],
        createdDate: existing?.createdDate || sanitized.createdDate || today,
        updatedDate: today,
      });

      await setDoc(ref, merged, { merge: false });
      showToast(`PO ${merged.poNumber} saved.`, 'success');
      return merged;
    },
    [firestoreDb, showToast],
  );

  const openInventoryManagement = useCallback(
    (
      mode: 'ADD' | 'EDIT' | 'AUDIT' | 'MOVE',
      options?: { categories?: string[]; locations?: string[]; itemIds?: string[] },
    ) => {
      setInventoryMgmtMode(mode === 'ADD' ? 'ADD' : 'EDIT');
      setInventoryMgmtFilters({ categories: options?.categories, locations: options?.locations });
      setInventoryMgmtItemIds(options?.itemIds || []);
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
      const nextLocations = locations.some(loc => loc.id === canonicalId)
        ? locations.map(loc => (loc.id === canonicalId ? { ...loc, ...payload, id: canonicalId } : loc))
        : [...locations, { id: canonicalId, ...payload }];
      setLocations(nextLocations);
      await saveLocationOrder(nextLocations.map(loc => loc.id));
      showToast(`Location ${payload.name} added.`, 'success');
    },
    [firestoreDb, showToast, locations, saveLocationOrder],
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
      const nextLocations = locations.filter(loc => loc.id !== id);
      setLocations(nextLocations);
      await saveLocationOrder(nextLocations.map(loc => loc.id));
      showToast('Location removed.', 'success');
    },
    [firestoreDb, showToast, stock, locations, saveLocationOrder],
  );

  const handleReorderLocationRecord = useCallback(
    async (locationId: string, direction: -1 | 1) => {
      const currentIndex = locations.findIndex(loc => loc.id === locationId);
      if (currentIndex === -1) return;
      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= locations.length) return;

      const nextLocations = [...locations];
      [nextLocations[currentIndex], nextLocations[targetIndex]] = [nextLocations[targetIndex], nextLocations[currentIndex]];
      setLocations(nextLocations);
      await saveLocationOrder(nextLocations.map(loc => loc.id));
      showToast('Location order updated.', 'success');
    },
    [locations, saveLocationOrder, showToast],
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

  const handlePurgeLegacyCategoryColors = useCallback(async () => {
    if (!window.confirm('Delete all legacy categoryColors documents?')) return;
    try {
      const batchLimit = 400;
      let batch = writeBatch(firestoreDb);
      let count = 0;
      let deleted = 0;
      const commit = async () => {
        if (count > 0) {
          await batch.commit();
          batch = writeBatch(firestoreDb);
          count = 0;
        }
      };

      const colorsSnap = await getDocs(collection(firestoreDb, 'categoryColors'));
      for (const d of colorsSnap.docs) {
        batch.delete(d.ref);
        count++;
        deleted++;
        if (count >= batchLimit) await commit();
      }
      await commit();
      showToast(deleted > 0 ? `Removed ${deleted} legacy categoryColors docs.` : 'No legacy categoryColors docs found.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to purge legacy categoryColors docs.', 'error');
    }
  }, [showToast, firestoreDb]);

  const clearInventoryFilters = useCallback(() => {
    setFilterCategories([]);
    setFilterLocations([]);
    setFilterLowStock(false);
    setSearchQuery('');
  }, []);

  const toggleSearchBar = useCallback(() => {
    if (!isSearchVisible) {
      setNavigationCategoryLink(null);
      setNavigationLocationLink(null);
      setCurrentView(current => (INVENTORY_LIST_VIEWS.includes(current) ? current : 'all'));
    }
    setIsSearchVisible(!isSearchVisible);
  }, [isSearchVisible]);

  // Keep search results visible if the user types while still on a non-list view.
  useEffect(() => {
    if (!searchQuery.trim()) return;
    setCurrentView(current => (INVENTORY_LIST_VIEWS.includes(current) ? current : 'all'));
  }, [searchQuery]);

  const clearNavigationTree = useCallback(() => {
    setNavigationCategoryLink(null);
    setNavigationLocationLink(null);
  }, []);

  const openBarcodeGenerator = useCallback((options?: Partial<BarcodeGeneratorContext>) => {
    setBarcodeGeneratorContext({
      selectedItemIds: options?.selectedItemIds,
      initialPrintType: options?.initialPrintType ?? 'search',
      zIndexClassName: options?.zIndexClassName,
    });
  }, []);

  const closeBarcodeGenerator = useCallback(() => {
    setBarcodeGeneratorContext(null);
  }, []);

  const handleBarcodeGeneration = useCallback((labels: PrintableLabel[]) => {
    setPrintableLabels(labels);
    setBarcodeGeneratorContext(null);
  }, []);

  const handleDashboardSummaryOpen = useCallback(
    (view: DashboardMetricDetailView) => {
      clearInventoryFilters();
      clearNavigationTree();
      setCurrentView(view);
    },
    [clearInventoryFilters, clearNavigationTree],
  );

  const handleWarehouseDashboardDrilldown = useCallback(
    (locationId: string) => {
      clearNavigationTree();
      setFilterLocations([locationId]);
      setCurrentView('all');
    },
    [clearNavigationTree],
  );

  const handleNavigationViewChange = useCallback(
    (view: ViewType) => {
      clearNavigationTree();
      if (adminViews.has(view) && !isAdmin) {
        showToast('Administrator access required.', 'error');
        return;
      }
      setCurrentView(view);
    },
    [clearNavigationTree, isAdmin, showToast],
  );

  const handleCategoryTreeNavigate = useCallback(
    (value: string | null) => {
      clearInventoryFilters();
      setNavigationLocationLink(null);
      setNavigationCategoryLink(value);
      setCurrentView('categories');
    },
    [clearInventoryFilters],
  );

  const handleLocationTreeNavigate = useCallback(
    (value: string | null) => {
      clearInventoryFilters();
      setNavigationCategoryLink(null);
      setNavigationLocationLink(value);
      setCurrentView('locations');
    },
    [clearInventoryFilters],
  );

  if (error) return <div className="p-4 text-red-600 font-bold">{error}</div>;

  return (
    <DbProvider db={db}>
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {/** Top Header + Controls (ALT Layout) */}
        <Header
          onHomeClick={() => {
            setCurrentView('dashboard');
            clearInventoryFilters();
            clearNavigationTree();
          }}
          onSearchClick={toggleSearchBar}
          onScanClick={() => setScannerOpen(true)}
          onMenuClick={() => setIsMobileMenuOpen(true)}
          userEmail={userEmail}
          onSignOut={onSignOut}
        />

        <div className="md:hidden h-[64px]" />
        {syncWarning && <div role="alert" className="bg-amber-100 text-amber-950 px-4 py-3 font-semibold text-sm">{syncWarning}</div>}

        <NavigationView
          isAdmin={isAdmin}
          currentView={currentView}
          onViewChange={handleNavigationViewChange}
          onCategoryNavigate={handleCategoryTreeNavigate}
          onLocationNavigate={handleLocationTreeNavigate}
          onOpenBarcodeLabels={() => openBarcodeGenerator()}
          onClearFilters={clearInventoryFilters}
          items={items}
          categoryHierarchyDoc={categoryHierarchyDoc}
          locations={locations}
          activeCategoryLink={navigationCategoryLink}
          activeLocationLink={navigationLocationLink}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
        />

        {isSearchVisible && (
          <div className="bg-white border-b border-gray-200 sticky top-[64px] md:top-16 z-[40] shadow-sm">
            <div className="fluid-container py-3 w-full">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  className="form-control !pl-10"
                  placeholder="SEARCH..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
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
                      onViewAllInventory={() => handleNavigationViewChange('all')}
                      onViewCategories={() => handleNavigationViewChange('categories')}
                      onViewLocations={() => handleNavigationViewChange('locations')}
                      onOpenSkuSummary={() => handleDashboardSummaryOpen('dashboard-sku')}
                      onOpenWarehouseSummary={() => handleDashboardSummaryOpen('dashboard-warehouse-load')}
                      onOpenCriticalAlerts={() => handleDashboardSummaryOpen('dashboard-critical-alerts')}
                      onWarehouseClick={handleWarehouseDashboardDrilldown}
                    />
                  </div>

                  <div className="hidden md:block">
                    <Suspense fallback={<div className="text-center py-8">Loading dashboard...</div>}>
                      <DesktopDashboard
                        isAdmin={isAdmin}
                        items={items}
                        stock={stock}
                        locations={locations}
                        onInventoryManagement={() => openInventoryManagement('EDIT')}
                        onImportExportClick={() => setTailoredExportOpen(true)}
                        onSyncEmSheetClick={() => setEmDigitSyncOpen(true)}
                        onWarehouseClick={handleWarehouseDashboardDrilldown}
                        onAdminCategories={() => setCurrentView('admin-categories')}
                        onAdminLocations={() => setCurrentView('admin-locations')}
                        onDatabaseManagement={() => setCurrentView('admin-audit')}
                        onExceptionsClick={() => setCurrentView('exceptions')}
                        onCycleCountClick={() => setCurrentView('cycle-count')}
                        onTotalSkuClick={() => handleDashboardSummaryOpen('dashboard-sku')}
                        onWarehouseLoadClick={() => handleDashboardSummaryOpen('dashboard-warehouse-load')}
                        onCriticalAlertsClick={() => handleDashboardSummaryOpen('dashboard-critical-alerts')}
                      />
                    </Suspense>
                  </div>
                </>
              ) : currentView === 'dashboard-sku' || currentView === 'dashboard-warehouse-load' || currentView === 'dashboard-critical-alerts' ? (
                <Suspense fallback={<div className="text-center py-20">Loading dashboard detail...</div>}>
                  <DashboardMetricDetail
                    view={currentView}
                    items={items}
                    stock={stock}
                    locations={locations}
                    onBack={() => setCurrentView('dashboard')}
                    onOpenLocationInventory={handleWarehouseDashboardDrilldown}
                  />
                </Suspense>
              ) : currentView === 'admin-hub' && isAdmin ? (
                <AdminHub
                  onOpenInventoryConsole={() => openInventoryManagement('EDIT')}
                  onGoToCategories={() => setCurrentView('admin-categories')}
                  onGoToLocations={() => setCurrentView('admin-locations')}
                  onGoToDatabase={() => setCurrentView('admin-audit')}
                  onGoToExceptions={() => setCurrentView('exceptions')}
                  onGoToCycleCount={() => setCurrentView('cycle-count')}
                  onOpenImportExport={() => setTailoredExportOpen(true)}
                  onOpenEmDigitSync={() => setEmDigitSyncOpen(true)}
                />
              ) : currentView === 'admin-categories' && isAdmin ? (
                <CategoryManager onBack={() => setCurrentView('dashboard')} />
              ) : currentView === 'admin-locations' && isAdmin ? (
                <LocationManager
                  locations={locations}
                  items={items}
                  stock={stock}
                  onAddLocation={handleAddLocationRecord}
                  onUpdateLocation={handleUpdateLocationRecord}
                  onDeleteLocation={handleDeleteLocationRecord}
                  onReorderLocation={handleReorderLocationRecord}
                  onAddSubLocation={handleAddSubLocation}
                  onRemoveSubLocation={handleRemoveSubLocation}
                  onManageInventory={locId => openInventoryManagement('MOVE', { locations: [locId] })}
                  onPrintLocation={handlePrintLocationLabels}
                  onBack={() => setCurrentView('dashboard')}
                />
              ) : currentView === 'admin-audit' && isAdmin ? (
                <Suspense fallback={<div className="text-center py-20">Loading audit tools...</div>}>
                  <DatabaseAudit
                    items={items}
                    stock={stock}
                    onFixItem={handleFixInvalidItem}
                    onDeleteStock={handleDeleteStockEntry}
                    onBack={() => setCurrentView('dashboard')}
                    onTriggerPurge={handlePurgeDatabase}
                    onPurgeLegacyCategoryColors={handlePurgeLegacyCategoryColors}
                  />
                </Suspense>
              ) : currentView === 'exceptions' ? (
                <Suspense fallback={<div className="text-center py-20">Loading exceptions...</div>}>
                  <ExceptionsDashboard
                    items={items}
                    stock={stock}
                    locations={locations}
                    onBack={() => setCurrentView('dashboard')}
                    onSelectItem={isAdmin ? id => {
                      const item = items.find(i => i.id === id);
                      if (item) {
                        setItemToEdit(item);
                        setEditModalOpen(true);
                      }
                    } : undefined}
                  />
                </Suspense>
              ) : currentView === 'cycle-count' ? (
                <Suspense fallback={<div className="text-center py-20">Loading cycle count...</div>}>
                  <CycleCountView
                    items={items}
                    stock={stock}
                    locations={locations}
                    categories={Object.keys(categoryHierarchy).filter(cat => cat.toUpperCase() !== 'UNCATEGORIZED')}
                    onBack={() => setCurrentView('dashboard')}
                    onPost={handleCycleCountPost}
                    isAdmin={isAdmin}
                    onApprove={id => handleReviewCycleCount(id, true)}
                    onReject={id => handleReviewCycleCount(id, false)}
                  />
                </Suspense>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <Suspense fallback={<div className="text-center py-20">Loading table...</div>}>
                    <InventoryTable
                      isAdmin={isAdmin}
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
                        if (!isAdmin) return;
                        const canonical = items.find(i => i.id === (item as InventoryItem).id) ?? (item as InventoryItem);
                        setItemToMove(canonical);
                        setMoveModalOpen(true);
                      }}
                      onDeleteClick={id => { if (isAdmin) setItemToDelete(id); }}
                      onDuplicateClick={() => { if (isAdmin) setAddItemModalOpen(true); }}
                      onEditClick={item => {
                        if (!isAdmin) return;
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
                      onBulkEditClick={() => { if (isAdmin) openInventoryManagement('EDIT', { itemIds: Array.from(selectedItemIds) }); }}
                      view={currentView as any}
                      searchQuery={searchQuery}
                      navigationCategoryLink={navigationCategoryLink}
                      navigationLocationLink={navigationLocationLink}
                      filterCategories={filterCategories}
                      filterLocations={filterLocations}
                      filterLowStock={filterLowStock}
                      onSetFilterCategories={setFilterCategories}
                      onSetFilterLocations={setFilterLocations}
                      onSetFilterLowStock={setFilterLowStock}
                      onViewChange={v => handleNavigationViewChange(v as ViewType)}
                    />
                  </Suspense>
                </div>
              )}
            </>
          )}
        </div>

        {isAdmin && currentView !== 'cycle-count' && (
        <MobileFooter
          onMoveClick={() => openInventoryManagement('MOVE')}
          onAuditClick={() => openInventoryManagement('AUDIT')}
          onAddClick={() => {
            setItemToDuplicate(null);
            setAddItemModalOpen(true);
          }}
          onSearchClick={toggleSearchBar}
          onScanClick={() => setScannerOpen(true)}
        />
        )}

        {isAdmin && isAddItemModalOpen && (
          <Suspense fallback={<div className="p-6">Opening Add Item…</div>}>
            <AddItemModal
              onClose={() => setAddItemModalOpen(false)}
              onAddItem={handleAddItem}
              locations={locations}
              existingItemIds={items.map(i => i.id)}
              itemToDuplicate={itemToDuplicate}
              availableCategories={Object.keys(categoryHierarchy).filter(cat => cat.toUpperCase() !== 'UNCATEGORIZED')}
              onShowToast={showToast}
            />
          </Suspense>
        )}

        {/* Modals */}
        {isAdmin && isInventoryMgmtOpen && (
          <Suspense fallback={<div className="p-6">Opening Inventory Console…</div>}>
            <InventoryManagementModal
              isOpen={isInventoryMgmtOpen}
              onClose={() => setInventoryMgmtOpen(false)}
              items={items}
              stock={stock}
              purchaseOrders={purchaseOrders}
              locations={locations}
              categoryHierarchy={categoryHierarchy}
              categoryHierarchyDoc={categoryHierarchyDoc}
              initialMode={inventoryMgmtMode}
              initialFilters={inventoryMgmtFilters}
              initialItemIds={inventoryMgmtItemIds}
              onSave={handleInventoryManagement}
              onUpsertPurchaseOrder={handleUpsertPurchaseOrder}
              onOpenItemDetails={(item) => {
                const canonical = items.find(i => i.id === item.id) ?? item;
                setItemToEdit(canonical);
                setEditModalOpen(true);
              }}
              onOpenBarcodeGenerator={(itemIds) =>
                openBarcodeGenerator({
                  selectedItemIds: itemIds,
                  initialPrintType: itemIds.length > 0 ? 'selected' : 'search',
                  zIndexClassName: 'z-[130]',
                })
              }
            />
          </Suspense>
        )}
        {isAdmin && isMoveModalOpen && itemToMove && (
          <Suspense fallback={<div className="p-6">Loading Move Stock…</div>}>
            <MoveStockModal item={itemToMove} locations={locations} stock={stock} onClose={() => setMoveModalOpen(false)} onMoveStock={handleMoveStock} />
          </Suspense>
        )}
        {isAdmin && isTailoredExportOpen && (
          <Suspense fallback={<div className="p-6">Opening Export…</div>}>
            <TailoredExportModal onClose={() => setTailoredExportOpen(false)} onExport={() => {}} />
          </Suspense>
        )}
        {isAdmin && isImportModalOpen && (
          <Suspense fallback={<div className="p-6">Loading Import…</div>}>
            <ImportDataModal onClose={() => setImportModalOpen(false)} onImport={handleImport} />
          </Suspense>
        )}
        {isAdmin && isEmDigitSyncOpen && (
          <Suspense fallback={<div className="p-6">Opening EM Sheet Sync…</div>}>
            <EmDigitSheetsSyncModal
              onClose={() => setEmDigitSyncOpen(false)}
              items={items}
              stock={stock}
              onPull={handleEmDigitPull}
            />
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
        {barcodeGeneratorContext && (
          <Suspense fallback={<div className="p-6">Preparing Barcode Generator…</div>}>
            <GenerateBarcodeSheetModal
              onClose={closeBarcodeGenerator}
              onGenerate={handleBarcodeGeneration}
              items={items}
              stock={stock}
              locations={locations}
              selectedItemIds={
                barcodeGeneratorContext.selectedItemIds !== undefined
                  ? new Set(barcodeGeneratorContext.selectedItemIds)
                  : selectedItemIds
              }
              initialPrintType={barcodeGeneratorContext.initialPrintType}
              zIndexClassName={barcodeGeneratorContext.zIndexClassName}
            />
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
        {isAdmin && isEditModalOpen && itemToEdit && (
          <Suspense fallback={<div className="p-6">Loading editor…</div>}>
            <EditItemModal
              item={itemToEdit}
              stock={stock.filter(s => s.itemId === itemToEdit.id)}
              locations={locations}
              onClose={() => {
                setEditModalOpen(false);
                setItemToEdit(null);
              }}
              onEditItem={(updatedItem, updatedStock) => {
                handleEditItem(updatedItem, updatedStock);
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
              fieldToFocus={null}
            />
          </Suspense>
        )}
      </div>
    </DbProvider>
  );
};

export default App;