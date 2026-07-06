import React from 'react';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { CheckIcon } from './icons/CheckIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';

export interface AdminHubProps {
  onInventoryManagement: () => void;
  onCategoryManagement: () => void;
  onLocationManagement: () => void;
  onDatabaseManagement: () => void;
  onImport: () => void;
  onSmartExport: () => void;
}

interface CardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  onClick: () => void;
}

const AdminCard: React.FC<CardProps> = ({ icon, iconBg, title, description, onClick }) => (
  <button
    onClick={onClick}
    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4 text-left hover:border-em-red hover:shadow-md transition-all w-full"
  >
    <div className={`p-3 rounded-lg shrink-0 ${iconBg}`}>{icon}</div>
    <div>
      <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">{title}</h3>
      <p className="text-sm text-gray-600 mt-1">{description}</p>
    </div>
  </button>
);

/** Admin Control Center — recreated from the production deployment (source was lost from the repo). */
const AdminHub: React.FC<AdminHubProps> = ({
  onInventoryManagement,
  onCategoryManagement,
  onLocationManagement,
  onDatabaseManagement,
  onImport,
  onSmartExport,
}) => (
  <div className="animate-fade-in-down max-w-4xl mx-auto pb-20">
    <div className="mb-8">
      <span className="inline-flex items-center gap-1 bg-red-50 text-em-red text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
        + Admin Control Center
      </span>
      <h1 className="text-4xl font-black text-gray-900 uppercase tracking-tight mt-4">Configure &amp; Maintain Inventory</h1>
      <p className="text-sm text-gray-600 mt-3 max-w-xl">
        Launch the same streamlined admin destinations available from the dashboard, with inventory editing, master data
        management, database tools, and import/export controls in one place.
      </p>
    </div>

    <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-4">Admin Options</h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <AdminCard
        icon={<ListBulletIcon className="w-6 h-6 text-em-red" />}
        iconBg="bg-red-50"
        title="Inventory Management"
        description="Add, edit, audit, or move SKUs from one workspace."
        onClick={onInventoryManagement}
      />
      <AdminCard
        icon={<PencilSquareIcon className="w-6 h-6 text-green-600" />}
        iconBg="bg-green-50"
        title="Category Management"
        description="Define main and nested categories used across the inventory system."
        onClick={onCategoryManagement}
      />
      <AdminCard
        icon={<MapPinIcon className="w-6 h-6 text-amber-600" />}
        iconBg="bg-amber-50"
        title="Location Management"
        description="Manage warehouses, sub-locations, and print prompts in one place."
        onClick={onLocationManagement}
      />
      <AdminCard
        icon={<CheckIcon className="w-6 h-6 text-blue-600" />}
        iconBg="bg-blue-50"
        title="Database Management"
        description="Run integrity checks, cleanup routines, and database maintenance tools."
        onClick={onDatabaseManagement}
      />
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-start gap-4">
        <div className="p-3 rounded-lg shrink-0 bg-gray-50">
          <DocumentChartBarIcon className="w-6 h-6 text-gray-700" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Import / Export</h3>
          <p className="text-sm text-gray-600 mt-1">Open the import/export workspace for CSV intake and tailored exports.</p>
          <div className="flex gap-3 mt-3">
            <button onClick={onImport} className="px-4 py-2 bg-em-red text-white text-xs font-black uppercase rounded-lg hover:bg-red-700 transition-colors">
              Import CSV
            </button>
            <button onClick={onSmartExport} className="px-4 py-2 bg-gray-100 text-gray-800 text-xs font-black uppercase rounded-lg hover:bg-gray-200 transition-colors">
              Smart Export
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">Barcode Labels</h4>
        <p className="text-sm text-amber-800 mt-2">
          Barcode printing now lives in Inventory Management and the desktop Admin dropdown for faster access during active editing.
        </p>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h4 className="text-xs font-black text-gray-700 uppercase tracking-widest">Audit and Move</h4>
        <p className="text-sm text-gray-600 mt-2">
          Audit and move-stock tools are handled inside Inventory Management so quantity changes, reassignment, and barcode
          printing stay in one workspace.
        </p>
      </div>
    </div>
  </div>
);

export default AdminHub;
