import React from 'react';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CameraIcon } from './icons/CameraIcon';
import { PlusIcon } from './icons/PlusIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';

interface MobileFooterProps {
  isAdmin: boolean;
  onMoveClick: () => void;
  onAuditClick: () => void;
  onAddClick: () => void;
  onSearchClick: () => void;
  onScanClick: () => void;
}

const TabButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void }> = ({ label, icon, onClick }) => (
  <button type="button" onClick={onClick} className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-neutral-500 active:text-em-ink">
    {icon}
    <span>{label}</span>
  </button>
);

/** Phone bottom bar: the floor jobs, with Scan raised in the middle. */
const MobileFooter: React.FC<MobileFooterProps> = ({ isAdmin, onMoveClick, onAuditClick, onAddClick, onSearchClick, onScanClick }) => {
  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-200 bg-white md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Quick actions"
      >
        <div className="flex h-16 items-stretch px-2">
          <TabButton label="Search" icon={<MagnifyingGlassIcon className="h-6 w-6" />} onClick={onSearchClick} />
          <TabButton label="Move" icon={<ArrowRightLeftIcon className="h-6 w-6" />} onClick={onMoveClick} />
          <div className="flex flex-1 flex-col items-center">
            <button
              type="button"
              aria-label="Scan barcode"
              onClick={onScanClick}
              className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-em-red text-white shadow-lg ring-4 ring-white active:bg-em-red-dark"
            >
              <CameraIcon className="h-6 w-6" />
            </button>
            <span className="mt-0.5 text-[11px] font-medium text-neutral-500">Scan</span>
          </div>
          <TabButton label={isAdmin ? 'Audit' : 'Count'} icon={<ClockIcon className="h-6 w-6" />} onClick={onAuditClick} />
          {isAdmin
            ? <TabButton label="Add" icon={<PlusIcon className="h-6 w-6" />} onClick={onAddClick} />
            : <span className="flex-1" aria-hidden="true" />}
        </div>
      </nav>
      <div className="h-20 md:hidden" />
    </>
  );
};

export default MobileFooter;
