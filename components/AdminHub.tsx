import React from 'react';
import { ListBulletIcon } from './icons/ListBulletIcon';
import { DocumentChartBarIcon } from './icons/DocumentChartBarIcon';
import { PlusIcon } from './icons/PlusIcon';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { MapPinIcon } from './icons/MapPinIcon';
import { CheckIcon } from './icons/CheckIcon';

interface AdminHubProps {
  onOpenInventoryConsole: () => void;
  onGoToCategories: () => void;
  onGoToLocations: () => void;
  onGoToDatabase: () => void;
  onGoToExceptions: () => void;
  onGoToCycleCount: () => void;
  onOpenImportExport: () => void;
  onOpenEmDigitSync: () => void;
}

const buttonClass =
  'w-full text-left px-5 py-5 rounded-2xl border border-neutral-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-lg';

const labelClass = 'text-xs font-bold   text-neutral-500';

const AdminHub: React.FC<AdminHubProps> = ({
  onOpenInventoryConsole,
  onGoToCategories,
  onGoToLocations,
  onGoToDatabase,
  onGoToExceptions,
  onGoToCycleCount,
  onOpenImportExport,
  onOpenEmDigitSync,
}) => {
  return (
    <div className="w-full mx-auto max-w-5xl px-4 md:px-8 pb-16 space-y-10 animate-fade-in-down">
      <header className="space-y-3 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-em-red ">
          <PlusIcon className="w-4 h-4" /> Admin Control Center
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900">Configure & Maintain Inventory</h1>
        <p className="text-sm md:text-base text-neutral-600 font-medium max-w-2xl">
          Launch the same streamlined admin destinations available from the dashboard, with inventory editing, master data management, database tools, and import/export controls in one place.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className={labelClass}>Admin Options</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button onClick={onOpenInventoryConsole} className={`${buttonClass}`}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-em-red/10 text-em-red"><ListBulletIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Inventory Management</div>
                <p className="text-sm text-neutral-600 font-medium">Add, edit, audit, or move SKUs from one workspace.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToCategories} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600"><PencilSquareIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Category Management</div>
                <p className="text-sm text-neutral-600 font-medium">Define main and nested categories used across the inventory system.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToLocations} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-600"><MapPinIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Location Management</div>
                <p className="text-sm text-neutral-600 font-medium">Manage warehouses, sub-locations, and print prompts in one place.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToDatabase} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-sky-50 text-sky-600"><CheckIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Database Management</div>
                <p className="text-sm text-neutral-600 font-medium">Run integrity checks, cleanup routines, and database maintenance tools.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToExceptions} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-50 text-amber-700"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Exceptions</div>
                <p className="text-sm text-neutral-600 font-medium">SAGE vs floor variances, missing SAGE, orphan stock, and data-health exceptions.</p>
              </div>
            </div>
          </button>
          <button onClick={onGoToCycleCount} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-50 text-em-red"><CheckIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Cycle Count</div>
                <p className="text-sm text-neutral-600 font-medium">Floor-friendly blind/open count by location with review and post.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenImportExport} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-neutral-50 text-neutral-600"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Import / Export</div>
                <p className="text-sm text-neutral-600 font-medium">Open the import/export workspace for CSV intake and tailored exports.</p>
              </div>
            </div>
          </button>
          <button onClick={onOpenEmDigitSync} className={buttonClass}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-neutral-50 text-em-red"><DocumentChartBarIcon className="w-6 h-6" /></div>
              <div>
                <div className="text-lg font-bold text-neutral-900 ">Sync EM Sheet</div>
                <p className="text-sm text-neutral-600 font-medium">Live Google Sheets pull/push for EM Digit Inventory master fields and floor stock.</p>
              </div>
            </div>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5">
          <div className="text-xs font-bold text-amber-700">Barcode Labels</div>
          <p className="mt-2 text-sm font-medium leading-6 text-amber-900">
            Barcode printing now lives in Inventory Management and the desktop Admin dropdown for faster access during active editing.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-5">
          <div className="text-xs font-bold text-neutral-700">Audit And Move</div>
          <p className="mt-2 text-sm font-medium leading-6 text-neutral-700">
            Audit and move-stock tools are handled inside Inventory Management so quantity changes, reassignment, and barcode printing stay in one workspace.
          </p>
        </div>
      </section>
    </div>
  );
};

export default AdminHub;
