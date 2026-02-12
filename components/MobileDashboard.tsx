import React from 'react';
import { InventoryItem, Location, Stock } from '../types';

interface MobileDashboardProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  onStockUpdateClick: () => void;
  onTransferClick: () => void;
  onPrintClick: () => void;
  onActivityClick: () => void;
  onImportExportClick: () => void;
  onWarehouseClick: (id: string) => void;
  onAdminCategories: () => void;
  onAdminLocations: () => void;
  onAdminPurge: () => void;
}

const MobileDashboard: React.FC<MobileDashboardProps> = ({ onStockUpdateClick, onTransferClick, onPrintClick, onActivityClick, onImportExportClick, onWarehouseClick, onAdminCategories, onAdminLocations, onAdminPurge }) => {
  return (
    <div className="p-2">
      <div className="grid grid-cols-3 gap-2">
        <button onClick={onStockUpdateClick} className="btn">Inventory</button>
        <button onClick={onTransferClick} className="btn">Transfer</button>
        <button onClick={onPrintClick} className="btn">Print</button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onActivityClick} className="btn">Audit Log</button>
        <button onClick={onImportExportClick} className="btn">Import/Export</button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button onClick={() => onWarehouseClick('wh-j')} className="btn">WH-J</button>
        <button onClick={() => onWarehouseClick('wh-c')} className="btn">WH-C</button>
        <button onClick={() => onWarehouseClick('prod')} className="btn">PROD</button>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={onAdminCategories} className="btn">Categories</button>
        <button onClick={onAdminLocations} className="btn">Locations</button>
        <button onClick={onAdminPurge} className="btn">Purge</button>
      </div>
    </div>
  );
};

export default MobileDashboard;
