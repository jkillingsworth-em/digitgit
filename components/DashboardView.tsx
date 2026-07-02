import React, { Suspense, lazy } from 'react';
import { InventoryItem, Location, Stock } from '../types';
import MobileDashboard from './MobileDashboard';

const DesktopDashboard = lazy(() => import('./DesktopDashboard'));

export interface DashboardViewProps {
  items: InventoryItem[];
  stock: Stock[];
  locations: Location[];
  onStockUpdateClick: () => void;
  onTransferClick: () => void;
  onPrintClick: () => void;
  onActivityClick: () => void;
  onImportExportClick: () => void;
  onWarehouseClick: (locationId: string) => void;
  onAdminCategories: () => void;
  onAdminLocations: () => void;
  onAdminPurge: () => void;
}

/** Renders the mobile dashboard on small screens and the desktop dashboard elsewhere. */
const DashboardView: React.FC<DashboardViewProps> = props => (
  <>
    <div className="md:hidden">
      <MobileDashboard {...props} />
    </div>
    <div className="hidden md:block">
      <Suspense fallback={<div className="text-center py-8">Loading dashboard...</div>}>
        <DesktopDashboard {...props} />
      </Suspense>
    </div>
  </>
);

export default DashboardView;
