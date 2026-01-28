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

  // Create CSV rows
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(csvHeaders.join(','));

  // Add data rows
  for (const row of data) {
    const values = csvHeaders.map(header => {
      const value = row[header];
      // Handle null/undefined
      if (value === null || value === undefined) return '';

      // Convert to string
      const stringValue = String(value);

      // Wrap in quotes if contains comma, quote, or newline
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  // Join rows with Windows-style line endings for better Excel compatibility
  const csvContent = csvRows.join('\r\n');

  // Create and trigger download with BOM for proper UTF-8 recognition
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
 * Exports budget analysis data to PDF
 */
export function exportAnalysisToPDF(
  budgetType: string,
  timeRange: string,
  metrics: {
    avgIncome: number;
    avgExpenses: number;
    avgNet: number;
    incomeTrend: number;
    expenseTrend: number;
    savingsRate: number;
  },
  budgetCompliance: {
    needs: { actual: number; target: number; diff: number };
    wants: { actual: number; target: number; diff: number };
    savings: { actual: number; target: number; diff: number };
  } | null,
  suggestions: Array<{
    categoryName: string;
    type: string;
    currentBudget: number;
    suggestedBudget: number;
    reason: string;
  }>,
  vendorAnalysis: Array<{
    vendor: string;
    totalPaid: number;
    count: number;
  }>,
  payeeAnalysis: Array<{
    payee: string;
    totalReceived: number;
    count: number;
  }>,
  categoryAnalysis: Array<{
    category: string;
    average: number;
    latest: number;
    budget: number;
    trend: string;
    percentChange: number;
  }>,
  historicalData: Array<{
    month: string;
    income: number;
    expenses: number;
    net: number;
    savingsRate: number;
  }>
) {
  const doc = new jsPDF();

  // Title
  doc.setFontSize(20);
  doc.text(`${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget Analysis`, 14, 20);

  // Date and time range
  doc.setFontSize(10);
  const date = new Date().toLocaleDateString();
  doc.text(`Generated on: ${date}`, 14, 28);
  doc.text(`Time Range: ${timeRange.replace('_', ' ').toUpperCase()}`, 14, 34);

  let yPos = 45;

  // Summary Metrics
  doc.setFontSize(14);
  doc.text('Summary Metrics', 14, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.text(`Average Monthly Income: $${metrics.avgIncome.toFixed(2)} (${metrics.incomeTrend > 0 ? '+' : ''}${metrics.incomeTrend.toFixed(1)}% trend)`, 20, yPos);
  yPos += 6;
  doc.text(`Average Monthly Expenses: $${metrics.avgExpenses.toFixed(2)} (${metrics.expenseTrend > 0 ? '+' : ''}${metrics.expenseTrend.toFixed(1)}% trend)`, 20, yPos);
  yPos += 6;
  doc.text(`Average Net: $${metrics.avgNet.toFixed(2)}`, 20, yPos);
  yPos += 6;
  doc.text(`Average Savings Rate: ${metrics.savingsRate.toFixed(1)}%`, 20, yPos);
  yPos += 10;

  // 50/30/20 Compliance (if applicable)
  if (budgetCompliance) {
    doc.setFontSize(14);
    doc.text('50/30/20 Budget Rule Compliance', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.text(`Needs: ${budgetCompliance.needs.actual.toFixed(1)}% (Target: ${budgetCompliance.needs.target}%, ${budgetCompliance.needs.diff > 0 ? '+' : ''}${budgetCompliance.needs.diff.toFixed(1)}% from target)`, 20, yPos);
    yPos += 6;
    doc.text(`Wants: ${budgetCompliance.wants.actual.toFixed(1)}% (Target: ${budgetCompliance.wants.target}%, ${budgetCompliance.wants.diff > 0 ? '+' : ''}${budgetCompliance.wants.diff.toFixed(1)}% from target)`, 20, yPos);
    yPos += 6;
    doc.text(`Savings: ${budgetCompliance.savings.actual.toFixed(1)}% (Target: ${budgetCompliance.savings.target}%, ${budgetCompliance.savings.diff > 0 ? '+' : ''}${budgetCompliance.savings.diff.toFixed(1)}% from target)`, 20, yPos);
    yPos += 10;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Smart Budget Suggestions
  if (suggestions.length > 0) {
    doc.setFontSize(14);
    doc.text('Smart Budget Suggestions', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Category', 'Type', 'Current', 'Suggested', 'Reason']],
      body: suggestions.map(s => [
        s.categoryName,
        s.type.toUpperCase(),
        `$${s.currentBudget.toFixed(2)}`,
        `$${s.suggestedBudget.toFixed(2)}`,
        s.reason.length > 40 ? s.reason.substring(0, 37) + '...' : s.reason
      ]),
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        4: { cellWidth: 60 }
      }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Vendor Analysis
  if (vendorAnalysis.length > 0) {
    doc.setFontSize(14);
    doc.text('Vendor Analysis (Expenses)', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Vendor', 'Total Paid', 'Transactions']],
      body: vendorAnalysis.slice(0, 15).map(v => [
        v.vendor.length > 40 ? v.vendor.substring(0, 37) + '...' : v.vendor,
        `$${v.totalPaid.toFixed(2)}`,
        v.count.toString()
      ]),
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [239, 68, 68] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Payee Analysis
  if (payeeAnalysis.length > 0) {
    doc.setFontSize(14);
    doc.text('Payee Analysis (Income)', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Payee', 'Total Received', 'Transactions']],
      body: payeeAnalysis.slice(0, 15).map(p => [
        p.payee.length > 40 ? p.payee.substring(0, 37) + '...' : p.payee,
        `$${p.totalReceived.toFixed(2)}`,
        p.count.toString()
      ]),
      startY: yPos,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [34, 197, 94] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Category Analysis
  if (categoryAnalysis.length > 0) {
    doc.setFontSize(14);
    doc.text('Category Analysis', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Category', 'Average', 'Latest', 'Budget', 'Trend', '% Change']],
      body: categoryAnalysis.map(c => [
        c.category,
        `$${c.average.toFixed(2)}`,
        `$${c.latest.toFixed(2)}`,
        `$${c.budget.toFixed(2)}`,
        c.trend,
        `${c.percentChange.toFixed(1)}%`
      ]),
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Historical Monthly Trends
  if (historicalData.length > 0) {
    doc.setFontSize(14);
    doc.text('Monthly Trends', 14, yPos);
    yPos += 5;

    autoTable(doc, {
      head: [['Month', 'Income', 'Expenses', 'Net', 'Savings Rate']],
      body: historicalData.map(m => [
        m.month,
        `$${m.income.toFixed(2)}`,
        `$${m.expenses.toFixed(2)}`,
        `$${m.net.toFixed(2)}`,
        `${m.savingsRate.toFixed(1)}%`
      ]),
      startY: yPos,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    });
  }

  doc.save(`${budgetType}-analysis-${timeRange}-${date}.pdf`);
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
