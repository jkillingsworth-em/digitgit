import React from 'react';
import { HomeIcon } from './icons/HomeIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';

interface MobileFooterProps {
  onHomeClick: () => void;
  onScanClick: () => void;
  onMenuClick: () => void;
}

const MobileFooter: React.FC<MobileFooterProps> = ({ onHomeClick, onScanClick, onMenuClick }) => {
  return (
    <>
      {/* Spacer participates in document flow so content isn't hidden behind fixed footer */}
      <div style={{ height: '3.5rem' }} />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50" style={{ background: '#171717' }}>
        <div className="max-w-[1920px] mx-auto w-full">
          <div className="relative flex items-center justify-between px-4 py-2">
            <button onClick={onHomeClick} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-em-red">
              <HomeIcon className="w-6 h-6" />
              <span>HOME</span>
            </button>

            <button
              onClick={onScanClick}
              className="relative -translate-y-4 bg-em-red rounded-full p-3 flex items-center justify-center shadow-lg"
              style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.35)', borderRadius: '9999px' }}
            >
              <div className="rounded-full" style={{ boxShadow: '0 0 0 6px rgba(255,255,255,0.15)' }}>
                <CameraIcon className="w-8 h-8 text-white" />
              </div>
            </button>

            <button onClick={onMenuClick} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-gray-200">
              <ListBulletIcon className="w-6 h-6" />
              <span>STOCK</span>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
};

export default MobileFooter;
import React from 'react';
import { HomeIcon } from './icons/HomeIcon';
import { CameraIcon } from './icons/CameraIcon';
import { ListBulletIcon } from './icons/ListBulletIcon';

interface MobileFooterProps {
  onHomeClick: () => void;
  onScanClick: () => void;
  onMenuClick: () => void;
}

const MobileFooter: React.FC<MobileFooterProps> = ({ onHomeClick, onScanClick, onMenuClick }) => {
  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
        <div style={{ backgroundColor: '#171717' }} className="text-white py-2 px-4">
          <div className="fluid-container relative flex items-center justify-between">
            <button onClick={onHomeClick} className="flex flex-col items-center gap-1 text-xs text-em-red">
              <HomeIcon className="w-6 h-6 text-em-red" />
              <span className="text-[11px] font-bold">HOME</span>
            </button>

            <div className="absolute left-1/2 transform -translate-x-1/2 -translate-y-8">
              <button onClick={onScanClick} className="bg-em-red w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-4 border-white text-white">
                <CameraIcon className="w-8 h-8 text-white" />
              </button>
            </div>

            <button onClick={onMenuClick} className="flex flex-col items-center gap-1 text-xs text-gray-200">
              <ListBulletIcon className="w-6 h-6 text-gray-200" />
              <span className="text-[11px] font-bold">MENU</span>
            </button>
          </div>
        </div>
      </div>
      <div style={{ height: '4.5rem' }} />
    </>
  );
};

export default MobileFooter;
