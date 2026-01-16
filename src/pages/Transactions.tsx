import { useBudget } from '../contexts/BudgetContext'
import { useState, useMemo } from 'react'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import {
  Plus,
  Edit,
  Trash2,
  Search,
  Filter,
  CheckCircle,
} from 'lucide-react'
import { formatCurrency } from '../utils/calculations'
import { format } from 'date-fns'
import type { Transaction, BudgetType, Account } from '../types'

type BudgetFilter = 'household' | 'business' | 'all'

export default function Transactions() {
  const {
    currentView,
    appData,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useBudget()

  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [accountFilter, setAccountFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchText, setSearchText] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let transactions = appData.transactions

    // Filter by current view
    if (currentView !== 'combined') {
      transactions = transactions.filter((t) => t.budgetType === currentView)
    }

    // Apply budget filter
    if (budgetFilter !== 'all') {
      transactions = transactions.filter((t) => t.budgetType === budgetFilter)
    }

    // Apply account filter
    if (accountFilter !== 'all') {
      transactions = transactions.filter((t) => t.accountId === accountFilter)
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      transactions = transactions.filter((t) => t.categoryId === categoryFilter)
    }

    // Apply date range filter
    if (startDate) {
      transactions = transactions.filter((t) => t.date >= startDate)
    }
    if (endDate) {
      transactions = transactions.filter((t) => t.date <= endDate)
    }

    // Apply search filter
    if (searchText) {
      const search = searchText.toLowerCase()
      transactions = transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(search) ||
          t.notes?.toLowerCase().includes(search)
      )
    }

    // Sort by date (newest first)
    return transactions.sort((a, b) => b.date.localeCompare(a.date))
  }, [
    appData.transactions,
    currentView,
    budgetFilter,
    accountFilter,
    categoryFilter,
    startDate,
    endDate,
    searchText,
  ])

  // Get filtered accounts for dropdown
  const availableAccounts = useMemo(() => {
    let accounts = appData.accounts
    if (currentView !== 'combined') {
      accounts = accounts.filter((a) => a.budgetType === currentView)
    }
    if (budgetFilter !== 'all') {
      accounts = accounts.filter((a) => a.budgetType === budgetFilter)
    }
    return accounts
  }, [appData.accounts, currentView, budgetFilter])

  // Get filtered categories for dropdown
  const availableCategories = useMemo(() => {
    let categories = appData.categories
    if (currentView !== 'combined') {
      categories = categories.filter((c) => c.budgetType === currentView)
    }
    if (budgetFilter !== 'all') {
      categories = categories.filter((c) => c.budgetType === budgetFilter)
    }
    return categories.filter((c) => c.isActive)
  }, [appData.categories, currentView, budgetFilter])

  const handleAddTransaction = (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
    addTransaction(transaction)
    setIsAddModalOpen(false)
  }

  const handleEditTransaction = (updates: Partial<Transaction>) => {
    if (selectedTransaction) {
      updateTransaction(selectedTransaction.id, updates)
      setIsEditModalOpen(false)
      setSelectedTransaction(null)
    }
  }

  const handleDeleteTransaction = (id: string) => {
    if (confirm('Are you sure you want to delete this transaction?')) {
      deleteTransaction(id)
    }
  }

  const openEditModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsEditModalOpen(true)
  }

  const clearFilters = () => {
    setBudgetFilter('all')
    setAccountFilter('all')
    setCategoryFilter('all')
    setSearchText('')
    setStartDate('')
    setEndDate('')
  }

  // Calculate totals
  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)
    const expenses = Math.abs(
      filteredTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )
    return { income, expenses, net: income - expenses }
  }, [filteredTransactions])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          <p className="text-gray-600 mt-2">
            {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Transaction
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Income</p>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {formatCurrency(totals.income)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600 mt-2">
            {formatCurrency(totals.expenses)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-600">Net</p>
          <p
            className={`text-2xl font-bold mt-2 ${
              totals.net >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(totals.net)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            Clear All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Budget Type Filter */}
          {currentView === 'combined' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget Type
              </label>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value as BudgetFilter)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="household">Household</option>
                <option value="business">Business</option>
              </select>
            </div>
          )}

          {/* Account Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Account
            </label>
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Accounts</option>
              {availableAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Categories</option>
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-lg">No transactions found.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first transaction
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const account = appData.accounts.find((a) => a.id === transaction.accountId)
                  const category = appData.categories.find((c) => c.id === transaction.categoryId)

                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {format(new Date(transaction.date), 'MMM d, yyyy')}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {transaction.description}
                        </p>
                        {transaction.notes && (
                          <p className="text-xs text-gray-500 mt-1">
                            {transaction.notes}
                          </p>
                        )}
                        {transaction.taxDeductible && (
                          <div className="flex items-center mt-1">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                            <span className="text-xs text-green-600">Tax Deductible</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {account?.name || 'Unknown'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {category?.name || 'Uncategorized'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <BudgetBadge budgetType={transaction.budgetType} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <p
                          className={`text-sm font-medium ${
                            transaction.amount >= 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {transaction.amount >= 0 ? '+' : ''}
                          {formatCurrency(transaction.amount)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openEditModal(transaction)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit transaction"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Transaction Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Transaction"
        size="lg"
      >
        <TransactionForm
          accounts={appData.accounts}
          categories={appData.categories}
          onSubmit={handleAddTransaction}
          onCancel={() => setIsAddModalOpen(false)}
          defaultBudgetType={
            currentView !== 'combined' ? (currentView as BudgetType) : 'household'
          }
        />
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedTransaction(null)
        }}
        title="Edit Transaction"
        size="lg"
      >
        {selectedTransaction && (
          <TransactionForm
            transaction={selectedTransaction}
            accounts={appData.accounts}
            categories={appData.categories}
            onSubmit={handleEditTransaction}
            onCancel={() => {
              setIsEditModalOpen(false)
              setSelectedTransaction(null)
            }}
            defaultBudgetType={selectedTransaction.budgetType}
          />
        )}
      </Modal>
    </div>
  )
}

// Transaction Form Component
interface TransactionFormProps {
  transaction?: Transaction
  accounts: Account[]
  categories: any[]
  onSubmit: (transaction: any) => void
  onCancel: () => void
  defaultBudgetType: BudgetType
}

function TransactionForm({
  transaction,
  accounts,
  categories,
  onSubmit,
  onCancel,
  defaultBudgetType,
}: TransactionFormProps) {
  const [formData, setFormData] = useState({
    date: transaction?.date || new Date().toISOString().split('T')[0],
    description: transaction?.description || '',
    amount: transaction?.amount ? Math.abs(transaction.amount).toString() : '',
    transactionType: transaction?.toAccountId ? 'transfer' : transaction?.amount ? (transaction.amount >= 0 ? 'income' : 'expense') : 'expense',
    accountId: transaction?.accountId || '',
    toAccountId: transaction?.toAccountId || '',
    categoryId: transaction?.categoryId || '',
    budgetType: transaction?.budgetType || defaultBudgetType,
    taxDeductible: transaction?.taxDeductible || false,
    notes: transaction?.notes || '',
  })

  // Filter accounts and categories based on selected budget type
  const filteredAccounts = accounts.filter(
    (a) => a.budgetType === formData.budgetType
  )

  const filteredCategories = categories.filter((c) => {
    if (c.budgetType !== formData.budgetType || !c.isActive) return false

    // Show only income categories for income transactions
    if (formData.transactionType === 'income') {
      return c.isIncomeCategory === true
    }

    // For transfers and expenses, show all non-income categories (including Transfer/Payment)
    return !c.isIncomeCategory
  })

  // When budget type changes, reset account and category if they don't match
  const handleBudgetTypeChange = (newBudgetType: BudgetType) => {
    const accountMatches = accounts.find(
      (a) => a.id === formData.accountId && a.budgetType === newBudgetType
    )
    const categoryMatches = categories.find(
      (c) => c.id === formData.categoryId && c.budgetType === newBudgetType
    )

    setFormData({
      ...formData,
      budgetType: newBudgetType,
      accountId: accountMatches ? formData.accountId : '',
      categoryId: categoryMatches ? formData.categoryId : '',
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(formData.amount) || 0
    let signedAmount = amount

    if (formData.transactionType === 'income') {
      signedAmount = Math.abs(amount)
    } else if (formData.transactionType === 'expense') {
      signedAmount = -Math.abs(amount)
    } else if (formData.transactionType === 'transfer') {
      signedAmount = -Math.abs(amount) // Deduct from source account
    }

    const transactionData: any = {
      date: formData.date,
      description: formData.description,
      amount: signedAmount,
      accountId: formData.accountId,
      categoryId: formData.categoryId || 'uncategorized',
      budgetType: formData.budgetType,
      taxDeductible: formData.taxDeductible,
      notes: formData.notes || undefined,
    }

    // Add toAccountId for transfers
    if (formData.transactionType === 'transfer' && formData.toAccountId) {
      transactionData.toAccountId = formData.toAccountId
    }

    onSubmit(transactionData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date *
          </label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Transaction Type & Amount */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transaction Type *
          </label>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="expense"
                checked={formData.transactionType === 'expense'}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', toAccountId: '' })}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Expense
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="income"
                checked={formData.transactionType === 'income'}
                onChange={(e) => setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', toAccountId: '' })}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Income
              </span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="transactionType"
                value="transfer"
                checked={formData.transactionType === 'transfer'}
                onChange={(e) => {
                  const transferCategory = filteredCategories.find(c => c.name === 'Transfer/Payment')
                  setFormData({ ...formData, transactionType: e.target.value as 'income' | 'expense' | 'transfer', categoryId: transferCategory?.id || '' })
                }}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">
                Transfer/Payment
              </span>
            </label>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Amount *
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Budget Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Budget Type *
          </label>
          <select
            required
            value={formData.budgetType}
            onChange={(e) => handleBudgetTypeChange(e.target.value as BudgetType)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="household">Household</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {formData.transactionType === 'transfer' ? 'From Account *' : 'Account *'}
          </label>
          <select
            required
            value={formData.accountId}
            onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select account...</option>
            {filteredAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        {/* To Account (for transfers only) */}
        {formData.transactionType === 'transfer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Account *
            </label>
            <select
              required
              value={formData.toAccountId}
              onChange={(e) => setFormData({ ...formData, toAccountId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select destination account...</option>
              {filteredAccounts
                .filter((account) => account.id !== formData.accountId)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Category
          </label>
          <select
            value={formData.categoryId}
            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Auto-categorize</option>
            {filteredCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {formData.transactionType === 'transfer' && (
            <p className="text-xs text-gray-500 mt-1">
              Select "Transfer/Payment" to exclude from budget, or choose a regular category to include in budget
            </p>
          )}
        </div>

        {/* Tax Deductible */}
        {formData.budgetType === 'business' && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="taxDeductible"
              checked={formData.taxDeductible}
              onChange={(e) =>
                setFormData({ ...formData, taxDeductible: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="taxDeductible"
              className="ml-2 text-sm font-medium text-gray-700"
            >
              Tax Deductible
            </label>
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description *
        </label>
        <input
          type="text"
          required
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="e.g., Grocery shopping at Walmart"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional notes..."
        />
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {transaction ? 'Update Transaction' : 'Add Transaction'}
        </button>
      </div>
    </form>
  )
}
