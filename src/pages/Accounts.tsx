import { useBudget } from '../contexts/BudgetContext'
import { useState, useMemo } from 'react'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import ExportButtons from '../components/ExportButtons'
import {
  Plus,
  Edit,
  Trash2,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'
import {
  formatCurrency,
  getCreditUtilizationColor,
} from '../utils/calculations'
import { exportToCSV, exportToPDF } from '../utils/export'
import type { Account, AccountType, BudgetType } from '../types'

type BudgetFilter = 'household' | 'business' | 'all'

export default function Accounts() {
  const { currentView, appData, addAccount, updateAccount, deleteAccount } =
    useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)

  // Filter accounts based on current view and budget filter
  const filteredAccounts = useMemo(() => {
    let accounts = appData.accounts

    // If viewing single budget, filter to that budget
    if (currentView !== 'combined') {
      accounts = accounts.filter((a) => a.budgetType === currentView)
    }

    // Apply additional filter if set
    if (budgetFilter !== 'all') {
      accounts = accounts.filter((a) => a.budgetType === budgetFilter)
    }

    return accounts.sort((a, b) => a.name.localeCompare(b.name))
  }, [appData.accounts, currentView, budgetFilter])

  const handleAddAccount = (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
    addAccount(account)
    setIsAddModalOpen(false)
  }

  const handleEditAccount = (updates: Partial<Account>) => {
    if (selectedAccount) {
      updateAccount(selectedAccount.id, updates)
      setIsEditModalOpen(false)
      setSelectedAccount(null)
    }
  }

  const handleDeleteAccount = (id: string) => {
    if (confirm('Are you sure you want to delete this account? All associated transactions will also be deleted.')) {
      deleteAccount(id)
    }
  }

  const openEditModal = (account: Account) => {
    setSelectedAccount(account)
    setIsEditModalOpen(true)
  }

  // Export handlers
  const handleExportCSV = () => {
    const exportData = filteredAccounts.map(account => ({
      Name: account.name,
      Type: account.accountType,
      Budget: account.budgetType === 'household' ? 'Household' : 'Business',
      Balance: account.balance,
      'Credit Limit': account.creditLimit || '',
      'Credit Utilization': account.creditLimit
        ? `${((Math.abs(account.balance) / account.creditLimit) * 100).toFixed(1)}%`
        : '',
      'Interest Rate': account.interestRate ? `${account.interestRate}%` : '',
      'Due Date': account.paymentDueDate || '',
      Notes: account.notes || ''
    }))

    const filename = `accounts-${currentView}-${new Date().toISOString().split('T')[0]}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    const exportData = filteredAccounts.map(account => ({
      name: account.name,
      type: account.accountType,
      budget: account.budgetType === 'household' ? 'Household' : 'Business',
      balance: formatCurrency(account.balance),
      creditLimit: account.creditLimit ? formatCurrency(account.creditLimit) : 'N/A',
      utilization: account.creditLimit
        ? `${((Math.abs(account.balance) / account.creditLimit) * 100).toFixed(1)}%`
        : 'N/A'
    }))

    const filename = `accounts-${currentView}-${new Date().toISOString().split('T')[0]}`
    const title = `${currentView.charAt(0).toUpperCase() + currentView.slice(1)} Accounts`

    exportToPDF(
      exportData,
      filename,
      title,
      ['Name', 'Type', 'Budget', 'Balance', 'Credit Limit', 'Utilization'],
      ['name', 'type', 'budget', 'balance', 'creditLimit', 'utilization']
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Accounts</h1>
          <p className="text-gray-600 mt-2">Manage your financial accounts</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={filteredAccounts.length === 0}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Account
          </button>
        </div>
      </div>

      {/* Filters */}
      {currentView === 'combined' && (
        <div className="flex items-center space-x-4 bg-white rounded-lg shadow p-4">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setBudgetFilter('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                budgetFilter === 'all'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setBudgetFilter('household')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                budgetFilter === 'household'
                  ? 'bg-blue-500 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Household
            </button>
            <button
              onClick={() => setBudgetFilter('business')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                budgetFilter === 'business'
                  ? 'bg-green-500 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Business
            </button>
          </div>
        </div>
      )}

      {/* Accounts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {filteredAccounts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-lg">No accounts found.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
            >
              Add your first account
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest Rate
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit Limit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilization
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <p className="font-medium text-gray-900">
                            {account.name}
                          </p>
                          {account.websiteUrl && (
                            <a
                              href={account.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center mt-1"
                            >
                              Bill Pay <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <BudgetBadge budgetType={account.budgetType} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 capitalize">
                        {account.accountType.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p
                        className={`font-medium ${
                          account.balance >= 0
                            ? 'text-gray-900'
                            : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(account.balance)}
                      </p>
                      {account.availableCredit !== undefined && (
                        <p className="text-xs text-gray-500 mt-1">
                          {formatCurrency(account.availableCredit)} available
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-600">
                        {account.interestRate
                          ? `${account.interestRate.toFixed(2)}%`
                          : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm text-gray-600">
                        {account.creditLimit
                          ? formatCurrency(account.creditLimit)
                          : '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {account.creditUtilization !== undefined ? (
                        <div className="flex items-center justify-end">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCreditUtilizationColor(
                              account.creditUtilization
                            )}`}
                          >
                            {account.creditUtilization.toFixed(1)}%
                          </span>
                          {account.creditUtilization >= 50 && (
                            <AlertTriangle className="w-4 h-4 ml-2 text-red-500" />
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(account)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit account"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete account"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Account Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Account"
        size="lg"
      >
        <AccountForm
          onSubmit={handleAddAccount}
          onCancel={() => setIsAddModalOpen(false)}
          defaultBudgetType={currentView !== 'combined' ? (currentView as BudgetType) : 'household'}
        />
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedAccount(null)
        }}
        title="Edit Account"
        size="lg"
      >
        {selectedAccount && (
          <AccountForm
            account={selectedAccount}
            onSubmit={handleEditAccount}
            onCancel={() => {
              setIsEditModalOpen(false)
              setSelectedAccount(null)
            }}
            defaultBudgetType={selectedAccount.budgetType}
          />
        )}
      </Modal>
    </div>
  )
}

// Account Form Component
interface AccountFormProps {
  account?: Account
  onSubmit: (account: any) => void
  onCancel: () => void
  defaultBudgetType: BudgetType
}

function AccountForm({
  account,
  onSubmit,
  onCancel,
  defaultBudgetType,
}: AccountFormProps) {
  const [formData, setFormData] = useState({
    name: account?.name || '',
    budgetType: account?.budgetType || defaultBudgetType,
    accountType: account?.accountType || ('checking' as AccountType),
    balance: account?.balance.toString() || '0',
    interestRate: account?.interestRate?.toString() || '',
    creditLimit: account?.creditLimit?.toString() || '',
    paymentDueDate: account?.paymentDueDate || '',
    minimumPayment: account?.minimumPayment?.toString() || '',
    websiteUrl: account?.websiteUrl || '',
    notes: account?.notes || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    let balance = parseFloat(formData.balance) || 0

    // Automatically make balance negative for credit cards and loans
    if ((formData.accountType === 'credit_card' || formData.accountType === 'loan') && balance > 0) {
      balance = -balance
    }

    const accountData = {
      name: formData.name,
      budgetType: formData.budgetType,
      accountType: formData.accountType,
      balance: balance,
      interestRate: formData.interestRate ? parseFloat(formData.interestRate) : undefined,
      creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : undefined,
      paymentDueDate: formData.paymentDueDate || undefined,
      minimumPayment: formData.minimumPayment ? parseFloat(formData.minimumPayment) : undefined,
      websiteUrl: formData.websiteUrl || undefined,
      notes: formData.notes || undefined,
    }

    onSubmit(accountData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Chase Checking"
          />
        </div>

        {/* Budget Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Budget Type *
          </label>
          <select
            required
            value={formData.budgetType}
            onChange={(e) =>
              setFormData({ ...formData, budgetType: e.target.value as BudgetType })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="household">Household</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Account Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Account Type *
          </label>
          <select
            required
            value={formData.accountType}
            onChange={(e) =>
              setFormData({ ...formData, accountType: e.target.value as AccountType })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="checking">Checking</option>
            <option value="savings">Savings</option>
            <option value="credit_card">Credit Card</option>
            <option value="loan">Loan</option>
            <option value="investment">Investment</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Balance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Balance *
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={formData.balance}
            onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        {/* Interest Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interest Rate (APR %)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.interestRate}
            onChange={(e) =>
              setFormData({ ...formData, interestRate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        {/* Credit Limit */}
        {formData.accountType === 'credit_card' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Credit Limit
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.creditLimit}
              onChange={(e) =>
                setFormData({ ...formData, creditLimit: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        )}

        {/* Payment Due Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Due Date (Day of Month)
          </label>
          <input
            type="number"
            min="1"
            max="31"
            value={formData.paymentDueDate}
            onChange={(e) =>
              setFormData({ ...formData, paymentDueDate: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., 15"
          />
        </div>

        {/* Minimum Payment */}
        {formData.accountType === 'credit_card' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Payment
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.minimumPayment}
              onChange={(e) =>
                setFormData({ ...formData, minimumPayment: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      {/* Website URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Bill Pay Website URL
        </label>
        <input
          type="url"
          value={formData.websiteUrl}
          onChange={(e) =>
            setFormData({ ...formData, websiteUrl: e.target.value })
          }
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://..."
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Optional notes about this account..."
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
          {account ? 'Update Account' : 'Add Account'}
        </button>
      </div>
    </form>
  )
}
