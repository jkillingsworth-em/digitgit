import React, { Suspense, lazy } from 'react';
import type { AppController } from '../hooks/useAppController';

const AddItemModal = lazy(() => import('./AddItemModal'));
const EditItemModal = lazy(() => import('./EditItemModal'));
const MoveStockModal = lazy(() => import('./MoveStockModal'));
const ImportDataModal = lazy(() => import('./ImportDataModal'));
const GenerateReportModal = lazy(() => import('./GenerateReportModal'));
const ReportPreviewModal = lazy(() => import('./ReportPreviewModal'));
const BulkEditModal = lazy(() => import('./BulkEditModal'));
const BarcodeScannerModal = lazy(() => import('./BarcodeScannerModal'));
const BarcodeSheetModal = lazy(() => import('./PrintBarcodeModal'));
const GenerateBarcodeSheetModal = lazy(() => import('./CategoryColorModal'));
const TailoredExportModal = lazy(() => import('./TailoredExportModal'));
const BulkTransferModal = lazy(() => import('./BulkTransferModal'));
const MassStockUpdateModal = lazy(() => import('./MassStockUpdateModal'));
const SelectPrintLocationModal = lazy(() => import('./SelectPrintLocationModal'));

/** Renders every application modal from controller state. Pure composition — no logic. */
const AppModals: React.FC<{ c: AppController }> = ({ c }) => (
  <>
    {c.modals.addItem && (
      <Suspense fallback={<div className="p-6">Opening Add Item…</div>}>
        <AddItemModal
          onClose={() => c.closeModal('addItem')}
          onAddItem={c.handleAddItem}
          locations={c.locations}
          existingItemIds={c.items.map(i => i.id)}
          itemToDuplicate={c.itemToDuplicate}
          currentCategoryColors={c.categoryColors}
          onShowToast={c.showToast}
        />
      </Suspense>
    )}

    {c.modals.bulkEdit && (
      <Suspense fallback={<div className="p-6">Opening Inventory Management…</div>}>
        <BulkEditModal
          items={c.items}
          stock={c.stock}
          locations={c.locations}
          selectedItemIds={c.selectedItemIds}
          onClose={() => c.closeModal('bulkEdit')}
          onSaveChanges={c.handleBulkEdit}
          onTransfer={c.handleBulkTransfer}
          onUpdateQuantities={c.handleBulkQuantityUpdate}
          onPrintLabels={c.handleBulkPrint}
        />
      </Suspense>
    )}

    {c.modals.move && c.itemToMove && (
      <Suspense fallback={<div className="p-6">Loading Move Stock…</div>}>
        <MoveStockModal item={c.itemToMove} locations={c.locations} stock={c.stock} onClose={() => c.closeModal('move')} onMoveStock={c.handleMoveStock} />
      </Suspense>
    )}

    {c.modals.bulkTransfer && (
      <Suspense fallback={<div className="p-6">Opening Bulk Transfer…</div>}>
        <BulkTransferModal items={c.items} locations={c.locations} stock={c.stock} onClose={() => c.closeModal('bulkTransfer')} onTransfer={c.handleBulkTransfer} />
      </Suspense>
    )}

    {c.modals.massStockUpdate && (
      <Suspense fallback={<div className="p-6">Opening Mass Update…</div>}>
        <MassStockUpdateModal items={c.items} locations={c.locations} stock={c.stock} onClose={() => c.closeModal('massStockUpdate')} onUpdate={c.handleBulkQuantityUpdate} />
      </Suspense>
    )}

    {c.modals.tailoredExport && (
      <Suspense fallback={<div className="p-6">Opening Export…</div>}>
        <TailoredExportModal onClose={() => c.closeModal('tailoredExport')} onExport={c.handleTailoredExport} />
      </Suspense>
    )}

    {c.modals.import && (
      <Suspense fallback={<div className="p-6">Loading Import…</div>}>
        <ImportDataModal onClose={() => c.closeModal('import')} onImport={c.handleImport} />
      </Suspense>
    )}

    {c.modals.scanner && (
      <Suspense fallback={<div className="p-6">Opening Scanner…</div>}>
        <BarcodeScannerModal isOpen={c.modals.scanner} onClose={() => c.closeModal('scanner')} onScan={c.handleScan} />
      </Suspense>
    )}

    {c.printableLabels && (
      <Suspense fallback={<div className="p-6">Rendering Barcode Sheet…</div>}>
        <BarcodeSheetModal labels={c.printableLabels} onClose={() => c.setPrintableLabels(null)} />
      </Suspense>
    )}

    {c.modals.barcodeSheet && (
      <Suspense fallback={<div className="p-6">Preparing Barcode Generator…</div>}>
        <GenerateBarcodeSheetModal
          onClose={() => c.closeModal('barcodeSheet')}
          onGenerate={c.setPrintableLabels}
          items={c.items}
          stock={c.stock}
          locations={c.locations}
          selectedItemIds={c.selectedItemIds}
        />
      </Suspense>
    )}

    {c.modals.report && (
      <Suspense fallback={<div className="p-6">Preparing Report…</div>}>
        <GenerateReportModal
          onClose={() => c.closeModal('report')}
          onGenerate={c.handleGenerateReport}
          items={c.items}
          selectedItemCount={c.selectedItemIds.size}
          lowAlertItemCount={c.lowAlertItemCount}
        />
      </Suspense>
    )}

    {c.reportData && (
      <Suspense fallback={<div className="p-6">Loading Report Preview…</div>}>
        <ReportPreviewModal reportData={c.reportData} onClose={() => c.setReportData(null)} onPrintSpecificLabel={l => c.setPrintableLabels([l])} />
      </Suspense>
    )}

    {c.itemToPrint && (
      <Suspense fallback={<div className="p-6">Preparing Print…</div>}>
        <SelectPrintLocationModal
          isOpen={!!c.itemToPrint}
          onClose={() => c.setItemToPrint(null)}
          onGenerate={label => {
            c.setPrintableLabels([label]);
            c.setItemToPrint(null);
          }}
          item={c.itemToPrint}
          stockLocations={c.stock.filter(s => s.itemId === c.itemToPrint!.id)}
          locations={c.locations}
        />
      </Suspense>
    )}

    {c.modals.edit && c.itemToEdit && (
      <Suspense fallback={<div className="p-6">Loading editor…</div>}>
        <EditItemModal
          item={c.itemToEdit}
          stock={c.stock.filter(s => s.itemId === c.itemToEdit!.id)}
          locations={c.locations}
          onClose={() => {
            c.closeModal('edit');
            c.setItemToEdit(null);
          }}
          onEditItem={(updatedItem, updatedStock, colors) => {
            c.setItemToEdit(null);
            return c.handleEditItem(updatedItem, updatedStock, colors);
          }}
          onDelete={() => {
            if (c.itemToEdit) c.handleDeleteItem(c.itemToEdit.id);
          }}
          onPrintSpecificLabel={label => c.setPrintableLabels([label])}
          currentCategoryColors={c.categoryColors}
          fieldToFocus={null}
        />
      </Suspense>
    )}
  </>
);

export default AppModals;
