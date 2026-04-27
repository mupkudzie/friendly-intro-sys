import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';
import { format } from 'date-fns';

const BRAND_PRIMARY: [number, number, number] = [22, 101, 52]; // emerald-800
const BRAND_ACCENT: [number, number, number] = [202, 138, 4]; // amber-600
const TEXT_MUTED: [number, number, number] = [100, 116, 139]; // slate-500

interface PDFHeaderOptions {
  title: string;
  subtitle?: string;
}

export function createBrandedPDF({ title, subtitle }: PDFHeaderOptions): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Brand bar
  doc.setFillColor(...BRAND_PRIMARY);
  doc.rect(0, 0, pageWidth, 22, 'F');
  doc.setFillColor(...BRAND_ACCENT);
  doc.rect(0, 22, pageWidth, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FarmFlow', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Workforce Management Report', 14, 19);

  // Generated date (right)
  doc.setFontSize(9);
  doc.text(`Generated ${format(new Date(), 'MMM d, yyyy HH:mm')}`, pageWidth - 14, 19, { align: 'right' });

  // Title
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 36);

  if (subtitle) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitle, 14, 42);
  }

  return doc;
}

export function addFooterToAllPages(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text('FarmFlow • Confidential', 14, pageHeight - 8);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
}

export interface SectionOptions {
  title: string;
  startY: number;
}

export function addSectionTitle(doc: jsPDF, title: string, startY: number): number {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND_PRIMARY);
  doc.text(title, 14, startY);
  doc.setDrawColor(...BRAND_PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(14, startY + 1.5, 50, startY + 1.5);
  doc.setLineWidth(0.2);
  return startY + 6;
}

export function addKeyValueGrid(
  doc: jsPDF,
  pairs: { label: string; value: string }[],
  startY: number,
  columns = 2
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const usableWidth = pageWidth - 28;
  const colWidth = usableWidth / columns;
  const rowHeight = 10;

  doc.setFontSize(9);
  pairs.forEach((pair, idx) => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const x = 14 + col * colWidth;
    const y = startY + row * rowHeight;

    doc.setTextColor(...TEXT_MUTED);
    doc.setFont('helvetica', 'normal');
    doc.text(pair.label, x, y);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(pair.value || '—', x, y + 4.5);
  });

  const rows = Math.ceil(pairs.length / columns);
  return startY + rows * rowHeight + 2;
}

export function addTable(
  doc: jsPDF,
  head: string[],
  body: RowInput[],
  startY: number
): number {
  autoTable(doc, {
    head: [head],
    body,
    startY,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: {
      fillColor: BRAND_PRIMARY,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'striped',
  });
  // @ts-expect-error – jspdf-autotable attaches lastAutoTable
  return (doc.lastAutoTable?.finalY || startY) + 6;
}

export function addApprovalBlock(doc: jsPDF, startY: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 30;
  }

  y = addSectionTitle(doc, 'Approval & Sign-off', y);
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'This report has been generated automatically by the FarmFlow workforce management system. The signatures below confirm the accuracy of the data presented.',
    14,
    y,
    { maxWidth: doc.internal.pageSize.getWidth() - 28 }
  );
  y += 14;

  const signLineY = y + 14;
  doc.setDrawColor(15, 23, 42);
  doc.line(14, signLineY, 90, signLineY);
  doc.line(110, signLineY, 186, signLineY);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Worker Signature', 14, signLineY + 5);
  doc.text('Supervisor Signature', 110, signLineY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_MUTED);
  doc.text('Date: __________________', 14, signLineY + 11);
  doc.text('Date: __________________', 110, signLineY + 11);

  return signLineY + 18;
}

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}
