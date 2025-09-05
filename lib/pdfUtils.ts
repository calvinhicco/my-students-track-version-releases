import { format } from 'date-fns';
import type { Expense, ExpenseCategory } from '@/types/expense';

// Dynamic imports for jsPDF and jspdf-autotable to avoid SSR issues
// These libraries are only loaded when needed in a browser/Electron renderer
// browser environment. For type-checking we still import their types.
import type { jsPDF as JsPDFType } from 'jspdf';
import type autoTableType from 'jspdf-autotable';

// Runtime handles (initially undefined – resolved on first browser call)
let jsPDF: typeof JsPDFType | undefined;
let autoTable: typeof autoTableType | undefined;

/**
 * Lazy loader for jsPDF and jspdf-autotable.
 * Only loads the libraries when called in a browser/Electron renderer context.
 * Throws an error if called on the server.
 */
function loadJsPDF() {
  if (jsPDF && autoTable) return { jsPDF, autoTable } as const;

  if (typeof window === 'undefined') {
    throw new Error('jsPDF utilities can only be used in a browser / Electron renderer process.');
  }

  const { jsPDF: ctor } = require('jspdf');
  const at = require('jspdf-autotable');

  jsPDF = ctor as typeof JsPDFType;
  autoTable = (at.default || at) as typeof autoTableType;



  return { jsPDF, autoTable } as const;
}

// Derive the table options type from the second parameter of jspdf-autotable's function signature.
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type UserOptions = Parameters<typeof autoTableType>[1] & { [key: string]: any };
// Styles helper extracted from UserOptions
type Styles = UserOptions extends { styles?: infer S } ? S : never;
// Minimal CellInput fallback (jspdf-autotable does not export it directly)
type CellInput = string | number | { content?: string; colSpan?: number; styles?: Styles };
type TableRow = CellInput[];

/**
 * Typed wrapper for autoTable that ensures the plugin is loaded
 * and adds consistent page numbering.
 */
const typedAutoTable = (doc: JsPDFType, options: UserOptions) => {
  if (!autoTable) {
    loadJsPDF();
  }
  return (autoTable as typeof autoTableType)(doc as any, {
    ...options,
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages();
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();

      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        data.settings.margin.left || 20,
        pageHeight - 10
      );
      
      // Call the original didDrawPage if it exists
      if (options.didDrawPage) {
        options.didDrawPage(data);
      }
    },
  });
};

export const exportExpensesToPDF = (
  expenses: Expense[],
  categories: ExpenseCategory[],
  title: string,
  dateRange: { from: Date; to: Date }
) => {
  try {
    const { jsPDF: JsPDFCtor } = loadJsPDF();
    const doc = new JsPDFCtor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(18);
    doc.text(`Expense Report - ${title}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(
      `Date Range: ${format(dateRange.from, 'MMM d, yyyy')} to ${format(dateRange.to, 'MMM d, yyyy')}`, 
      14, 
      28
    );

    const filteredExpenses = expenses.filter(expense => !expense.isReversed);
    
    // Prepare table data
    const head = [
      'Date', 
      'Purpose', 
      'Category', 
      'Amount', 
      'Payment Method', 
      'Notes'
    ] as TableRow;

    const body = filteredExpenses.map(expense => [
      format(new Date(expense.date), 'MMM d, yyyy'),
      expense.purpose,
      categories.find(cat => cat.id === expense.category)?.name || 'Uncategorized',
      `$${expense.amount.toFixed(2)}`,
      'N/A', // Placeholder for missing paymentMethod
      expense.notes || 'N/A'
    ] as TableRow);

    // Add total row
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    body.push([
      { 
        content: 'Total', 
        colSpan: 3, 
        styles: { fontStyle: 'bold' } 
      },
      { 
        content: `$${totalAmount.toFixed(2)}`, 
        styles: { fontStyle: 'bold' } 
      },
      '',
      ''
    ] as TableRow);

    // Generate PDF
    typedAutoTable(doc, {
      head: [head],
      body: body,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 25, halign: 'left' },
        1: { cellWidth: 45, halign: 'left' },
        2: { cellWidth: 30, halign: 'left' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 30, halign: 'center' },
        5: { cellWidth: 'auto', halign: 'left' },
      },
    });

    doc.save(`expense-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportExtraBillingToPDF = (
  page: {
    name: string;
    entries: Array<{
      studentName: string;
      purpose: string;
      payments: Array<{ amount: number; date: string }>;
    }>;
  },
  dateRange: { from: Date; to: Date }
) => {
  try {
    const { jsPDF: JsPDFCtor } = loadJsPDF();
    const doc = new JsPDFCtor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(18);
    doc.text(`Extra Billing Report - ${page.name}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(
      `Date Range: ${format(dateRange.from, 'MMM d, yyyy')} to ${format(dateRange.to, 'MMM d, yyyy')}`,
      14,
      28
    );

    const entriesWithTotals = page.entries.map(entry => ({
      ...entry,
      totalAmount: entry.payments.reduce((sum, payment) => sum + payment.amount, 0)
    }));

    // Prepare table data
    const head = [
      'Student Name', 
      'Purpose', 
      'Payment Count', 
      'Total Amount'
    ] as TableRow;

    const body = entriesWithTotals.map(entry => [
      entry.studentName,
      entry.purpose,
      entry.payments.length.toString(),
      `$${entry.totalAmount.toFixed(2)}`
    ] as TableRow);

    // Add total row
    const grandTotal = entriesWithTotals.reduce((sum, entry) => sum + entry.totalAmount, 0);
    body.push([
      { 
        content: 'Grand Total', 
        colSpan: 3, 
        styles: { fontStyle: 'bold' } 
      },
      { 
        content: `$${grandTotal.toFixed(2)}`, 
        styles: { fontStyle: 'bold' } 
      }
    ] as TableRow);

    // Generate PDF
    typedAutoTable(doc, {
      head: [head],
      body: body,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 40, halign: 'left' },
        1: { cellWidth: 40, halign: 'left' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
      },
    });

    doc.save(`extra-billing-${page.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportTransferredStudentsToPDF = (
  students: Array<{
    id: string;
    fullName: string;
    gender: string;
    parentContact: string;
    originalClassName: string;
    transferDate: string;
    transferReason: string;
    newSchool: string;
    notes?: string;
  }>,
  title: string
) => {
  try {
    const { jsPDF: JsPDFCtor } = loadJsPDF();
    const doc = new JsPDFCtor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(18);
    doc.text(`Transferred Students Report - ${title}`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(
      `Generated on: ${format(new Date(), 'MMM d, yyyy hh:mm a')}`,
      14,
      28
    );

    // Prepare table data
    const head = [
      'ID', 
      'Student Name', 
      'Gender', 
      'Contact', 
      'Class', 
      'Transfer Date', 
      'Reason', 
      'New School', 
      'Notes'
    ] as TableRow;

    const body = students.map(student => [
      student.id,
      student.fullName,
      student.gender,
      student.parentContact,
      student.originalClassName,
      format(new Date(student.transferDate), 'MMM d, yyyy'),
      student.transferReason,
      student.newSchool,
      student.notes || 'N/A'
    ] as TableRow);

    // Generate PDF
    typedAutoTable(doc, {
      head: [head],
      body: body,
      startY: 35,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'left' },
        1: { cellWidth: 35, halign: 'left' },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'left' },
        4: { cellWidth: 20, halign: 'left' },
        5: { cellWidth: 25, halign: 'center' },
        6: { cellWidth: 30, halign: 'left' },
        7: { cellWidth: 35, halign: 'left' },
        8: { cellWidth: 'auto', halign: 'left' },
      },
    });

    doc.save(`transferred-students-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

export const exportOutstandingStudentsToPDF = (
  students: Array<{
    id: string;
    fullName: string;
    className: string;
    parentContact: string;
    outstandingAmount: number;
    lastPaymentDate?: string;
    paymentStatus: string;
  }>,
  totalOutstanding: number,
  settings: {
    schoolName: string;
    currency?: string;
  }
) => {
  try {
    const { jsPDF: JsPDFCtor } = loadJsPDF();
    const doc = new JsPDFCtor({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    doc.setFontSize(16);
    doc.text(`${settings.schoolName} - Outstanding Payments Report`, 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'MMM d, yyyy hh:mm a')}`, 14, 28);
    doc.text(`Total Outstanding: ${settings.currency || '$'}${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, 35);
    doc.text(`Number of Students: ${students.length}`, 14, 42);

    // Prepare table data
    const head = [
      'ID', 
      'Student Name', 
      'Class', 
      'Parent Contact', 
      'Outstanding Amount', 
      'Last Payment', 
      'Status'
    ] as TableRow;

    const body = students.map(student => [
      student.id,
      student.fullName,
      student.className,
      student.parentContact,
      `$${student.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      student.lastPaymentDate ? format(new Date(student.lastPaymentDate), 'MMM d, yyyy') : 'No payments',
      student.paymentStatus
    ] as TableRow);

    // Add total row
    body.push([
      { 
        content: 'Total', 
        colSpan: 4, 
        styles: { fontStyle: 'bold' } 
      },
      { 
        content: `$${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 
        styles: { fontStyle: 'bold' } 
      },
      '',
      ''
    ] as TableRow);

    // Generate PDF
    typedAutoTable(doc, {
      head: [head],
      body: body,
      startY: 49,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [220, 53, 69],
        textColor: 255,
        fontStyle: 'bold',
        lineWidth: 0.3,
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'left' },
        1: { cellWidth: 40, halign: 'left' },
        2: { cellWidth: 25, halign: 'left' },
        3: { cellWidth: 35, halign: 'left' },
        4: { cellWidth: 30, halign: 'right' },
        5: { cellWidth: 30, halign: 'center' },
        6: { cellWidth: 'auto', halign: 'center' },
      },
    });

    // Add summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text(`Summary: ${students.length} students with total outstanding of ${settings.currency || '$'}${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 14, finalY);

    doc.save(`outstanding-payments-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
