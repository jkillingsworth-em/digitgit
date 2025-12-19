
import React, { useRef } from 'react';
import Barcode from 'react-barcode';
import { PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { PrinterIcon } from './icons/PrinterIcon';

interface BarcodeSheetModalProps {
  labels: PrintableLabel[];
  onClose: () => void;
}

const BarcodeSheetModal: React.FC<BarcodeSheetModalProps> = ({ labels, onClose }) => {
  const printableAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = printableAreaRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=800,width=1000');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Electro-Mech Inventory Labels</title>');
      printWindow.document.write(`
        <style>
          @page { 
            size: auto; 
            margin: 0mm; /* Removes browser headers and footers */
          }
          body { 
            font-family: sans-serif; 
            margin: 10mm; 
            background: white; 
            -webkit-print-color-adjust: exact;
          }
          .sheet-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 10px; 
          }
          .sheet-single { 
            display: flex; 
            justify-content: center; 
          }
          .label { 
            border: 1px solid #000; 
            padding: 20px; 
            text-align: center; 
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 60mm;
          }
          .desc { 
            font-size: 24px; 
            font-weight: 900; 
            margin: 0 0 10px 0; 
            text-transform: uppercase;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .barcode-container { 
            width: 100%; 
            display: flex;
            justify-content: center;
          }
          .location-info { 
            margin-top: 10px; 
            padding-top: 10px; 
            border-top: 2px solid #000; 
            width: 100%;
          }
          .location-name { 
            font-size: 18px; 
            font-weight: 900; 
            letter-spacing: 0.1em;
          }
          .sub-detail { 
            font-size: 12px; 
            font-weight: 700; 
            margin-top: 2px;
          }
          @media print {
            .label { border: 1px dashed #000; }
          }
        </style>
      `);
      printWindow.document.write('</head><body onload="setTimeout(function(){ window.print(); window.close(); }, 500)">');
      const containerClass = labels.length === 1 ? 'sheet-single' : 'sheet-grid';
      printWindow.document.write(`<div class="${containerClass}">`);
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</div>');
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      printWindow.focus();
    } else {
      alert('Could not open print window. Please allow popups for this site.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="modal-container max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
          <div className="modal-header border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-black text-gray-900 uppercase">Label Print Queue</h2>
              <button type="button" onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                  <XMarkIcon className="w-6 h-6" />
              </button>
          </div>
          
          <div className="modal-body overflow-y-auto p-4 md:p-8 bg-gray-100">
              <div ref={printableAreaRef} className={labels.length === 1 ? "" : "grid grid-cols-2 gap-4"}>
                 {labels.map((label, index) => (
                    <div 
                        key={`${label.itemId}-${index}`} 
                        className="label bg-white border border-gray-200 p-6 text-center flex flex-col items-center shadow-sm rounded-lg"
                    >
                        <h3 className="desc text-[24px] font-black text-gray-900 mb-2 truncate w-full uppercase">
                          {label.description}
                        </h3>
                        <div className="barcode-container w-full flex justify-center py-2 bg-white">
                           <Barcode 
                             value={label.itemId} 
                             height={60} 
                             width={2.0} 
                             fontSize={26} 
                             margin={0} 
                             background="#ffffff"
                             displayValue={true}
                             renderer="svg"
                           />
                        </div>
                        {label.locationName && label.locationName !== 'PRODUCT SKU' && (
                            <div className="location-info mt-3 pt-3 border-t-2 border-black w-full">
                              <p className={`location-name text-[18px] font-black truncate uppercase tracking-widest ${label.locationName === 'NO STOCK' ? 'text-red-600' : 'text-black'}`}>
                                  {label.locationName}
                              </p>
                              {label.subLocationDetail && (
                                <p className="sub-detail text-[12px] font-bold text-gray-600 truncate uppercase mt-0.5">
                                  {label.subLocationDetail}
                                </p>
                              )}
                            </div>
                        )}
                    </div>
                ))}
              </div>
          </div>

          <div className="modal-footer border-t border-gray-100 p-6 flex flex-col sm:flex-row justify-end items-center gap-4 bg-white rounded-b-xl flex-shrink-0">
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-6 py-3 text-sm font-black text-black uppercase hover:opacity-70 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handlePrint} 
                  className="flex items-center px-8 py-4 text-sm font-black text-white bg-em-red border border-transparent rounded-xl shadow-lg hover:bg-red-700 transition-all active:scale-95"
                >
                  <PrinterIcon className="w-5 h-5 mr-3" />
                  PRINT NOW
                </button>
              </div>
          </div>
      </div>
    </div>
  );
};

export default BarcodeSheetModal;
