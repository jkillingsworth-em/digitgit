import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import type { ReportDataItem } from '../types';

export function createInventoryReportPdf(reportData: ReportDataItem[]): jsPDF {
  const document = new jsPDF();
  document.text('Inventory Report', 14, 16);
  autoTable(document, {
    head: [['ID', 'Description', 'Category', 'Location', 'Qty', 'Source', 'PO #']],
    body: reportData.map(item => [item.id, item.description, item.category || '',
      `${item.locationName}${item.subLocationDetail ? ' - ' + item.subLocationDetail : ''}`,
      item.quantity, item.source, item.poNumber || '']),
    startY: 20,
    theme: 'striped',
    headStyles: { fillColor: [10, 30, 58] },
    styles: { fontSize: 8 }
  });
  return document;
}
