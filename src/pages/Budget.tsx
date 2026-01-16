import { useBudget } from '../contexts/BudgetContext'
import { useMemo, useState } from 'react'
import {calculateBudgetSummary, formatCurrency } from '../utils/calculations'
import { getAllBuckets } from '../data/defaultCategories'
import { Edit, Check, X, AlertCircle, Plus, Trash2, Settings2 } from 'lucide-react'
import type { BudgetType, Category, BucketId } from '../types'
import Modal from '../components/Modal'

export default function Budget() {
  const { currentView, appData, updateCategory, addCategory, deleteCategory } = useBudget()
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

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

  const handleOpenEditModal = (category: Category) => {
    setSelectedCategory(category)
    setIsEditModalOpen(true)
  }

  const handleDeleteCategory = (categoryId: string) => {
    if (confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      deleteCategory(categoryId)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {budgetType === 'household' ? 'Household' : 'Business'} Budget
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your monthly budget by category
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Category
        </button>
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
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() =>
                                    handleStartEdit(category.id, category.monthlyBudget)
                                  }
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Quick edit budget amount"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(category)}
                                  className="text-gray-600 hover:text-gray-800"
                                  title="Edit category details"
                                >
                                  <Settings2 className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(category.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Delete category"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
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
          <strong>Tip:</strong> Click the <Edit className="inline h-4 w-4" /> icon for quick budget edits,
          <Settings2 className="inline h-4 w-4 mx-1" /> icon to edit full category details, or the
          <Trash2 className="inline h-4 w-4 mx-1" /> icon to delete categories.
        </p>
      </div>

      {/* Add Category Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Category"
      >
        <CategoryForm
          budgetType={budgetType}
          buckets={buckets}
          onSubmit={(data) => {
            addCategory(data)
            setIsAddModalOpen(false)
          }}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedCategory(null)
        }}
        title="Edit Category"
      >
        {selectedCategory && (
          <CategoryForm
            budgetType={budgetType}
            buckets={buckets}
            category={selectedCategory}
            onSubmit={(data) => {
              updateCategory(selectedCategory.id, data)
              setIsEditModalOpen(false)
              setSelectedCategory(null)
            }}
            onCancel={() => {
              setIsEditModalOpen(false)
              setSelectedCategory(null)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

// Category Form Component
interface CategoryFormProps {
  budgetType: BudgetType
  buckets: Array<{ id: BucketId; name: string }>
  category?: Category
  onSubmit: (data: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function CategoryForm({ budgetType, buckets, category, onSubmit, onCancel }: CategoryFormProps) {
  const [formData, setFormData] = useState({
    name: category?.name || '',
    bucketId: category?.bucketId || buckets[0]?.id || '',
    monthlyBudget: category?.monthlyBudget?.toString() || '0',
    isFixedExpense: category?.isFixedExpense || false,
    taxDeductibleByDefault: category?.taxDeductibleByDefault || false,
    isActive: category?.isActive ?? true,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: formData.name,
      budgetType,
      bucketId: formData.bucketId as BucketId,
      monthlyBudget: parseFloat(formData.monthlyBudget) || 0,
      isFixedExpense: formData.isFixedExpense,
      isActive: formData.isActive,
      taxDeductibleByDefault: formData.taxDeductibleByDefault,
      icon: '',
      autoCategorization: category?.autoCategorization || [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category Name *
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Groceries, Office Supplies"
          required
        />
      </div>

      {/* Bucket Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bucket *
        </label>
        <select
          value={formData.bucketId}
          onChange={(e) => setFormData({ ...formData, bucketId: e.target.value as BucketId })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          {buckets.map((bucket) => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.name}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly Budget */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Monthly Budget *
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.monthlyBudget}
          onChange={(e) => setFormData({ ...formData, monthlyBudget: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="0.00"
          required
        />
      </div>

      {/* Checkboxes */}
      <div className="space-y-2">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isFixedExpense}
            onChange={(e) => setFormData({ ...formData, isFixedExpense: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Fixed Expense (amount doesn't vary month to month)
          </span>
        </label>

        {budgetType === 'business' && (
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.taxDeductibleByDefault}
              onChange={(e) =>
                setFormData({ ...formData, taxDeductibleByDefault: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <span className="ml-2 text-sm text-gray-700">
              Tax Deductible by Default
            </span>
          </label>
        )}

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Active (show in budget and transaction forms)
          </span>
        </label>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {category ? 'Save Changes' : 'Add Category'}
        </button>
      </div>
    </form>
  )
}
