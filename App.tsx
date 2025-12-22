import React, { useState, useCallback } from 'react';
import { db } from './firebase';
import { 
    collection, 
    query, 
    where, 
    writeBatch, 
    runTransaction, 
    getDocs, 
    doc
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

// Icon Imports
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';
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

const sanitizeStockItem = (stockItem: Stock): Stock => {
    const itemId = stockItem.itemId.toUpperCase().trim();
    const locationId = stockItem.locationId.toLowerCase().trim();
    // Create deterministic ID to prevent duplicates (SKU_LOCATION)
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
        docId // Attach the ID for Firestore reference
    };
};

const App: React.FC = () => {
    // -- State --
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

    // -- Custom Hook for Data Fetching --
    const { items, stock, categoryColors, isLoading, error } = useInventoryData();

    const showToast = useCallback((message: string, type: 'success' | 'error') => {
        setToast({ message, type });
    }, []);

    // -- Handlers --

    const handleDeleteItem = useCallback(async (itemId: string) => {
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'inventory', itemId));
            // Delete all stock records associated with this item
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
                const stockItem = sanitizeStockItem({ ...se, itemId: item.id } as Stock);
                // Use deterministic ID to prevent duplicates
                const stockRef = doc(db, 'stock', stockItem.docId!); 
                batch.set(stockRef, stockItem);
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

            // 1. Upsert Inventory Items
            newItems.forEach(item => {
                const itemRef = doc(db, 'inventory', item.id.toUpperCase());
                batch.set(itemRef, sanitizeInventoryItem(item), { merge: true });
            });

            // 2. Upsert Stock Entries using Deterministic IDs
            newStock.forEach(s => {
                const stockItem = sanitizeStockItem(s);
                // docId is now SKUID_LOCATIONID (e.g., "554-28-3205_wh-j")
                const stockRef = doc(db, 'stock', stockItem.docId!);
                batch.set(stockRef, stockItem, { merge: true });
            });

            await batch.commit();
            setImportModalOpen(false);
            showToast(`Manifest Processed: Records updated successfully.`, 'success');
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

            // Remove existing stock records for this item to prevent orphans
            const q = query(collection(db, 'stock'), where('itemId', '==', item.id));
            const snap = await getDocs(q);
            snap.docs.forEach(d => batch.delete(d.ref));
            
            // Add updated stock records with deterministic IDs
            updatedStock.forEach(s => {
                const stockItem = sanitizeStockItem({ ...s, itemId: item.id });
                const stockRef = doc(db, 'stock', stockItem.docId!);
                batch.set(stockRef, stockItem);
            });

            await batch.commit();
            setEditModalOpen(false);
            setItemToEdit(null);
            showToast(`SKU ${item.id} records updated.`, 'success');
        } catch (e: any) {
            console.error(e);
            showToast('Failed to sync item updates.', 'error');
        }
    }, [showToast]);

    const handleMoveStock = useCallback(async (itemId: string, fromLoc: string, toLoc: string, qty: number, subDetail?: string) => {
        try {
            await runTransaction(db, async (tx) => {
                // Find source document
                const fromQ = query(collection(db, "stock"), where("itemId", "==", itemId), where("locationId", "==", fromLoc));
                const fromSnap = await getDocs(fromQ);
                if (fromSnap.empty) throw new Error("Source location has zero units.");
                
                const fromRef = fromSnap.docs[0].ref;
                const fromDoc = await tx.get(fromRef);
                const fromData = fromDoc.data() as Stock;
                
                if (fromData.
