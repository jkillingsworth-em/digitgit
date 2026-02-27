import React from 'react';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { ClockIcon } from './icons/ClockIcon';
import { BarcodeIcon } from './icons/BarcodeIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { PlusIcon } from './icons/PlusIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { CheckIcon } from './icons/CheckIcon';

interface AdminHubProps {
  onOpenInventoryConsole: () => void;
  onOpenMoveStock: () => void;
  onOpenAudit: () => void;
  onOpenBarcode: () => void;
  onOpenImport: () => void;
  onOpenQuickExport: () => void;
  onOpenSmartExport: () => void;
  onGoToCategories: () => void;
  onGoToLocations: () => void;
  onGoToDatabase: () => void;
}

const buttonClass =
  'w-full text-left px-5 py-5 rounded-2xl border border-gray-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg';

const labelClass = 'text-[11px] font-black uppercase tracking-[0.2em] text-gray-500';

const AdminHub: React.FC<AdminHubProps> = ({
  onOpenInventoryConsole,
  onOpenMoveStock,
  onOpenAudit,
  onOpenBarcode,
  onOpenImport,
  onOpenQuickExport,
  onOpenSmartExport,
  onGoToCategories,
  onGoToLocations,
  onGoToDatabase,
}) => {
  return (
    <div className="w-full mx-auto max-w-5xl px-4 md:px-8 pb-16 space-y-10 animate-fade-in-down">
      <header className="space-y-3 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-em-red tracking-[0.2em]">
          <PlusIcon className="w-4 h-4" /> Admin Control Center
        </span>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900">Configure & Maintain Inventory</h1>
        <p className="text-sm md:text-base text-gray-600 font-medium max-w-2xl">
          Launch critical workflows quickly, manage master data, and export compliance-ready manifests from one optimized hub designed for phones and desktops alike.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className={labelClass}>Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={onOpenInventoryConsole} className={`${buttonClass}`}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-em-red/10 text-em-red"><ListBulletIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Inventory Management</div>
                <p className="text-sm text-gray-600 font-medium">Add, edit, audit, or move SKUs from one workspace.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenMoveStock} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><ArrowRightLeftIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Move Stock</div>
                <p className="text-sm text-gray-600 font-medium">Transfer quantities between hubs and track adjustments.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenAudit} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gray-900/10 text-gray-900"><ClockIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Audit Inventory</div>
                <p className="text-sm text-gray-600 font-medium">Review change history and reconcile counts by location.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenBarcode} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-50 text-purple-600"><BarcodeIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Barcode Labels</div>
                <p className="text-sm text-gray-600 font-medium">Generate labels for individual items or curated batches.</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={labelClass}>Master Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={onGoToCategories} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><PencilSquareIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Categories</div>
                <p className="text-sm text-gray-600 font-medium">Build structured hierarchies and color map tags.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToLocations} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><MapPinIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Locations</div>
                <p className="text-sm text-gray-600 font-medium">Manage warehouses, sub-locations, and label prompts.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToDatabase} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-sky-50 text-sky-600"><CheckIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Database Tools</div>
                <p className="text-sm text-gray-600 font-medium">Run integrity checks, clean orphaned stock, and purge.</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={labelClass}>Data & Compliance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button onClick={onOpenImport} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-50 text-slate-600"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Import / Export</div>
                <p className="text-sm text-gray-600 font-medium">Queue CSV updates with validation for categories & hubs.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenQuickExport} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-50 text-slate-600"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Quick Export</div>
                <p className="text-sm text-gray-600 font-medium">Download a fast CSV snapshot of all active inventory.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenSmartExport} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-slate-50 text-slate-600"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-black text-gray-900 uppercase">Smart Export</div>
                <p className="text-sm text-gray-600 font-medium">Customize optional fields for job-site ready manifests.</p>
              </div>
            </div>
          </button>
        </div>
      </section>
    </div>
  );
};

export default AdminHub;
