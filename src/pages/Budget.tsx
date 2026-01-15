import { useBudget } from '../contexts/BudgetContext'
import { useMemo, useState } from 'react'
import {calculateBudgetSummary, formatCurrency } from '../utils/calculations'
import { getAllBuckets } from '../data/defaultCategories'
import { Edit, Check, X, AlertCircle } from 'lucide-react'
import type { BudgetType } from '../types'

export default function Budget() {
  const { currentView, appData, updateCategory } = useBudget()
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  // Budget page doesn't support combined view
  if (currentView === 'combined') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Budget</h1>
          <p className="text-gray-600 mt-2">
            Please select a specific budget (Household or Business) to view and manage budgets
          </p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">
                Combined View Not Available
              </h3>
              <p className="text-yellow-700 mt-2">
                Budget planning must be done separately for Household and Business budgets.
                Use the budget selector above to switch to a specific budget.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const budgetType = currentView as BudgetType

  // Calculate budget summary
  const budgetSummary = useMemo(
    () => calculateBudgetSummary(appData.transactions, appData.categories, budgetType),
    [appData.transactions, appData.categories, budgetType]
  )

  // Get buckets for this budget type
  const buckets = useMemo(() => {
    const allBuckets = getAllBuckets()
    return budgetType === 'household' ? allBuckets.household : allBuckets.business
  }, [budgetType])

  // Calculate total budgeted amount
  const totalBudgeted = useMemo(() => {
    return appData.categories
      .filter((c) => c.budgetType === budgetType)
      .reduce((sum, c) => sum + c.monthlyBudget, 0)
  }, [appData.categories, budgetType])

  const handleStartEdit = (categoryId: string, currentBudget: number) => {
    setEditingCategory(categoryId)
    setEditValue(currentBudget.toString())
  }

  const handleSaveEdit = (categoryId: string) => {
    const newBudget = parseFloat(editValue)
    if (!isNaN(newBudget) && newBudget >= 0) {
      updateCategory(categoryId, { monthlyBudget: newBudget })
    }
    setEditingCategory(null)
    setEditValue('')
  }

  const handleCancelEdit = () => {
    setEditingCategory(null)
    setEditValue('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {budgetType === 'household' ? 'Household' : 'Business'} Budget
        </h1>
        <p className="text-gray-600 mt-2">
          Manage your monthly budget by category
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Income</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(budgetSummary.totalIncome)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Budgeted</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            {formatCurrency(totalBudgeted)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Actual Spent</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(budgetSummary.totalExpenses)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Remaining</p>
          <p
            className={`text-2xl font-bold mt-2 ${
              budgetSummary.remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(budgetSummary.remainingBudget)}
          </p>
        </div>
      </div>

      {/* Bucket Breakdown */}
      {budgetSummary.bucketBreakdown.map((bucket) => {
        const bucketInfo = buckets.find((b) => b.id === bucket.bucketId)
        const categoriesInBucket = appData.categories.filter(
          (c) => c.budgetType === budgetType && c.bucketId === bucket.bucketId && c.isActive
        )

        return (
          <div key={bucket.bucketId} className="bg-white rounded-lg shadow overflow-hidden">
            {/* Bucket Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{bucket.bucketName}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Target: {bucketInfo?.targetPercentage || 0}% of income ({formatCurrency(bucket.targetAmount)})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">
                    {formatCurrency(bucket.actualAmount)} spent
                  </p>
                  <p
                    className={`text-lg font-bold ${
                      bucket.overUnder >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {bucket.overUnder >= 0 ? 'Under' : 'Over'} by {formatCurrency(Math.abs(bucket.overUnder))}
                  </p>
                </div>
              </div>

              {/* Bucket Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>{bucket.percentOfIncome.toFixed(1)}% of income</span>
                  <span>
                    {bucket.targetAmount > 0
                      ? ((bucket.actualAmount / bucket.targetAmount) * 100).toFixed(1)
                      : 0}
                    % of target
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      bucket.actualAmount > bucket.targetAmount
                        ? 'bg-red-500'
                        : budgetType === 'household'
                        ? 'bg-blue-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(
                        (bucket.actualAmount / bucket.targetAmount) * 100,
                        100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Category List */}
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
                      Progress
                    </th>
                    <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoriesInBucket.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        No active categories in this bucket
                      </td>
                    </tr>
                  ) : (
                    categoriesInBucket.map((category) => {
                      const categoryBreakdown = bucket.categories.find(
                        (c) => c.categoryId === category.id
                      )

                      const budgeted = category.monthlyBudget
                      const actual = categoryBreakdown?.actual || 0
                      const remaining = budgeted - actual
                      const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0

                      return (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="py-4">
                            <div className="flex items-center">
                              <div>
                                <p className="font-medium text-gray-900">{category.name}</p>
                                {category.isFixedExpense && (
                                  <span className="text-xs text-blue-600">Fixed</span>
                                )}
                                {category.taxDeductibleByDefault && (
                                  <span className="text-xs text-green-600 ml-2">Tax Deductible</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            {editingCategory === category.id ? (
                              <div className="flex items-center justify-end">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveEdit(category.id)
                                    } else if (e.key === 'Escape') {
                                      handleCancelEdit()
                                    }
                                  }}
                                />
                              </div>
                            ) : (
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(budgeted)}
                              </p>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <p className="text-sm text-red-600">
                              {formatCurrency(actual)}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            <p
                              className={`text-sm font-medium ${
                                remaining >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {formatCurrency(remaining)}
                            </p>
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    percentUsed > 100
                                      ? 'bg-red-500'
                                      : percentUsed > 90
                                      ? 'bg-yellow-500'
                                      : 'bg-green-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(percentUsed, 100)}%`,
                                  }}
                                />
                              </div>
                              <span
                                className={`text-xs font-medium ${
                                  percentUsed > 100
                                    ? 'text-red-600'
                                    : percentUsed > 90
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                                }`}
                              >
                                {percentUsed.toFixed(0)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-right">
                            {editingCategory === category.id ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => handleSaveEdit(category.id)}
                                  className="text-green-600 hover:text-green-800"
                                  title="Save"
                                >
                                  <Check className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-red-600 hover:text-red-800"
                                  title="Cancel"
                                >
                                  <X className="w-5 h-5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() =>
                                  handleStartEdit(category.id, category.monthlyBudget)
                                }
                                className="text-blue-600 hover:text-blue-800"
                                title="Edit budget"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Click the edit icon next to any budget amount to adjust it.
          Your changes are saved automatically. Hover over any amount to see the exact value.
        </p>
      </div>
    </div>
  )
}
