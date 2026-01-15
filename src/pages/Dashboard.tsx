import { useBudget } from '../contexts/BudgetContext'
import { useMemo } from 'react'
import SummaryCard from '../components/SummaryCard'
import BudgetBadge from '../components/BudgetBadge'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
} from 'lucide-react'
import {
  calculateAccountSummary,
  calculateBudgetSummary,
  getTopSpendingCategories,
  formatCurrency,
  getCreditUtilizationColor,
} from '../utils/calculations'
import type { BudgetType } from '../types'

export default function Dashboard() {
  const { currentView, appData } = useBudget()

  // Calculate summaries based on current view
  const householdSummary = useMemo(
    () => calculateAccountSummary(appData.accounts, 'household'),
    [appData.accounts]
  )

  const businessSummary = useMemo(
    () => calculateAccountSummary(appData.accounts, 'business'),
    [appData.accounts]
  )

  const combinedSummary = useMemo(
    () => calculateAccountSummary(appData.accounts),
    [appData.accounts]
  )

  const householdBudget = useMemo(
    () =>
      calculateBudgetSummary(
        appData.transactions,
        appData.categories,
        'household'
      ),
    [appData.transactions, appData.categories]
  )

  const businessBudget = useMemo(
    () =>
      calculateBudgetSummary(appData.transactions, appData.categories, 'business'),
    [appData.transactions, appData.categories]
  )

  const householdTopSpending = useMemo(
    () =>
      getTopSpendingCategories(
        appData.transactions,
        appData.categories,
        'household',
        5
      ),
    [appData.transactions, appData.categories]
  )

  const businessTopSpending = useMemo(
    () =>
      getTopSpendingCategories(
        appData.transactions,
        appData.categories,
        'business',
        5
      ),
    [appData.transactions, appData.categories]
  )

  // Render combined view
  if (currentView === 'combined') {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Combined Dashboard</h1>
          <p className="text-gray-600 mt-2">Overview of all your finances</p>
        </div>

        {/* Combined Net Worth */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SummaryCard
            title="Total Assets"
            value={formatCurrency(combinedSummary.totalAssets)}
            icon={Wallet}
            colorClass="bg-green-500"
          />
          <SummaryCard
            title="Total Liabilities"
            value={formatCurrency(combinedSummary.totalLiabilities)}
            icon={CreditCard}
            colorClass="bg-red-500"
          />
          <SummaryCard
            title="Net Worth"
            value={formatCurrency(combinedSummary.netWorth)}
            icon={TrendingUp}
            colorClass="bg-purple-500"
          />
        </div>

        {/* Side-by-side comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Household Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Household</h2>
              <BudgetBadge budgetType="household" size="md" />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600 font-medium">Net Worth</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {formatCurrency(householdSummary.netWorth)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">
                  This Month Income
                </p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  {formatCurrency(householdBudget.totalIncome)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">
                  This Month Expenses
                </p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  {formatCurrency(householdBudget.totalExpenses)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">Remaining</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    householdBudget.remainingBudget >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(householdBudget.remainingBudget)}
                </p>
              </div>
            </div>

            {/* Household Accounts */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Accounts</h3>
              </div>
              <div className="p-4">
                {appData.accounts.filter((a) => a.budgetType === 'household')
                  .length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No accounts yet. Add one to get started!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appData.accounts
                      .filter((a) => a.budgetType === 'household')
                      .map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {account.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {account.accountType.replace('_', ' ')}
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Business</h2>
              <BudgetBadge budgetType="business" size="md" />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600 font-medium">Net Worth</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {formatCurrency(businessSummary.netWorth)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">
                  This Month Revenue
                </p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  {formatCurrency(businessBudget.totalIncome)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">
                  This Month Expenses
                </p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  {formatCurrency(businessBudget.totalExpenses)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-600 font-medium">Net Profit</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    businessBudget.remainingBudget >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {formatCurrency(businessBudget.remainingBudget)}
                </p>
              </div>
            </div>

            {/* Business Accounts */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Accounts</h3>
              </div>
              <div className="p-4">
                {appData.accounts.filter((a) => a.budgetType === 'business')
                  .length === 0 ? (
                  <p className="text-gray-500 text-center py-4">
                    No accounts yet. Add one to get started!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appData.accounts
                      .filter((a) => a.budgetType === 'business')
                      .map((account) => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {account.name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {account.accountType.replace('_', ' ')}
                            </p>
                          </div>
                          <p className="font-bold text-gray-900">
                            {formatCurrency(account.balance)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Single budget view (Household or Business)
  const summary =
    currentView === 'household' ? householdSummary : businessSummary
  const budget = currentView === 'household' ? householdBudget : businessBudget
  const topSpending =
    currentView === 'household' ? householdTopSpending : businessTopSpending
  const budgetType = currentView as BudgetType

  const accounts = appData.accounts.filter((a) => a.budgetType === budgetType)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {currentView === 'household' ? 'Household' : 'Business'} Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Overview of your {currentView} finances
          </p>
        </div>
        <BudgetBadge budgetType={budgetType} size="lg" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Total Assets"
          value={formatCurrency(summary.totalAssets)}
          icon={Wallet}
          colorClass={budgetType === 'household' ? 'bg-blue-500' : 'bg-green-500'}
        />
        <SummaryCard
          title="Total Liabilities"
          value={formatCurrency(summary.totalLiabilities)}
          icon={CreditCard}
          colorClass="bg-red-500"
        />
        <SummaryCard
          title="Net Worth"
          value={formatCurrency(summary.netWorth)}
          icon={TrendingUp}
          colorClass={budgetType === 'household' ? 'bg-blue-700' : 'bg-green-700'}
        />
      </div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">
              {budgetType === 'household' ? 'Income This Month' : 'Revenue This Month'}
            </p>
            <DollarSign className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">
            {formatCurrency(budget.totalIncome)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">Expenses This Month</p>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">
            {formatCurrency(budget.totalExpenses)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-600">
              {budgetType === 'household' ? 'Remaining' : 'Net Profit'}
            </p>
            <TrendingUp className="w-5 h-5 text-gray-500" />
          </div>
          <p
            className={`text-3xl font-bold ${
              budget.remainingBudget >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(budget.remainingBudget)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* All Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">All Accounts</h3>
          </div>
          <div className="p-6">
            {accounts.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No accounts yet. Add one to get started!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                        Account
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                        Type
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                        Balance
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider pb-3">
                        Utilization
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {accounts.map((account) => (
                      <tr key={account.id}>
                        <td className="py-3">
                          <p className="font-medium text-gray-900">
                            {account.name}
                          </p>
                        </td>
                        <td className="py-3">
                          <p className="text-sm text-gray-600 capitalize">
                            {account.accountType.replace('_', ' ')}
                          </p>
                        </td>
                        <td className="py-3 text-right">
                          <p className="font-medium text-gray-900">
                            {formatCurrency(account.balance)}
                          </p>
                        </td>
                        <td className="py-3 text-right">
                          {account.creditUtilization !== undefined ? (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getCreditUtilizationColor(
                                account.creditUtilization
                              )}`}
                            >
                              {account.creditUtilization.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Top Spending Categories */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Top Spending This Month
            </h3>
          </div>
          <div className="p-6">
            {topSpending.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No expenses recorded this month.
              </p>
            ) : (
              <div className="space-y-4">
                {topSpending.map((item) => (
                  <div key={item.category.id} className="flex items-center">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {item.category.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.transactionCount} transaction
                        {item.transactionCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bucket Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Spending by Category Bucket
          </h3>
        </div>
        <div className="p-6">
          {budget.bucketBreakdown.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No spending data available.
            </p>
          ) : (
            <div className="space-y-6">
              {budget.bucketBreakdown.map((bucket) => (
                <div key={bucket.bucketId}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      {bucket.bucketName}
                    </h4>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        {formatCurrency(bucket.actualAmount)} of{' '}
                        {formatCurrency(bucket.targetAmount)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {bucket.percentOfIncome.toFixed(1)}% of income
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        budgetType === 'household' ? 'bg-blue-500' : 'bg-green-500'
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
