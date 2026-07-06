import React, { Suspense, lazy } from 'react';
import { useAppController } from './hooks/useAppController';
import type { ViewType } from './hooks/useAppController';

import Header from './components/Header';
import NavigationView from './components/NavigationView';
import Toast from './components/Toast';
import MobileFooter from './components/MobileFooter';
import DashboardView from './components/DashboardView';
import AppModals from './components/AppModals';
import CategoryManager from './components/CategoryManager';
import LocationManager from './components/LocationManager';
import PurgeManager from './components/PurgeManager';
import AdminHub from './components/AdminHub';
import { MagnifyingGlassIcon } from './components/icons/MagnifyingGlassIcon';

const InventoryTable = lazy(() => import('./components/InventoryTable'));

const App: React.FC = () => {
  const c = useAppController();

  if (c.error) return <div className="p-4 text-red-600 font-bold">{c.error}</div>;

  const openAddItem = () => {
    c.setItemToDuplicate(null);
    c.openModal('addItem');
  };

  const dashboardActions = {
    onStockUpdateClick: () => c.openModal('bulkEdit'),
    onTransferClick: () => c.openModal('bulkEdit'),
    onPrintClick: () => c.openModal('barcodeSheet'),
    onActivityClick: () => c.showToast('Opening Log...', 'success'),
    onImportExportClick: () => c.openModal('tailoredExport'),
    onWarehouseClick: (id: string) => {
      c.setFilterLocation(id);
      c.setCurrentView('all');
    },
    onAdminCategories: () => c.setCurrentView('admin-categories'),
    onAdminLocations: () => c.setCurrentView('admin-locations'),
    onAdminPurge: () => c.setCurrentView('admin-purge'),
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      {c.toast && <Toast message={c.toast.message} type={c.toast.type} onClose={c.clearToast} />}

      <Header
        onSearchClick={() => c.setIsSearchVisible(p => !p)}
        onScanClick={() => c.openModal('scanner')}
        onMenuClick={() => c.setIsMobileMenuOpen(true)}
      />

      <NavigationView
        currentView={c.currentView as any}
        onViewChange={v => c.setCurrentView(v as ViewType)}
        onFilterChange={(type, val) => {
          if (type === 'category') c.setFilterCategory(val);
          else c.setFilterLocation(val);
          c.setCurrentView('all');
        }}
        onClearFilters={c.clearFilters}
        items={c.items}
        locations={c.locations}
        isMobileMenuOpen={c.isMobileMenuOpen}
        onCloseMobileMenu={() => c.setIsMobileMenuOpen(false)}
        onImportClick={() => c.openModal('import')}
        onExportClick={c.handleQuickExport}
        onReportClick={() => c.openModal('report')}
        onPrintBatchClick={() => c.openModal('barcodeSheet')}
        onAddItemClick={openAddItem}
        onInventoryManagement={() => c.openModal('bulkEdit')}
        onSmartExport={() => c.openModal('tailoredExport')}
      />

      {c.isSearchVisible && (
        <div className="bg-amber-50 text-black text-center py-2 font-black text-xs uppercase tracking-widest sticky top-0 z-[60] shadow-sm flex items-center justify-center gap-2">
          <div className="fluid-container py-3 relative w-full">
            <MagnifyingGlassIcon className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
            <input type="text" className="form-control pl-10" placeholder="SEARCH..." value={c.searchQuery} onChange={e => c.setSearchQuery(e.target.value)} autoFocus />
          </div>
        </div>
      )}

      <div className="flex-grow p-4 md:p-8 max-w-[1920px] mx-auto w-full">
        {c.isLoading ? (
          <div className="h-screen flex items-center justify-center font-black text-gray-400 animate-pulse uppercase tracking-widest">Loading Electro-Mech Database...</div>
        ) : c.currentView === 'dashboard' ? (
          <DashboardView items={c.items} stock={c.stock} locations={c.locations} {...dashboardActions} />
        ) : c.currentView === 'admin-hub' ? (
          <AdminHub
            onInventoryManagement={() => c.openModal('bulkEdit')}
            onCategoryManagement={() => c.setCurrentView('admin-categories')}
            onLocationManagement={() => c.setCurrentView('admin-locations')}
            onDatabaseManagement={() => c.setCurrentView('admin-purge')}
            onImport={() => c.openModal('import')}
            onSmartExport={() => c.openModal('tailoredExport')}
          />
        ) : c.currentView === 'admin-categories' ? (
          <CategoryManager onBack={() => c.setCurrentView('dashboard')} />
        ) : c.currentView === 'admin-locations' ? (
          <LocationManager
            locations={c.locations}
            onAddLocation={c.locationsApi.add}
            onUpdateLocation={c.locationsApi.update}
            onDeleteLocation={async id => {
              if (window.confirm('Delete this location? Stock rows assigned to it will keep their location id.')) {
                await c.locationsApi.remove(id);
              }
            }}
            onAssignItems={locId => {
              c.setFilterLocation(locId);
              c.openModal('bulkEdit');
            }}
            onBack={() => c.setCurrentView('dashboard')}
          />
        ) : c.currentView === 'admin-purge' ? (
          <PurgeManager items={c.items} stock={c.stock} locations={c.locations} onBatchDelete={c.handleBatchDeleteItems} onBack={() => c.setCurrentView('dashboard')} categoryColors={c.categoryColors} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <Suspense fallback={<div className="text-center py-20">Loading table...</div>}>
              <InventoryTable
                items={c.items}
                locations={c.locations}
                stock={c.stock}
                selectedItemIds={c.selectedItemIds}
                onSelectionChange={id => {
                  const next = new Set(c.selectedItemIds);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  c.setSelectedItemIds(next);
                }}
                onSelectAll={(ids, s) => c.setSelectedItemIds(s ? new Set(ids) : new Set())}
                onMoveClick={item => {
                  const canonical = c.items.find(i => i.id === item.id) ?? item;
                  c.setItemToMove(canonical);
                  c.openModal('move');
                }}
                onDeleteClick={id => {
                  if (window.confirm(`Permanently delete SKU ${id} and all of its stock records?`)) c.handleDeleteItem(id);
                }}
                onDuplicateClick={item => {
                  c.setItemToDuplicate(item);
                  c.openModal('addItem');
                }}
                onEditClick={item => {
                  const canonical = c.items.find(i => i.id === item.id) ?? item;
                  c.setItemToEdit(canonical);
                  c.openModal('edit');
                }}
                onPrintBarcode={i => c.setItemToPrint(i)}
                onPrintSpecificLabel={l => c.setPrintableLabels([l])}
                onGenerateReportForItem={c.handleGenerateReportForItem}
                categoryColors={c.categoryColors}
                view={c.currentView as any}
                searchQuery={c.searchQuery}
                filterCategory={c.filterCategory}
                filterLocation={c.filterLocation}
                filterLowStock={c.filterLowStock}
                onSetFilterCategory={c.setFilterCategory}
                onSetFilterLocation={c.setFilterLocation}
                onSetFilterLowStock={c.setFilterLowStock}
                onViewChange={v => c.setCurrentView(v as ViewType)}
                onBulkEditClick={() => c.openModal('bulkEdit')}
              />
            </Suspense>
          </div>
        )}
      </div>

      <MobileFooter
        onHomeClick={() => c.setCurrentView('dashboard')}
        onScanClick={() => c.openModal('scanner')}
        onMenuClick={() => c.setIsMobileMenuOpen(true)}
      />

      <AppModals c={c} />
    </div>
  );
};

export default App;
