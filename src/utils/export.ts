import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Converts data to CSV format and triggers download
 */
export function exportToCSV(data: any[], filename: string, headers?: string[]) {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get headers from first object if not provided
  const csvHeaders = headers || Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    csvHeaders.join(','),
    ...data.map(row =>
      csvHeaders.map(header => {
        const value = row[header];
        // Handle values that contain commas, quotes, or newlines
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports data to PDF format with a table
 */
export function exportToPDF(
  data: any[],
  filename: string,
  title: string,
  headers: string[],
  columnKeys: string[]
) {
  if (data.length === 0) {
    alert('No data to export');
    return;
  }

  const doc = new jsPDF();

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 15);

  // Add metadata
  doc.setFontSize(10);
  const date = new Date().toLocaleDateString();
  doc.text(`Generated on: ${date}`, 14, 25);

  // Create table
  const tableData = data.map(row =>
    columnKeys.map(key => {
      const value = row[key];
      if (value === null || value === undefined) return '';
      return String(value);
    })
  );

  autoTable(doc, {
    head: [headers],
    body: tableData,
    startY: 30,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [59, 130, 246] }, // Blue color
  });

  // Save the PDF
  doc.save(`${filename}.pdf`);
}

/**
 * Exports dashboard overview data to PDF
 */
export function exportDashboardToPDF(
  viewType: string,
  metrics: {
    netWorth?: number;
    income?: number;
    expenses?: number;
    remaining?: number;
  },
  accounts: any[],
  topCategories: any[]
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text(`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} Dashboard`, 14, 20);

  // Date
  doc.setFontSize(10);
  const date = new Date().toLocaleDateString();
  doc.text(`Generated on: ${date}`, 14, 28);

  let yPos = 40;

  // Summary Metrics
  doc.setFontSize(14);
  doc.text('Summary Metrics', 14, yPos);
  yPos += 10;

  doc.setFontSize(10);
  if (metrics.netWorth !== undefined) {
    doc.text(`Net Worth: $${metrics.netWorth.toFixed(2)}`, 20, yPos);
    yPos += 6;
  }
  if (metrics.income !== undefined) {
    doc.text(`Income This Month: $${metrics.income.toFixed(2)}`, 20, yPos);
    yPos += 6;
  }
  if (metrics.expenses !== undefined) {
    doc.text(`Expenses This Month: $${metrics.expenses.toFixed(2)}`, 20, yPos);
    yPos += 6;
  }
  if (metrics.remaining !== undefined) {
    doc.text(`Remaining Budget: $${metrics.remaining.toFixed(2)}`, 20, yPos);
    yPos += 6;
  }

  yPos += 10;

  // Accounts
  if (accounts.length > 0) {
    doc.setFontSize(14);
    doc.text('Accounts', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Account Name', 'Type', 'Balance']],
      body: accounts.map(acc => [
        acc.name,
        acc.type,
        `$${acc.balance.toFixed(2)}`
      ]),
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Top Categories
  if (topCategories.length > 0 && yPos < 250) {
    doc.setFontSize(14);
    doc.text('Top Spending Categories', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Category', 'Amount', 'Percentage']],
      body: topCategories.map(cat => [
        cat.name,
        `$${cat.amount.toFixed(2)}`,
        `${cat.percentage.toFixed(1)}%`
      ]),
      startY: yPos,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  doc.save(`${viewType}-dashboard-${date}.pdf`);
}

/**
 * Format currency for export
 */
export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Format date for export
 */
export function formatDate(date: Date | string): string {
  if (typeof date === 'string') {
    return new Date(date).toLocaleDateString();
  }
  return date.toLocaleDateString();
}
