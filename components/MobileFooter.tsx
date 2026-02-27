import React from 'react';
import { ArrowRightLeftIcon } from './icons/ArrowRightLeftIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CameraIcon } from './icons/CameraIcon';
import { PlusIcon } from './icons/PlusIcon';
import { MagnifyingGlassIcon } from './icons/MagnifyingGlassIcon';

interface MobileFooterProps {
  onMoveClick: () => void;
  onAuditClick: () => void;
  onAddClick: () => void;
  onSearchClick: () => void;
  onScanClick: () => void;
}

const ActionButton: React.FC<{ label: string; icon: React.ReactNode; onClick: () => void; }> = ({ label, icon, onClick }) => (
  <button onClick={onClick} className="flex flex-col items-center gap-1 text-xs text-gray-200 active:opacity-80 min-w-[52px]">
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">{icon}</span>
    <span className="text-[9px] font-black tracking-[0.12em]">{label}</span>
  </button>
);

const MobileFooter: React.FC<MobileFooterProps> = ({ onMoveClick, onAuditClick, onAddClick, onSearchClick, onScanClick }) => {
  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="mx-3 mb-2 rounded-2xl border border-white/10 bg-neutral-900/95 backdrop-blur-md px-4 py-2 shadow-2xl">
          <div className="fluid-container relative flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ActionButton label="MOVE" icon={<ArrowRightLeftIcon className="w-5 h-5 text-gray-100" />} onClick={onMoveClick} />
              <ActionButton label="AUDIT" icon={<ClockIcon className="w-5 h-5 text-gray-100" />} onClick={onAuditClick} />
            </div>

            <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-8">
              <button onClick={onScanClick} className="bg-gradient-to-b from-red-500 to-em-red w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-4 border-white text-white active:scale-[0.98]">
                <CameraIcon className="w-7 h-7 text-white" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ActionButton label="ADD" icon={<PlusIcon className="w-5 h-5 text-gray-100" />} onClick={onAddClick} />
              <ActionButton label="SEARCH" icon={<MagnifyingGlassIcon className="w-5 h-5 text-gray-100" />} onClick={onSearchClick} />
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: '5rem' }} />
    </>
  );
};

export default MobileFooter;
