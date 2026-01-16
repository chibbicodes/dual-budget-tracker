import { useBudget } from '../contexts/BudgetContext'
import { useMemo, useState } from 'react'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { formatCurrency } from '../utils/calculations'
import { Download, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { BudgetType } from '../types'

export default function BudgetArchive() {
  const { currentView, appData } = useBudget()
  const navigate = useNavigate()
  const [selectedArchiveMonth, setSelectedArchiveMonth] = useState<string>('')

  // Budget Archive doesn't support combined view
  if (currentView === 'combined') {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/budget')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Budget
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget Archive</h1>
          <p className="text-gray-600 mt-2">
            Please select a specific budget (Household or Business) to view archived budgets
          </p>
        </div>
      </div>
    )
  }

  const budgetType = currentView as BudgetType

  // Get all archived months (any month older than 3 months from current)
  const archivedMonths = useMemo(() => {
    const currentDate = new Date()
    const threeMonthsAgo = subMonths(currentDate, 3)

    // Get unique months from transactions that are older than 3 months
    const uniqueMonths = new Set<string>()
    appData.transactions.forEach((t) => {
      if (t.budgetType === budgetType) {
        const tDate = parseISO(t.date)
        if (tDate < threeMonthsAgo) {
          uniqueMonths.add(format(tDate, 'yyyy-MM'))
        }
      }
    })

    // Convert to sorted array (newest first)
    return Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a))
  }, [appData.transactions, budgetType])

  // Calculate budget data for selected archive month
  const archiveBudgetData = useMemo(() => {
    if (!selectedArchiveMonth) return null

    const monthDate = parseISO(selectedArchiveMonth + '-01')
    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    // Get transactions for this month
    const monthTransactions = appData.transactions.filter((t) => {
      const tDate = parseISO(t.date)
      const category = appData.categories.find((c) => c.id === t.categoryId)
      return (
        t.budgetType === budgetType &&
        tDate >= monthStart &&
        tDate <= monthEnd &&
        !category?.excludeFromBudget
      )
    })

    // Calculate income and expenses
    const totalIncome = monthTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = Math.abs(
      monthTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )

    // Get categories with spending
    const categoryData = appData.categories
      .filter((c) => c.budgetType === budgetType && c.isActive)
      .map((category) => {
        const categoryTransactions = monthTransactions.filter(
          (t) => t.categoryId === category.id && t.amount < 0
        )
        const spent = Math.abs(
          categoryTransactions.reduce((sum, t) => sum + t.amount, 0)
        )

        // Get budgeted amount (check if monthly budget exists for this month)
        const monthlyBudget = appData.monthlyBudgets.find(
          (mb) => mb.month === selectedArchiveMonth && mb.categoryId === category.id
        )
        const budgeted = monthlyBudget?.amount ?? category.monthlyBudget

        return {
          categoryName: category.name,
          budgeted,
          spent,
          remaining: budgeted - spent,
          transactionCount: categoryTransactions.length,
        }
      })
      .filter((c) => c.spent > 0 || c.budgeted > 0) // Only show categories with activity or budget
      .sort((a, b) => b.spent - a.spent)

    return {
      month: format(monthDate, 'MMMM yyyy'),
      totalIncome,
      totalExpenses,
      remaining: totalIncome - totalExpenses,
      categories: categoryData,
    }
  }, [selectedArchiveMonth, appData.transactions, appData.categories, appData.monthlyBudgets, budgetType])

  const handleExportPDF = () => {
    if (!archiveBudgetData) return

    // Create a simple text-based "PDF" (actually a text file that can be printed to PDF)
    const content = `
${budgetType === 'household' ? 'HOUSEHOLD' : 'BUSINESS'} BUDGET REPORT
${archiveBudgetData.month}
${'='.repeat(60)}

SUMMARY
-------
Total Income:    ${formatCurrency(archiveBudgetData.totalIncome)}
Total Expenses:  ${formatCurrency(archiveBudgetData.totalExpenses)}
Remaining:       ${formatCurrency(archiveBudgetData.remaining)}

CATEGORY BREAKDOWN
------------------
${archiveBudgetData.categories
  .map(
    (c) => `
${c.categoryName}
  Budgeted:     ${formatCurrency(c.budgeted)}
  Spent:        ${formatCurrency(c.spent)}
  Remaining:    ${formatCurrency(c.remaining)}
  Transactions: ${c.transactionCount}
`
  )
  .join('')}

${'='.repeat(60)}
Generated: ${format(new Date(), 'PPpp')}
    `.trim()

    // Download as text file
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `budget-${budgetType}-${selectedArchiveMonth}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/budget')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Back to Budget
        </button>
        <h1 className="text-3xl font-bold text-gray-900">
          {budgetType === 'household' ? 'Household' : 'Business'} Budget Archive
        </h1>
        <p className="text-gray-600 mt-2">
          View and export historical budget data (budgets older than 3 months)
        </p>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Archived Month:
        </label>
        {archivedMonths.length === 0 ? (
          <p className="text-gray-500 italic">No archived budgets available yet</p>
        ) : (
          <div className="flex items-center gap-4">
            <select
              value={selectedArchiveMonth}
              onChange={(e) => setSelectedArchiveMonth(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a month --</option>
              {archivedMonths.map((month) => (
                <option key={month} value={month}>
                  {format(parseISO(month + '-01'), 'MMMM yyyy')}
                </option>
              ))}
            </select>
            {selectedArchiveMonth && archiveBudgetData && (
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-5 w-5" />
                Export
              </button>
            )}
          </div>
        )}
      </div>

      {/* Budget Data Display */}
      {selectedArchiveMonth && archiveBudgetData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-600">Total Income</p>
              <p className="text-2xl font-bold text-green-600 mt-2">
                {formatCurrency(archiveBudgetData.totalIncome)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-600">Total Expenses</p>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {formatCurrency(archiveBudgetData.totalExpenses)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <p className="text-sm font-medium text-gray-600">Remaining</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  archiveBudgetData.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(archiveBudgetData.remaining)}
              </p>
            </div>
          </div>

          {/* Category Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Category Breakdown</h2>
            </div>
            <div className="p-6">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Category
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Budgeted
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Spent
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Remaining
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Transactions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {archiveBudgetData.categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No spending data for this month
                      </td>
                    </tr>
                  ) : (
                    archiveBudgetData.categories.map((category, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-4">
                          <p className="font-medium text-gray-900">{category.categoryName}</p>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {formatCurrency(category.budgeted)}
                          </p>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm text-red-600">
                            {formatCurrency(category.spent)}
                          </p>
                        </td>
                        <td className="py-4 text-right">
                          <p
                            className={`text-sm font-medium ${
                              category.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(category.remaining)}
                          </p>
                        </td>
                        <td className="py-4 text-right">
                          <p className="text-sm text-gray-600">{category.transactionCount}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
