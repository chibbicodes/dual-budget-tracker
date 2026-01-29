import { useMemo, useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { getUpcomingDueDates, formatCurrency, getBudgetTypeColors } from '../utils/calculations'
import BudgetBadge from '../components/BudgetBadge'
import ExportButtons from '../components/ExportButtons'
import { Calendar, List, AlertTriangle, ExternalLink, Eye, CreditCard, Check } from 'lucide-react'
import { format, setDate, startOfMonth } from 'date-fns'
import { exportToCSV, exportToPDF } from '../utils/export'
import type { BudgetType, Account } from '../types'
import Modal from '../components/Modal'

// Get current month in YYYY-MM format
const getCurrentMonth = () => format(new Date(), 'yyyy-MM')

type BudgetFilter = 'all' | BudgetType
type ViewMode = 'calendar' | 'list'

export default function DueDates() {
  const { currentView, appData, updateAccount } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [viewingAccount, setViewingAccount] = useState<Account | null>(null)

  // Check if payment is marked as paid for current month
  const isPaymentMadeThisMonth = (account: Account) => {
    const currentMonth = getCurrentMonth()
    return account.lastPaymentMonth === currentMonth
  }

  // Toggle payment status for an account
  const togglePaymentStatus = (account: Account) => {
    const currentMonth = getCurrentMonth()
    const isPaid = isPaymentMadeThisMonth(account)

    updateAccount(account.id, {
      lastPaymentMonth: isPaid ? undefined : currentMonth,
    })
  }

  // Helper function to calculate next due date
  const getNextDueDate = (paymentDueDate: string) => {
    const today = new Date()
    const dayOfMonth = parseInt(paymentDueDate)

    // Get the date in the current month
    let nextDue = setDate(startOfMonth(today), dayOfMonth)

    // If that date has passed, move to next month
    if (nextDue < today) {
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
      nextDue = nextMonth
    }

    return nextDue
  }

  // Get upcoming due dates
  const upcomingDueDates = useMemo(() => {
    let accounts = appData.accounts

    // Filter by current view if not combined
    if (currentView !== 'combined') {
      accounts = accounts.filter((a) => a.budgetType === currentView)
    } else if (budgetFilter !== 'all') {
      accounts = accounts.filter((a) => a.budgetType === budgetFilter)
    }

    return getUpcomingDueDates(accounts, 30)
  }, [appData.accounts, currentView, budgetFilter])

  // Separate overdue and upcoming
  const overdueDates = upcomingDueDates.filter((item) => item.isOverdue)

  // Group by week for calendar view
  const groupedByWeek = useMemo(() => {
    const weeks: Array<typeof upcomingDueDates> = []
    const sortedDates = [...upcomingDueDates].sort((a, b) => a.daysUntilDue - b.daysUntilDue)

    let currentWeek: typeof upcomingDueDates = []
    let currentWeekStart = 0

    sortedDates.forEach((item) => {
      const weekIndex = Math.floor(item.daysUntilDue / 7)
      if (weekIndex !== currentWeekStart) {
        if (currentWeek.length > 0) {
          weeks.push(currentWeek)
        }
        currentWeek = []
        currentWeekStart = weekIndex
      }
      currentWeek.push(item)
    })

    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }

    return weeks
  }, [upcomingDueDates])

  // Export handlers
  const handleExportCSV = () => {
    const exportData = upcomingDueDates.map(item => {
      const isPaid = isPaymentMadeThisMonth(item.account)
      return {
        Account: item.account.name,
        Budget: item.account.budgetType === 'household' ? 'Household' : 'Business',
        'Due Date': format(item.dueDate, 'MM/dd/yyyy'),
        'Days Until Due': item.daysUntilDue,
        Balance: item.account.balance,
        'Credit Limit': item.account.creditLimit || 'N/A',
        'Utilization': item.account.creditLimit
          ? `${((item.account.balance / item.account.creditLimit) * 100).toFixed(1)}%`
          : 'N/A',
        'Interest Rate': item.account.interestRate ? `${item.account.interestRate}%` : 'N/A',
        'Paid This Month': isPaid ? 'Yes' : 'No',
        Status: isPaid ? 'Paid' : item.isOverdue ? 'Overdue' : 'Upcoming'
      }
    })

    const filename = `due-dates-${currentView}-${format(new Date(), 'yyyy-MM-dd')}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    const exportData = upcomingDueDates.map(item => {
      const isPaid = isPaymentMadeThisMonth(item.account)
      return {
        account: item.account.name,
        budget: item.account.budgetType === 'household' ? 'Household' : 'Business',
        dueDate: format(item.dueDate, 'MM/dd/yyyy'),
        daysUntil: item.daysUntilDue.toString(),
        balance: formatCurrency(item.account.balance),
        paid: isPaid ? 'Yes' : 'No',
        status: isPaid ? 'Paid' : item.isOverdue ? 'Overdue' : 'Upcoming'
      }
    })

    const filename = `due-dates-${currentView}-${format(new Date(), 'yyyy-MM-dd')}`
    const title = `${currentView.charAt(0).toUpperCase() + currentView.slice(1)} Payment Due Dates`

    exportToPDF(
      exportData,
      filename,
      title,
      ['Account', 'Budget', 'Due Date', 'Days Until', 'Balance', 'Paid', 'Status'],
      ['account', 'budget', 'dueDate', 'daysUntil', 'balance', 'paid', 'status']
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Payment Due Dates</h2>

        <div className="flex items-center gap-4">
          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </button>
          </div>

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

          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={upcomingDueDates.length === 0}
          />
        </div>
      </div>

      {/* Overdue payments alert */}
      {overdueDates.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-semibold text-red-800">
                {overdueDates.length} Overdue Payment{overdueDates.length !== 1 ? 's' : ''}
              </h3>
              <div className="mt-2 space-y-1">
                {overdueDates.map((item) => (
                  <div key={item.account.id} className="text-sm text-red-700">
                    <span className="font-medium">{item.account.name}</span> was due{' '}
                    {Math.abs(item.daysUntilDue)} day{Math.abs(item.daysUntilDue) !== 1 ? 's' : ''} ago
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No due dates message */}
      {upcomingDueDates.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No payment due dates set for your accounts.</p>
          <p className="text-sm text-gray-500 mt-2">
            Add payment due dates to your credit card and loan accounts to track them here.
          </p>
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && upcomingDueDates.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
                  Paid
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Next Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days Until Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Minimum Payment
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {upcomingDueDates.map((item) => {
                const minimumPayment =
                  item.account.minimumPayment ||
                  (item.account.creditLimit ? Math.abs(item.account.balance) * 0.02 : 0)
                const isPaid = isPaymentMadeThisMonth(item.account)

                return (
                  <tr
                    key={item.account.id}
                    className={isPaid ? 'bg-green-50' : item.isOverdue ? 'bg-red-50' : item.daysUntilDue <= 7 ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => togglePaymentStatus(item.account)}
                        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                          isPaid
                            ? 'bg-green-500 border-green-500 text-white'
                            : 'border-gray-300 hover:border-green-400'
                        }`}
                        title={isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        {isPaid && <Check className="h-4 w-4" />}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.isOverdue && !isPaid && <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />}
                        <span className={`text-sm font-medium ${isPaid ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.account.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <BudgetBadge budgetType={item.account.budgetType} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(getNextDueDate(item.account.paymentDueDate!), 'MMM d')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`text-sm font-medium ${
                          item.isOverdue
                            ? 'text-red-600'
                            : item.daysUntilDue <= 7
                            ? 'text-yellow-600'
                            : 'text-gray-900'
                        }`}
                      >
                        {item.isOverdue
                          ? `${Math.abs(item.daysUntilDue)} days overdue`
                          : item.daysUntilDue === 0
                          ? 'Due today'
                          : item.daysUntilDue === 1
                          ? 'Tomorrow'
                          : `${item.daysUntilDue} days`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(minimumPayment)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setViewingAccount(item.account)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View details"
                        >
                          <Eye className="h-5 w-5" />
                        </button>
                        {item.account.websiteUrl && (
                          <a
                            href={item.account.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800 inline-flex items-center gap-1"
                            title="Pay bill"
                          >
                            <CreditCard className="h-5 w-5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar view */}
      {viewMode === 'calendar' && upcomingDueDates.length > 0 && (
        <div className="space-y-6">
          {groupedByWeek.map((week, weekIndex) => {
            const firstItem = week[0]
            const weekStart = firstItem.daysUntilDue
            const weekEnd = weekStart + 6

            return (
              <div key={weekIndex} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {weekIndex === 0 && weekStart <= 7
                      ? 'This Week'
                      : weekIndex === 1 && weekStart <= 14
                      ? 'Next Week'
                      : `Days ${weekStart}-${weekEnd}`}
                  </h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {week.map((item) => {
                    const colors = getBudgetTypeColors(item.account.budgetType)
                    const minimumPayment =
                      item.account.minimumPayment ||
                      (item.account.creditLimit ? Math.abs(item.account.balance) * 0.02 : 0)
                    const isPaid = isPaymentMadeThisMonth(item.account)

                    return (
                      <div
                        key={item.account.id}
                        className={`px-6 py-4 ${
                          isPaid ? 'bg-green-50' : item.isOverdue ? 'bg-red-50' : item.daysUntilDue <= 7 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <button
                              onClick={() => togglePaymentStatus(item.account)}
                              className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                isPaid
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                              title={isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                            >
                              {isPaid && <Check className="h-4 w-4" />}
                            </button>
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                {item.isOverdue && !isPaid && <AlertTriangle className="h-5 w-5 text-red-600" />}
                                <h4 className={`text-base font-semibold ${isPaid ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{item.account.name}</h4>
                                <BudgetBadge budgetType={item.account.budgetType} />
                                {isPaid && <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded">Paid</span>}
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Due:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    Day {item.account.paymentDueDate}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Days:</span>{' '}
                                  <span
                                    className={`font-medium ${
                                      isPaid
                                        ? 'text-green-600'
                                        : item.isOverdue
                                        ? 'text-red-600'
                                        : item.daysUntilDue <= 7
                                        ? 'text-yellow-600'
                                        : 'text-gray-900'
                                    }`}
                                  >
                                    {isPaid
                                      ? 'Paid'
                                      : item.isOverdue
                                      ? `${Math.abs(item.daysUntilDue)} overdue`
                                      : item.daysUntilDue === 0
                                      ? 'Due today'
                                      : item.daysUntilDue}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Min Payment:</span>{' '}
                                  <span className="font-medium text-gray-900">
                                    {formatCurrency(minimumPayment)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {item.account.websiteUrl && !isPaid && (
                            <a
                              href={item.account.websiteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md ${colors.bg} text-white hover:opacity-90 transition-opacity`}
                            >
                              Pay Bill
                              <CreditCard className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Account Details Modal */}
      {viewingAccount && (
        <Modal
          isOpen={true}
          onClose={() => setViewingAccount(null)}
          title="Account Details"
          size="md"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Account Name</label>
              <p className="text-base font-semibold text-gray-900">{viewingAccount.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Account Type</label>
                <p className="text-base text-gray-900 capitalize">
                  {viewingAccount.accountType.replace('_', ' ')}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Budget Type</label>
                <div className="mt-1">
                  <BudgetBadge budgetType={viewingAccount.budgetType} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500">Current Balance</label>
              <p
                className={`text-xl font-bold ${
                  viewingAccount.balance >= 0 ? 'text-gray-900' : 'text-red-600'
                }`}
              >
                {formatCurrency(viewingAccount.balance)}
              </p>
            </div>

            {viewingAccount.creditLimit && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Credit Limit</label>
                  <p className="text-base text-gray-900">{formatCurrency(viewingAccount.creditLimit)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Available Credit</label>
                  <p className="text-base text-gray-900">
                    {formatCurrency(viewingAccount.availableCredit || 0)}
                  </p>
                </div>
              </div>
            )}

            {viewingAccount.paymentDueDate && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Next Due Date</label>
                  <p className="text-base text-gray-900">
                    {format(getNextDueDate(viewingAccount.paymentDueDate), 'MMM d, yyyy')}
                  </p>
                </div>
                {viewingAccount.minimumPayment && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Minimum Payment</label>
                    <p className="text-base text-gray-900">
                      {formatCurrency(viewingAccount.minimumPayment)}
                    </p>
                  </div>
                )}
              </div>
            )}

            {viewingAccount.interestRate && (
              <div>
                <label className="text-sm font-medium text-gray-500">Interest Rate (APR)</label>
                <p className="text-base text-gray-900">{viewingAccount.interestRate.toFixed(2)}%</p>
              </div>
            )}

            {viewingAccount.websiteUrl && (
              <div>
                <label className="text-sm font-medium text-gray-500">Bill Pay Website</label>
                <a
                  href={viewingAccount.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 mt-1"
                >
                  {viewingAccount.websiteUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {viewingAccount.notes && (
              <div>
                <label className="text-sm font-medium text-gray-500">Notes</label>
                <p className="text-sm text-gray-700 mt-1">{viewingAccount.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                onClick={() => setViewingAccount(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
