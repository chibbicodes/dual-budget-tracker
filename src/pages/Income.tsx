import React, { useMemo, useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency } from '../utils/calculations'
import BudgetBadge from '../components/BudgetBadge'
import Modal from '../components/Modal'
import { Plus, Edit2, Trash2, TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import type { BudgetType, Income as IncomeType } from '../types'
import { startOfMonth, endOfMonth, format, parseISO, addMonths, subMonths, differenceInDays } from 'date-fns'

type BudgetFilter = 'all' | BudgetType

export default function Income() {
  const { currentView, appData, addIncome, updateIncome, deleteIncome, addCategory } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<IncomeType | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date())

  // Generate month options (3 months prior to 3 months future)
  const monthOptions = useMemo(() => {
    const options = []
    const currentDate = new Date()
    for (let i = -3; i <= 3; i++) {
      const monthDate = addMonths(currentDate, i)
      options.push({
        date: monthDate,
        label: format(monthDate, 'MMMM yyyy'),
        value: format(monthDate, 'yyyy-MM'),
      })
    }
    return options
  }, [])

  // Get month string for selected month (YYYY-MM format)
  const selectedMonthString = useMemo(
    () => format(selectedMonth, 'yyyy-MM'),
    [selectedMonth]
  )

  // Filter income sources
  const filteredIncome = useMemo(() => {
    let income = appData.income

    if (currentView !== 'combined') {
      income = income.filter((i) => i.budgetType === currentView)
    } else if (budgetFilter !== 'all') {
      income = income.filter((i) => i.budgetType === budgetFilter)
    }

    return income.sort((a, b) => a.source.localeCompare(b.source))
  }, [appData.income, currentView, budgetFilter])

  // Group income sources by category
  const incomeByCategory = useMemo(() => {
    const grouped = new Map<string, { category: any; sources: IncomeType[] }>()

    filteredIncome.forEach(income => {
      const categoryId = income.categoryId || 'uncategorized'
      const category = categoryId === 'uncategorized'
        ? { id: 'uncategorized', name: 'Uncategorized' }
        : appData.categories.find(c => c.id === categoryId)

      if (!grouped.has(categoryId)) {
        grouped.set(categoryId, { category, sources: [] })
      }
      grouped.get(categoryId)!.sources.push(income)
    })

    // Convert to array and sort: categorized first, then uncategorized
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.category.id === 'uncategorized') return 1
      if (b.category.id === 'uncategorized') return -1
      return a.category.name.localeCompare(b.category.name)
    })
  }, [filteredIncome, appData.categories])

  // Helper function to calculate recurring income occurrences in a month
  const calculateRecurringOccurrences = (income: IncomeType, monthDate: Date): number => {
    if (!income.isRecurring) {
      // One-time income: check if expected date falls in this month
      if (income.expectedDate) {
        const expectedDate = parseISO(income.expectedDate + 'T12:00:00')
        const monthStart = startOfMonth(monthDate)
        const monthEnd = endOfMonth(monthDate)
        return expectedDate >= monthStart && expectedDate <= monthEnd ? 1 : 0
      }
      return 0
    }

    const monthStart = startOfMonth(monthDate)
    const monthEnd = endOfMonth(monthDate)

    switch (income.recurringFrequency) {
      case 'weekly':
      case 'bi-weekly':
      case 'every-15-days': {
        // For these frequencies, we need to count actual occurrences
        if (!income.expectedDate) {
          // Fallback to old logic if no start date specified
          const daysInMonth = differenceInDays(monthEnd, monthStart) + 1
          const interval = income.recurringFrequency === 'weekly' ? 7 :
                          income.recurringFrequency === 'bi-weekly' ? 14 : 15
          return Math.floor(daysInMonth / interval)
        }

        // Count actual occurrences starting from expected date
        let count = 0
        let currentDate = parseISO(income.expectedDate + 'T12:00:00')
        const interval = income.recurringFrequency === 'weekly' ? 7 :
                        income.recurringFrequency === 'bi-weekly' ? 14 : 15

        // If start date is before this month, fast-forward to first occurrence in or after this month
        while (currentDate < monthStart) {
          currentDate = new Date(currentDate.getTime() + interval * 24 * 60 * 60 * 1000)
        }

        // Count occurrences that fall within this month
        while (currentDate <= monthEnd) {
          if (currentDate >= monthStart) {
            count++
          }
          // Add interval days to get next occurrence
          currentDate = new Date(currentDate.getTime() + interval * 24 * 60 * 60 * 1000)
        }

        return count
      }
      case 'monthly':
      case 'same-day-each-month':
        // Once per month
        return 1
      default:
        // Default to once per month if frequency is unknown
        return 1
    }
  }

  // Calculate actual income for selected month from transactions
  const actualIncomeThisMonth = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)

    return appData.transactions
      .filter((t) => {
        const transDate = new Date(t.date)

        // For transfers, check the destination account's budget type
        if (t.toAccountId) {
          const toAccount = appData.accounts.find(a => a.id === t.toAccountId)
          if (toAccount) {
            const matchesBudget =
              currentView === 'combined'
                ? budgetFilter === 'all' || toAccount.budgetType === budgetFilter
                : toAccount.budgetType === currentView
            return t.amount > 0 && transDate >= monthStart && transDate <= monthEnd && matchesBudget
          }
        }

        // For regular income, use transaction's budget type
        const matchesBudget =
          currentView === 'combined'
            ? budgetFilter === 'all' || t.budgetType === budgetFilter
            : t.budgetType === currentView
        return t.amount > 0 && transDate >= monthStart && transDate <= monthEnd && matchesBudget
      })
      .reduce((sum, t) => sum + t.amount, 0)
  }, [appData.transactions, appData.accounts, currentView, budgetFilter, selectedMonth])

  // Calculate expected income for selected month (with recurring occurrences)
  const expectedIncomeThisMonth = useMemo(() => {
    return filteredIncome
      .map((i) => {
        const occurrences = calculateRecurringOccurrences(i, selectedMonth)
        return occurrences * (i.expectedAmount || 0)
      })
      .reduce((sum, amount) => sum + amount, 0)
  }, [filteredIncome, selectedMonth])

  // Income by source breakdown
  const incomeBySource = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth)
    const monthEnd = endOfMonth(selectedMonth)

    const sourceMap = new Map<string, { expected: number; actual: number; source: IncomeType }>()

    // Initialize with expected amounts (with recurring occurrences calculated)
    filteredIncome.forEach((income) => {
      const occurrences = calculateRecurringOccurrences(income, selectedMonth)
      sourceMap.set(income.id, {
        expected: occurrences * (income.expectedAmount || 0),
        actual: 0,
        source: income,
      })
    })

    // Add actual income from transactions
    appData.transactions
      .filter((t) => {
        const transDate = new Date(t.date)

        // For transfers, check the destination account's budget type
        if (t.toAccountId) {
          const toAccount = appData.accounts.find(a => a.id === t.toAccountId)
          if (toAccount) {
            const matchesBudget =
              currentView === 'combined'
                ? budgetFilter === 'all' || toAccount.budgetType === budgetFilter
                : toAccount.budgetType === currentView
            return t.amount > 0 && transDate >= monthStart && transDate <= monthEnd && matchesBudget
          }
        }

        // For regular income, use transaction's budget type
        const matchesBudget =
          currentView === 'combined'
            ? budgetFilter === 'all' || t.budgetType === budgetFilter
            : t.budgetType === currentView
        return t.amount > 0 && transDate >= monthStart && transDate <= monthEnd && matchesBudget
      })
      .forEach((transaction) => {
        // If transaction has an income source ID, use that directly
        if (transaction.incomeSourceId) {
          const existing = sourceMap.get(transaction.incomeSourceId)
          if (existing) {
            existing.actual += transaction.amount
          }
          return
        }

        // Otherwise, try to match transaction to income source by description
        // For transfers, use destination account's budget type; for regular income, use transaction budget type
        const budgetTypeToMatch = transaction.toAccountId
          ? appData.accounts.find(a => a.id === transaction.toAccountId)?.budgetType
          : transaction.budgetType

        const matchingIncome = filteredIncome.find(
          (income) =>
            income.budgetType === budgetTypeToMatch &&
            (transaction.description.toLowerCase().includes(income.source.toLowerCase()) ||
              (income.client && transaction.description.toLowerCase().includes(income.client.toLowerCase())))
        )

        if (matchingIncome) {
          const existing = sourceMap.get(matchingIncome.id)
          if (existing) {
            existing.actual += transaction.amount
          }
        }
      })

    return Array.from(sourceMap.values())
      .filter(item => item.expected > 0 || item.actual > 0) // Only show sources with expected or actual income this month
      .sort((a, b) => b.expected - a.expected)
  }, [filteredIncome, appData.transactions, currentView, budgetFilter, selectedMonth])

  const handleAdd = (income: Omit<IncomeType, 'id'>) => {
    addIncome(income)
    setIsAddModalOpen(false)
  }

  const handleUpdate = (income: Omit<IncomeType, 'id'>) => {
    if (editingIncome) {
      updateIncome(editingIncome.id, income)
      setEditingIncome(null)
    }
  }

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this income source?')) {
      deleteIncome(id)
    }
  }

  const variance = actualIncomeThisMonth - expectedIncomeThisMonth
  const variancePercent = expectedIncomeThisMonth > 0 ? (variance / expectedIncomeThisMonth) * 100 : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Income Tracking</h2>

        <div className="flex items-center gap-4">
          {/* Budget filter (only show in combined view) */}
          {currentView === 'combined' && (
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setBudgetFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  budgetFilter === 'all'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setBudgetFilter('household')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  budgetFilter === 'household'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Household
              </button>
              <button
                onClick={() => setBudgetFilter('business')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  budgetFilter === 'business'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Business
              </button>
            </div>
          )}

          <button
            onClick={() => setIsAddCategoryModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Income Category
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Income Source
          </button>
        </div>
      </div>

      {/* Month Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Viewing:</label>
            <select
              value={selectedMonthString}
              onChange={(e) => setSelectedMonth(parseISO(e.target.value + '-01'))}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Expected ({format(selectedMonth, 'MMM yyyy')})</h3>
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(expectedIncomeThisMonth)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Actual ({format(selectedMonth, 'MMM yyyy')})</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(actualIncomeThisMonth)}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Variance</h3>
            {variance >= 0 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
          </div>
          <p className={`text-2xl font-bold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variance >= 0 ? '+' : ''}
            {formatCurrency(variance)}
          </p>
          <p className={`text-sm ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {variancePercent >= 0 ? '+' : ''}
            {variancePercent.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Income by source breakdown */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Income by Source ({format(selectedMonth, 'MMMM yyyy')})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {incomeBySource.map((item) => {
                const variance = item.actual - item.expected
                const percentAchieved = item.expected > 0 ? (item.actual / item.expected) * 100 : 0

                return (
                  <tr key={item.source.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.source.source}</div>
                        {item.source.client && (
                          <div className="text-sm text-gray-500">{item.source.client}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <BudgetBadge budgetType={item.source.budgetType} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.expected)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.actual)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}
                        {formatCurrency(variance)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              percentAchieved >= 100
                                ? 'bg-green-600'
                                : percentAchieved >= 75
                                ? 'bg-yellow-500'
                                : 'bg-red-600'
                            }`}
                            style={{ width: `${Math.min(percentAchieved, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12 text-right">{percentAchieved.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Income sources list */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Income Sources</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredIncome.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No income sources found. Click "Add Income Source" to get started.
                  </td>
                </tr>
              ) : (
                incomeByCategory.map((group) => (
                  <React.Fragment key={group.category.id}>
                    {/* Category Header */}
                    <tr key={`header-${group.category.id}`} className="bg-indigo-50">
                      <td colSpan={6} className="px-6 py-3">
                        <h4 className="text-sm font-semibold text-indigo-900">
                          {group.category.name}
                        </h4>
                      </td>
                    </tr>
                    {/* Income Sources in this category */}
                    {group.sources.map((income) => (
                      <tr key={income.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{income.source}</div>
                            {income.client && <div className="text-sm text-gray-500">{income.client}</div>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <BudgetBadge budgetType={income.budgetType} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              income.isRecurring ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {income.isRecurring ? 'Recurring' : 'One-time'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(income.expectedAmount || 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {income.expectedDate ? format(parseISO(income.expectedDate + 'T12:00:00'), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm space-x-3">
                          <button
                            onClick={() => setEditingIncome(income)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(income.id)} className="text-red-600 hover:text-red-800">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add modal */}
      {isAddModalOpen && (
        <Modal isOpen={true} onClose={() => setIsAddModalOpen(false)} title="Add Income Source">
          <IncomeForm
            onSubmit={handleAdd}
            onCancel={() => setIsAddModalOpen(false)}
            defaultBudgetType={currentView === 'combined' ? 'household' : (currentView as BudgetType)}
          />
        </Modal>
      )}

      {/* Edit modal */}
      {editingIncome && (
        <Modal isOpen={true} onClose={() => setEditingIncome(null)} title="Edit Income Source">
          <IncomeForm
            income={editingIncome}
            onSubmit={handleUpdate}
            onCancel={() => setEditingIncome(null)}
            defaultBudgetType={editingIncome.budgetType}
          />
        </Modal>
      )}

      {/* Add Income Category modal */}
      {isAddCategoryModalOpen && (
        <Modal isOpen={true} onClose={() => setIsAddCategoryModalOpen(false)} title="Add Income Category">
          <IncomeCategoryForm
            onSubmit={(categoryData) => {
              addCategory(categoryData)
              setIsAddCategoryModalOpen(false)
            }}
            onCancel={() => setIsAddCategoryModalOpen(false)}
            defaultBudgetType={currentView === 'combined' ? 'household' : (currentView as BudgetType)}
          />
        </Modal>
      )}
    </div>
  )
}

interface IncomeFormProps {
  income?: IncomeType
  onSubmit: (income: Omit<IncomeType, 'id'>) => void
  onCancel: () => void
  defaultBudgetType: BudgetType
}

function IncomeForm({ income, onSubmit, onCancel, defaultBudgetType }: IncomeFormProps) {
  const { appData } = useBudget()

  const [formData, setFormData] = useState({
    source: income?.source || '',
    budgetType: income?.budgetType || defaultBudgetType,
    categoryId: (income as any)?.categoryId || '',
    client: income?.client || '',
    expectedAmount: income?.expectedAmount?.toString() || '',
    isRecurring: income?.isRecurring ?? true,
    recurringFrequency: income?.recurringFrequency || 'monthly',
    recurringDayOfMonth: income?.recurringDayOfMonth?.toString() || '1',
    expectedDate: income?.expectedDate || '',
  })

  // Get income categories for the selected budget type
  const incomeCategories = appData.categories.filter(
    (c) => c.budgetType === formData.budgetType && c.isIncomeCategory === true && c.isActive
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submissionData: any = {
      source: formData.source,
      budgetType: formData.budgetType,
      categoryId: formData.categoryId || undefined,
      client: formData.client || undefined,
      expectedAmount: parseFloat(formData.expectedAmount) || 0,
      isRecurring: formData.isRecurring,
      expectedDate: formData.expectedDate || undefined,
    }

    // Add recurring frequency options if recurring
    if (formData.isRecurring) {
      submissionData.recurringFrequency = formData.recurringFrequency
      if (formData.recurringFrequency === 'same-day-each-month') {
        submissionData.recurringDayOfMonth = parseInt(formData.recurringDayOfMonth) || 1
      }
    }

    onSubmit(submissionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Source Name *</label>
        <input
          type="text"
          value={formData.source}
          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Salary, Freelance, Dividends"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget Type *</label>
        <select
          value={formData.budgetType}
          onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as BudgetType, categoryId: '' })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="household">Household</option>
          <option value="business">Business</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Income Category</label>
        <select
          value={formData.categoryId}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select category (optional)</option>
          {incomeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">
          Links this income source to a category for better tracking in transactions
        </p>
      </div>

      {formData.budgetType === 'business' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client/Customer</label>
          <input
            type="text"
            value={formData.client}
            onChange={(e) => setFormData({ ...formData, client: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional client name"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expected Amount *</label>
        <input
          type="number"
          step="0.01"
          value={formData.expectedAmount}
          onChange={(e) => setFormData({ ...formData, expectedAmount: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          required
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.isRecurring}
            onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Recurring Income</span>
        </label>
        <p className="text-sm text-gray-500 ml-6">Check if this income repeats regularly</p>
      </div>

      {/* Recurring Frequency Options */}
      {formData.isRecurring && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
          <select
            value={formData.recurringFrequency}
            onChange={(e) => setFormData({ ...formData, recurringFrequency: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="weekly">Weekly</option>
            <option value="bi-weekly">Bi-weekly (Every 2 weeks)</option>
            <option value="every-15-days">Every 15 Days</option>
            <option value="monthly">Monthly</option>
            <option value="same-day-each-month">Same Day Each Month</option>
          </select>
        </div>
      )}

      {/* Day of Month (only for same-day-each-month) */}
      {formData.isRecurring && formData.recurringFrequency === 'same-day-each-month' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month *</label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.recurringDayOfMonth}
            onChange={(e) => setFormData({ ...formData, recurringDayOfMonth: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="1-31"
            required
          />
          <p className="text-sm text-gray-500 mt-1">
            Enter the day of the month (1-31) when this income is expected
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
        <input
          type="date"
          value={formData.expectedDate}
          onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-sm text-gray-500 mt-1">
          {formData.isRecurring ? 'Next expected date for this recurring income' : 'Expected date for this one-time income'}
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          {income ? 'Update' : 'Add'} Income Source
        </button>
      </div>
    </form>
  )
}

interface IncomeCategoryFormProps {
  onSubmit: (category: any) => void
  onCancel: () => void
  defaultBudgetType: BudgetType
}

function IncomeCategoryForm({ onSubmit, onCancel, defaultBudgetType }: IncomeCategoryFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    budgetType: defaultBudgetType,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Get the appropriate bucket ID based on budget type
    const bucketId = formData.budgetType === 'household' ? 'needs' : 'administrative'

    onSubmit({
      name: formData.name,
      budgetType: formData.budgetType,
      bucketId,
      monthlyBudget: 0,
      isFixedExpense: false,
      isActive: true,
      taxDeductibleByDefault: false,
      isIncomeCategory: true,
      excludeFromBudget: true,
      autoCategorization: [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Consulting Income, Contract Work"
          required
        />
        <p className="text-xs text-gray-500 mt-1">
          Create a custom income category to organize your income sources
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Budget Type *</label>
        <select
          value={formData.budgetType}
          onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as BudgetType })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="household">Household</option>
          <option value="business">Business</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          Add Income Category
        </button>
      </div>
    </form>
  )
}
