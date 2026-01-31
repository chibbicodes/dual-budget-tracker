import { useMemo, useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency } from '../utils/calculations'
import { TrendingUp, Download, DollarSign, Receipt, FileText, PieChart } from 'lucide-react'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

type ReportPeriod = 'current_month' | 'last_month' | 'quarter' | 'year' | 'custom'

export default function BusinessReports() {
  const { currentView, appData } = useBudget()
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('current_month')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  // Calculate date range based on period
  const dateRange = useMemo(() => {
    const now = new Date()

    switch (reportPeriod) {
      case 'current_month':
        return { start: startOfMonth(now), end: endOfMonth(now), label: 'Current Month' }
      case 'last_month': {
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth), label: 'Last Month' }
      }
      case 'quarter': {
        const threeMonthsAgo = subMonths(now, 3)
        return { start: startOfMonth(threeMonthsAgo), end: endOfMonth(now), label: 'Last 3 Months (Quarter)' }
      }
      case 'year': {
        const yearAgo = subMonths(now, 12)
        return { start: startOfMonth(yearAgo), end: endOfMonth(now), label: 'Last 12 Months (Year)' }
      }
      case 'custom':
        if (customStartDate && customEndDate) {
          return {
            start: new Date(customStartDate),
            end: new Date(customEndDate),
            label: `${customStartDate} to ${customEndDate}`,
          }
        }
        return { start: startOfMonth(now), end: endOfMonth(now), label: 'Custom Period' }
      default:
        return { start: startOfMonth(now), end: endOfMonth(now), label: 'Current Month' }
    }
  }, [reportPeriod, customStartDate, customEndDate])

  // Filter business transactions for the period (excluding transfers and other non-budget categories)
  const businessTransactions = useMemo(() => {
    return appData.transactions.filter((t) => {
      const transDate = new Date(t.date)
      const category = appData.categories.find((c) => c.id === t.categoryId)
      return (
        t.budgetType === 'business' &&
        transDate >= dateRange.start &&
        transDate <= dateRange.end &&
        !category?.excludeFromBudget
      )
    })
  }, [appData.transactions, appData.categories, dateRange])

  // Calculate P&L Statement
  const profitLoss = useMemo(() => {
    const revenue = businessTransactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)

    const expenses = Math.abs(
      businessTransactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
    )

    const taxDeductibleExpenses = Math.abs(
      businessTransactions.filter((t) => t.amount < 0 && t.taxDeductible).reduce((sum, t) => sum + t.amount, 0)
    )

    // Expenses by category
    const expensesByCategory = new Map<string, { amount: number; taxDeductible: boolean; count: number }>()

    businessTransactions
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        const existing = expensesByCategory.get(t.categoryId) || {
          amount: 0,
          taxDeductible: t.taxDeductible,
          count: 0,
        }
        expensesByCategory.set(t.categoryId, {
          amount: existing.amount + Math.abs(t.amount),
          taxDeductible: t.taxDeductible,
          count: existing.count + 1,
        })
      })

    const categoryExpenses = Array.from(expensesByCategory.entries())
      .map(([categoryId, data]) => {
        const category = appData.categories.find((c) => c.id === categoryId)
        return {
          categoryId,
          categoryName: category?.name || 'Uncategorized',
          amount: data.amount,
          percentOfTotal: expenses > 0 ? (data.amount / expenses) * 100 : 0,
          taxDeductible: data.taxDeductible,
          count: data.count,
        }
      })
      .sort((a, b) => b.amount - a.amount)

    const netIncome = revenue - expenses
    const profitMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0

    return {
      revenue,
      expenses,
      netIncome,
      profitMargin,
      taxDeductibleExpenses,
      taxDeductiblePercent: expenses > 0 ? (taxDeductibleExpenses / expenses) * 100 : 0,
      categoryExpenses,
    }
  }, [businessTransactions, appData.categories])

  // Revenue by client/source
  const revenueByClient = useMemo(() => {
    const clientRevenue = new Map<string, number>()

    businessTransactions
      .filter((t) => t.amount > 0)
      .forEach((t) => {
        // Try to extract client from description or match to income source
        const matchingIncome = appData.income.find(
          (income) =>
            income.budgetType === 'business' &&
            (t.description.toLowerCase().includes(income.source.toLowerCase()) ||
              (income.client && t.description.toLowerCase().includes(income.client.toLowerCase())))
        )

        const clientName = matchingIncome?.client || matchingIncome?.source || t.description

        const existing = clientRevenue.get(clientName) || 0
        clientRevenue.set(clientName, existing + t.amount)
      })

    return Array.from(clientRevenue.entries())
      .map(([client, amount]) => ({
        client,
        amount,
        percentOfTotal: profitLoss.revenue > 0 ? (amount / profitLoss.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10) // Top 10 clients
  }, [businessTransactions, appData.income, profitLoss.revenue])

  // Export report as text
  const handleExport = () => {
    const report = `
BUSINESS PROFIT & LOSS STATEMENT
Period: ${dateRange.label}
Generated: ${format(new Date(), 'MMM d, yyyy')}

════════════════════════════════════════════

SUMMARY
────────────────────────────────────────────
Revenue:                     ${formatCurrency(profitLoss.revenue)}
Expenses:                   ${formatCurrency(profitLoss.expenses)}
────────────────────────────────────────────
Net Income:                 ${formatCurrency(profitLoss.netIncome)}
Profit Margin:              ${profitLoss.profitMargin.toFixed(2)}%

TAX INFORMATION
────────────────────────────────────────────
Tax-Deductible Expenses:    ${formatCurrency(profitLoss.taxDeductibleExpenses)}
Percentage of Expenses:     ${profitLoss.taxDeductiblePercent.toFixed(1)}%

EXPENSES BY CATEGORY
────────────────────────────────────────────
${profitLoss.categoryExpenses
  .map(
    (cat) =>
      `${cat.categoryName.padEnd(30)} ${formatCurrency(cat.amount).padStart(12)} (${cat.percentOfTotal.toFixed(1)}%)${cat.taxDeductible ? ' *' : ''}`
  )
  .join('\n')}

* = Tax Deductible

REVENUE BY CLIENT/SOURCE
────────────────────────────────────────────
${revenueByClient.map((item) => `${item.client.padEnd(30)} ${formatCurrency(item.amount).padStart(12)}`).join('\n')}

════════════════════════════════════════════
`

    const blob = new Blob([report], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `business-report-${format(new Date(), 'yyyy-MM-dd')}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Block non-business views
  if (currentView !== 'business') {
    return (
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Business Reports</h2>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-800">
            Business reports are only available in Business budget view. Please switch to Business view to access
            reports.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Business Reports</h2>

        <div className="flex items-center gap-4">
          {/* Report period selector */}
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value as ReportPeriod)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="current_month">Current Month</option>
            <option value="last_month">Last Month</option>
            <option value="quarter">Last Quarter (3 months)</option>
            <option value="year">Last Year (12 months)</option>
            <option value="custom">Custom Period</option>
          </select>

          {/* Export button */}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Custom date range */}
      {reportPeriod === 'custom' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Period label */}
      <div className="mb-6">
        <p className="text-sm text-gray-600">
          Report Period: <span className="font-semibold">{dateRange.label}</span>
        </p>
        <p className="text-sm text-gray-500">
          {format(dateRange.start, 'MMM d, yyyy')} - {format(dateRange.end, 'MMM d, yyyy')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(profitLoss.revenue)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Expenses</h3>
            <Receipt className="h-5 w-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(profitLoss.expenses)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Net Income</h3>
            <TrendingUp className={`h-5 w-5 ${profitLoss.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
          <p className={`text-2xl font-bold ${profitLoss.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(profitLoss.netIncome)}
          </p>
          <p className="text-sm text-gray-500 mt-1">Margin: {profitLoss.profitMargin.toFixed(1)}%</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Tax Deductible</h3>
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(profitLoss.taxDeductibleExpenses)}</p>
          <p className="text-sm text-gray-500 mt-1">{profitLoss.taxDeductiblePercent.toFixed(1)}% of expenses</p>
        </div>
      </div>

      {/* Expenses by Category */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <PieChart className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Expenses by Category</h3>
        </div>
        <div>
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transactions
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tax Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {profitLoss.categoryExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No expenses found for this period
                  </td>
                </tr>
              ) : (
                profitLoss.categoryExpenses.map((cat) => (
                  <tr key={cat.categoryId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {cat.categoryName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(cat.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(cat.percentOfTotal, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{cat.percentOfTotal.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{cat.count}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {cat.taxDeductible ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Tax Deductible
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Not Deductible
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue by Client/Source */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Revenue by Client/Source</h3>
          <p className="text-sm text-gray-500 mt-1">Top 10 revenue sources</p>
        </div>
        <div>
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client/Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  % of Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contribution
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {revenueByClient.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No revenue found for this period
                  </td>
                </tr>
              ) : (
                revenueByClient.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.client}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {item.percentOfTotal.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${Math.min(item.percentOfTotal, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
