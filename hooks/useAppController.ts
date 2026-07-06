import { useCallback, useMemo, useState } from 'react';
import { useDb } from '../context/DbContext';
import { InventoryItem, PrintableLabel, ReportDataItem, Stock } from '../types';
import { useInventoryData } from './useInventoryData';
import { useLocations } from './useLocations';
import { useToast } from './useToast';
import * as inventoryService from '../services/inventoryService';
import * as stockService from '../services/stockService';
import { buildQuickExportCSV, buildTailoredExportCSV, downloadCSV } from '../services/exportService';
import { ReportOptions, buildReportData, countLowAlertItems } from '../services/reportService';

export type ViewType =
  | 'all'
  | 'categories'
  | 'locations'
  | 'dashboard'
  | 'admin-hub'
  | 'admin-categories'
  | 'admin-locations'
  | 'admin-purge';

export type ModalName =
  | 'addItem'
  | 'edit'
  | 'move'
  | 'import'
  | 'report'
  | 'bulkEdit'
  | 'scanner'
  | 'barcodeSheet'
  | 'tailoredExport'
  | 'bulkTransfer'
  | 'massStockUpdate';

const CLOSED_MODALS: Record<ModalName, boolean> = {
  addItem: false,
  edit: false,
  move: false,
  import: false,
  report: false,
  bulkEdit: false,
  scanner: false,
  barcodeSheet: false,
  tailoredExport: false,
  bulkTransfer: false,
  massStockUpdate: false,
};

/**
 * All application state and business logic. App.tsx and AppModals are
 * render-only consumers of this controller.
 */
export const useAppController = () => {
  const db = useDb();
  const { items, stock, categoryColors, isLoading, error } = useInventoryData();
  const locationsApi = useLocations();
  const { locations } = locationsApi;
  const { toast, showToast, clearToast } = useToast();

  // -- UI state --
  const [modals, setModals] = useState(CLOSED_MODALS);
  const openModal = useCallback((m: ModalName) => setModals(p => ({ ...p, [m]: true })), []);
  const closeModal = useCallback((m: ModalName) => setModals(p => ({ ...p, [m]: false })), []);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // -- Modal payloads --
  const [itemToEdit, setItemToEdit] = useState<InventoryItem | null>(null);
  const [itemToMove, setItemToMove] = useState<InventoryItem | null>(null);
  const [itemToDuplicate, setItemToDuplicate] = useState<InventoryItem | null>(null);
  const [itemToPrint, setItemToPrint] = useState<InventoryItem | null>(null);
  const [printableLabels, setPrintableLabels] = useState<PrintableLabel[] | null>(null);
  const [reportData, setReportData] = useState<ReportDataItem[] | null>(null);

  const lowAlertItemCount = useMemo(() => countLowAlertItems(items, stock), [items, stock]);

  const clearFilters = useCallback(() => {
    setFilterCategory('');
    setFilterLocation('');
    setFilterLowStock(false);
    setSearchQuery('');
  }, []);

  // -- Inventory actions --
  const handleAddItem = useCallback(async (item: InventoryItem, stockEntries: Omit<Stock, 'itemId'>[], colors?: inventoryService.CategoryColorChanges) => {
    try {
      await inventoryService.addItem(db, item, stockEntries, colors);
      closeModal('addItem');
      setItemToDuplicate(null);
      showToast('Item added.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to add item.', 'error');
    }
  }, [db, closeModal, showToast]);

  const handleEditItem = useCallback(async (item: InventoryItem, updatedStock: Stock[], colors?: inventoryService.CategoryColorChanges) => {
    try {
      await inventoryService.editItem(db, item, updatedStock, colors);
      closeModal('edit');
      showToast(`SKU ${item.id} updated.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Update failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  const handleDeleteItem = useCallback(async (itemId: string) => {
    try {
      await inventoryService.deleteItem(db, itemId);
      showToast(`SKU ${itemId} purged.`, 'success');
      closeModal('edit');
    } catch (e) {
      console.error(e);
      showToast('Deletion failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  const handleBatchDeleteItems = useCallback(async (ids: string[]) => {
    try {
      await inventoryService.batchDeleteItems(db, ids, stock);
      showToast(`Purged ${ids.length} items successfully.`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Batch delete failed.', 'error');
    }
  }, [db, stock, showToast]);

  const handleBulkEdit = useCallback(async (changes: inventoryService.BulkCategoryChanges) => {
    if (selectedItemIds.size === 0) return;
    try {
      await inventoryService.bulkEditCategories(db, Array.from(selectedItemIds), changes);
      closeModal('bulkEdit');
      setSelectedItemIds(new Set());
      showToast('Bulk updated items.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Bulk update failed.', 'error');
    }
  }, [db, selectedItemIds, closeModal, showToast]);

  const handleImport = useCallback(async (newItems: InventoryItem[], newStock: Stock[]) => {
    try {
      await inventoryService.importData(db, newItems, newStock);
      closeModal('import');
      showToast('Import processed.', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Import failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  // -- Stock actions --
  const handleMoveStock = useCallback(async (itemId: string, fromLoc: string, toLoc: string, qty: number, subDetail?: string) => {
    try {
      await stockService.moveStock(db, itemId, fromLoc, toLoc, qty, subDetail);
      closeModal('move');
      showToast('Transfer successful.', 'success');
    } catch (e: any) {
      console.error(e);
      showToast(e.message || 'Transfer failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  const handleBulkTransfer = useCallback(async (transfers: stockService.StockTransfer[]) => {
    try {
      await stockService.bulkTransfer(db, transfers);
      closeModal('bulkTransfer');
      setSelectedItemIds(new Set());
      showToast('Bulk transfer processed.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Transfer failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  const handleBulkQuantityUpdate = useCallback(async (updates: stockService.StockQuantityUpdate[]) => {
    try {
      await stockService.bulkQuantityUpdate(db, updates);
      closeModal('bulkEdit');
      closeModal('massStockUpdate');
      setSelectedItemIds(new Set());
      showToast('Mass update complete.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Update failed.', 'error');
    }
  }, [db, closeModal, showToast]);

  // -- Printing --
  const handleBulkPrint = useCallback((labels: PrintableLabel[]) => {
    setPrintableLabels(labels);
    closeModal('bulkEdit');
  }, [closeModal]);

  // -- Export / reporting --
  const handleQuickExport = useCallback(() => {
    downloadCSV(buildQuickExportCSV(items, stock, locations), 'inventory_export.csv');
    showToast('Export complete.', 'success');
  }, [items, stock, locations, showToast]);

  const handleTailoredExport = useCallback((fields: string[]) => {
    downloadCSV(buildTailoredExportCSV(items, stock, locations, fields), 'inventory_smart_export.csv');
    closeModal('tailoredExport');
    showToast('Smart export complete.', 'success');
  }, [items, stock, locations, closeModal, showToast]);

  const handleGenerateReport = useCallback((options: Omit<ReportOptions, 'selectedIds'>) => {
    const data = buildReportData({ ...options, selectedIds: selectedItemIds }, items, stock, locations);
    closeModal('report');
    if (data.length === 0) {
      showToast('No items match that report.', 'error');
      return;
    }
    setReportData(data);
  }, [items, stock, locations, selectedItemIds, closeModal, showToast]);

  const handleGenerateReportForItem = useCallback((itemId: string) => {
    const data = buildReportData({ type: 'selected', selectedIds: new Set([itemId]) }, items, stock, locations);
    setReportData(data.length > 0 ? data : null);
  }, [items, stock, locations]);

  // -- Scanning --
  const handleScan = useCallback((result: string) => {
    const found = items.find(i => i.id === result);
    if (found) {
      setItemToMove(found);
      openModal('move');
    } else {
      showToast('SKU Not Found.', 'error');
    }
    closeModal('scanner');
  }, [items, openModal, closeModal, showToast]);

  return {
    // data
    items, stock, categoryColors, isLoading, error, locations, locationsApi,
    // toast
    toast, showToast, clearToast,
    // modal state
    modals, openModal, closeModal,
    // navigation / filters / selection
    currentView, setCurrentView,
    isMobileMenuOpen, setIsMobileMenuOpen,
    isSearchVisible, setIsSearchVisible,
    searchQuery, setSearchQuery,
    filterCategory, setFilterCategory,
    filterLocation, setFilterLocation,
    filterLowStock, setFilterLowStock,
    clearFilters,
    selectedItemIds, setSelectedItemIds,
    // payloads
    itemToEdit, setItemToEdit,
    itemToMove, setItemToMove,
    itemToDuplicate, setItemToDuplicate,
    itemToPrint, setItemToPrint,
    printableLabels, setPrintableLabels,
    reportData, setReportData,
    lowAlertItemCount,
    // actions
    handleAddItem, handleEditItem, handleDeleteItem, handleBatchDeleteItems,
    handleBulkEdit, handleImport, handleMoveStock, handleBulkTransfer,
    handleBulkQuantityUpdate, handleBulkPrint, handleQuickExport,
    handleTailoredExport, handleGenerateReport, handleGenerateReportForItem,
    handleScan,
  };
};

export type AppController = ReturnType<typeof useAppController>;
