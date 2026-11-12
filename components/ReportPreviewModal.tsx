
import React from 'react';
import { ReportDataItem, PrintableLabel } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { PrinterIcon } from './icons/PrinterIcon';

import { createInventoryReportPdf } from '../utils/inventoryReportPdf';

interface ReportPreviewModalProps {
    reportData: ReportDataItem[];
    onClose: () => void;
    onPrintSpecificLabel: (label: PrintableLabel) => void;
}

const ReportPreviewModal: React.FC<ReportPreviewModalProps> = ({ reportData, onClose, onPrintSpecificLabel }) => {

    const handleExportCSV = () => {
        const headers = ['ID', 'Description', 'Category', 'Sub-Category', 'Location', 'Sub-Location', 'Quantity', 'Source', 'PO Number', 'Date Received'];
        const rows = reportData.map(item => [
            `"${String(item.id).replace(/"/g, '""')}"`,
            `"${String(item.description).replace(/"/g, '""')}"`,
            `"${String(item.category || '').replace(/"/g, '""')}"`,
            `"${String(item.subCategory || '').replace(/"/g, '""')}"`,
            `"${String(item.locationName).replace(/"/g, '""')}"`,
            `"${String(item.subLocationDetail || '').replace(/"/g, '""')}"`,
            item.quantity,
            `"${String(item.source).replace(/"/g, '""')}"`,
            `"${String(item.poNumber || '').replace(/"/g, '""')}"`,
            `"${String(item.dateReceived || '').replace(/"/g, '""')}"`
        ].join(','));

        const csvContent = [headers.join(','), ...rows].join('\n');
        // Add BOM for UTF-8 to fix Excel SYLK error
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'inventory_report.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportPDF = () => createInventoryReportPdf(reportData).save('inventory_report.pdf');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="modal-container max-w-4xl flex flex-col">
                <div className="modal-header border-b">
                    <h2>Report Preview</h2>
                    <button type="button" onClick={onClose} className="bg-em-red text-white p-1 rounded-md hover:bg-red-700 transition-colors shadow-sm">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
                <div className="modal-body p-6 overflow-y-auto">
                    <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-neutral-200">
                            <thead className="bg-neutral-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">ID</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">Description</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">Category</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">Location</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">Qty</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">Source</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-black ">PO Details</th>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-black ">Print</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-neutral-200 text-sm">
                                {reportData.map((item, index) => (
                                    // FIX: Changed key to use `item.id` and `item.locationName` instead of `item.itemId` and `item.locationId`
                                    // which do not exist on the ReportDataItem type.
                                    <tr key={`${item.id}-${item.locationName}-${index}`}>
                                        <td className="px-4 py-3 whitespace-nowrap font-medium text-neutral-900">{item.id}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{item.description}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{item.category || ''}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                                            {item.locationName}
                                            {item.subLocationDetail && <span className="text-black"> - {item.subLocationDetail}</span>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-800 font-semibold">{item.quantity}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-600">{item.source}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                                            {item.source === 'PO' ? `${item.poNumber || ''} (${item.dateReceived || ''})` : 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                            {item.locationName !== 'N/A' && (
                                                <button
                                                    onClick={() => onPrintSpecificLabel({
                                                        itemId: item.id,
                                                        description: item.description,
                                                        locationName: item.locationName,
                                                        subLocationDetail: item.subLocationDetail,
                                                    })}
                                                    className="btn-icon text-black hover:text-neutral-800"
                                                    title={`Print label for ${item.locationName}`}
                                                >
                                                    <PrinterIcon className="w-5 h-5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" onClick={handleExportCSV} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-neutral-600 border border-transparent rounded-md shadow-sm hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500">
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2"/>
                        Export CSV
                    </button>
                    <button type="button" onClick={handleExportPDF} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-em-red border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-em-red">
                        <ArrowDownTrayIcon className="w-4 h-4 mr-2"/>
                        Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReportPreviewModal;
