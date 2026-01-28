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
    totalAssets?: number;
    totalLiabilities?: number;
    income?: number;
    expenses?: number;
    remaining?: number;
    householdNetWorth?: number;
    householdIncome?: number;
    householdExpenses?: number;
    householdRemaining?: number;
    businessNetWorth?: number;
    businessRevenue?: number;
    businessExpenses?: number;
    businessNetProfit?: number;
  },
  accounts: any[],
  topCategories: any[],
  bucketBreakdown?: any[]
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

  // For combined view, show both household and business sections
  if (viewType === 'combined') {
    // Combined Summary Metrics
    doc.setFontSize(14);
    doc.text('Combined Overview', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (metrics.totalAssets !== undefined) {
      doc.text(`Total Assets: $${metrics.totalAssets.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.totalLiabilities !== undefined) {
      doc.text(`Total Liabilities: $${metrics.totalLiabilities.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.netWorth !== undefined) {
      doc.text(`Net Worth: $${metrics.netWorth.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }

    yPos += 8;

    // Household Section
    doc.setFontSize(14);
    doc.text('Household', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (metrics.householdNetWorth !== undefined) {
      doc.text(`Net Worth: $${metrics.householdNetWorth.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.householdIncome !== undefined) {
      doc.text(`This Month Income: $${metrics.householdIncome.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.householdExpenses !== undefined) {
      doc.text(`This Month Expenses: $${metrics.householdExpenses.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.householdRemaining !== undefined) {
      doc.text(`Remaining: $${metrics.householdRemaining.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }

    yPos += 8;

    // Household Accounts
    const householdAccounts = accounts.filter(acc => acc.budgetType === 'household');
    if (householdAccounts.length > 0) {
      doc.setFontSize(12);
      doc.text('Household Accounts', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        head: [['Account Name', 'Type', 'Balance', 'Utilization']],
        body: householdAccounts.map(acc => [
          acc.name,
          acc.type,
          `$${acc.balance.toFixed(2)}`,
          acc.creditUtilization !== undefined ? `${acc.creditUtilization.toFixed(1)}%` : '-'
        ]),
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Business Section
    doc.setFontSize(14);
    doc.text('Business', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (metrics.businessNetWorth !== undefined) {
      doc.text(`Net Worth: $${metrics.businessNetWorth.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.businessRevenue !== undefined) {
      doc.text(`This Month Revenue: $${metrics.businessRevenue.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.businessExpenses !== undefined) {
      doc.text(`This Month Expenses: $${metrics.businessExpenses.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.businessNetProfit !== undefined) {
      doc.text(`Net Profit: $${metrics.businessNetProfit.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }

    yPos += 8;

    // Business Accounts
    const businessAccounts = accounts.filter(acc => acc.budgetType === 'business');
    if (businessAccounts.length > 0) {
      doc.setFontSize(12);
      doc.text('Business Accounts', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        head: [['Account Name', 'Type', 'Balance', 'Utilization']],
        body: businessAccounts.map(acc => [
          acc.name,
          acc.type,
          `$${acc.balance.toFixed(2)}`,
          acc.creditUtilization !== undefined ? `${acc.creditUtilization.toFixed(1)}%` : '-'
        ]),
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [34, 197, 94] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  } else {
    // Single view (Household or Business)
    // Summary Metrics
    doc.setFontSize(14);
    doc.text('Summary Metrics', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (metrics.totalAssets !== undefined) {
      doc.text(`Total Assets: $${metrics.totalAssets.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.totalLiabilities !== undefined) {
      doc.text(`Total Liabilities: $${metrics.totalLiabilities.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.netWorth !== undefined) {
      doc.text(`Net Worth: $${metrics.netWorth.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }

    yPos += 8;

    // Monthly Stats
    doc.setFontSize(14);
    doc.text('Monthly Stats', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    if (metrics.income !== undefined) {
      const label = viewType === 'business' ? 'Revenue This Month' : 'Income This Month';
      doc.text(`${label}: $${metrics.income.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.expenses !== undefined) {
      doc.text(`Expenses This Month: $${metrics.expenses.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }
    if (metrics.remaining !== undefined) {
      const label = viewType === 'business' ? 'Net Profit' : 'Remaining';
      doc.text(`${label}: $${metrics.remaining.toFixed(2)}`, 20, yPos);
      yPos += 6;
    }

    yPos += 8;

    // Accounts
    if (accounts.length > 0) {
      doc.setFontSize(14);
      doc.text('Accounts', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        head: [['Account Name', 'Type', 'Balance', 'Utilization']],
        body: accounts.map(acc => [
          acc.name,
          acc.type,
          `$${acc.balance.toFixed(2)}`,
          acc.creditUtilization !== undefined ? `${acc.creditUtilization.toFixed(1)}%` : '-'
        ]),
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: viewType === 'household' ? [59, 130, 246] : [34, 197, 94] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    // Top Categories
    if (topCategories.length > 0) {
      doc.setFontSize(14);
      doc.text('Top Spending This Month', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        head: [['Category', 'Amount', 'Percentage']],
        body: topCategories.map(cat => [
          cat.name,
          `$${cat.amount.toFixed(2)}`,
          `${cat.percentage.toFixed(1)}%`
        ]),
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: viewType === 'household' ? [59, 130, 246] : [34, 197, 94] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }

    // Check if we need a new page for bucket breakdown
    if (yPos > 240 && bucketBreakdown && bucketBreakdown.length > 0) {
      doc.addPage();
      yPos = 20;
    }

    // Bucket Breakdown
    if (bucketBreakdown && bucketBreakdown.length > 0) {
      doc.setFontSize(14);
      doc.text('Spending by Category Bucket', 14, yPos);
      yPos += 5;

      autoTable(doc, {
        head: [['Bucket', 'Target', 'Actual', 'Difference', '% of Income']],
        body: bucketBreakdown.map(bucket => [
          bucket.bucketName,
          `$${bucket.targetAmount.toFixed(2)}`,
          `$${bucket.actualAmount.toFixed(2)}`,
          `$${bucket.overUnder.toFixed(2)}`,
          `${bucket.percentOfIncome.toFixed(1)}%`
        ]),
        startY: yPos,
        styles: { fontSize: 8 },
        headStyles: { fillColor: viewType === 'household' ? [59, 130, 246] : [34, 197, 94] },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
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
