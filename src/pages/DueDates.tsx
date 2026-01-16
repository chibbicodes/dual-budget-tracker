import { useMemo, useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { getUpcomingDueDates, formatCurrency, getBudgetTypeColors } from '../utils/calculations'
import BudgetBadge from '../components/BudgetBadge'
import { Calendar, List, AlertTriangle, ExternalLink } from 'lucide-react'
import type { BudgetType } from '../types'

type BudgetFilter = 'all' | BudgetType
type ViewMode = 'calendar' | 'list'

export default function DueDates() {
  const { currentView, appData } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Budget
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
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
                const colors = getBudgetTypeColors(item.account.budgetType)
                const minimumPayment =
                  item.account.minimumPayment ||
                  (item.account.creditLimit ? Math.abs(item.account.balance) * 0.02 : 0)

                return (
                  <tr
                    key={item.account.id}
                    className={item.isOverdue ? 'bg-red-50' : item.daysUntilDue <= 7 ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {item.isOverdue && <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />}
                        <span className="text-sm font-medium text-gray-900">{item.account.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <BudgetBadge budgetType={item.account.budgetType} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Day {item.account.paymentDueDate}
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
                      {item.account.billPayWebsite && (
                        <a
                          href={item.account.billPayWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 ${colors.text} hover:underline`}
                        >
                          Pay Bill
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
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

                    return (
                      <div
                        key={item.account.id}
                        className={`px-6 py-4 ${
                          item.isOverdue ? 'bg-red-50' : item.daysUntilDue <= 7 ? 'bg-yellow-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {item.isOverdue && <AlertTriangle className="h-5 w-5 text-red-600" />}
                              <h4 className="text-base font-semibold text-gray-900">{item.account.name}</h4>
                              <BudgetBadge budgetType={item.account.budgetType} />
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
                                    item.isOverdue
                                      ? 'text-red-600'
                                      : item.daysUntilDue <= 7
                                      ? 'text-yellow-600'
                                      : 'text-gray-900'
                                  }`}
                                >
                                  {item.isOverdue
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
                          {item.account.billPayWebsite && (
                            <a
                              href={item.account.billPayWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md ${colors.bg} text-white hover:opacity-90 transition-opacity`}
                            >
                              Pay Bill
                              <ExternalLink className="h-4 w-4" />
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
    </div>
  )
}
