import { useMemo, useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency, calculateBudgetSummary } from '../utils/calculations'
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle, Lightbulb } from 'lucide-react'
import ExportButtons from '../components/ExportButtons'
import { exportToCSV, exportToPDF } from '../utils/export'
import type { BudgetType, Category } from '../types'
import { subMonths, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears } from 'date-fns'

type BudgetFilter = 'all' | BudgetType
type TimeRange = 'this_month' | 'last_month' | '1_month' | '3_months' | '6_months' | '1_year' | 'ytd' | 'last_year'

export default function BudgetAnalysis() {
  const { currentView, appData } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [timeRange, setTimeRange] = useState<TimeRange>('6_months')

  // Determine which budget we're analyzing
  const budgetType =
    currentView === 'combined' ? (budgetFilter === 'all' ? 'household' : budgetFilter) : (currentView as BudgetType)

  // Calculate date range based on selected timeRange
  const dateRange = useMemo(() => {
    const now = new Date()
    let startDate: Date
    let endDate: Date = now
    let monthsCount: number

    switch (timeRange) {
      case 'this_month':
        startDate = startOfMonth(now)
        endDate = endOfMonth(now)
        monthsCount = 1
        break
      case 'last_month':
        const lastMonth = subMonths(now, 1)
        startDate = startOfMonth(lastMonth)
        endDate = endOfMonth(lastMonth)
        monthsCount = 1
        break
      case '1_month':
        startDate = subMonths(now, 1)
        monthsCount = 1
        break
      case '3_months':
        startDate = subMonths(now, 3)
        monthsCount = 3
        break
      case '6_months':
        startDate = subMonths(now, 6)
        monthsCount = 6
        break
      case '1_year':
        startDate = subMonths(now, 12)
        monthsCount = 12
        break
      case 'ytd':
        startDate = startOfYear(now)
        monthsCount = now.getMonth() + 1
        break
      case 'last_year':
        const lastYear = subYears(now, 1)
        startDate = startOfYear(lastYear)
        endDate = endOfYear(lastYear)
        monthsCount = 12
        break
      default:
        startDate = subMonths(now, 6)
        monthsCount = 6
    }

    return { startDate, endDate, monthsCount }
  }, [timeRange])

  // Calculate historical data for the selected time range
  const historicalData = useMemo(() => {
    const months: Array<{
      month: Date
      income: number
      expenses: number
      net: number
      categorySpending: Record<string, number>
    }> = []

    for (let i = 0; i < dateRange.monthsCount; i++) {
      const monthDate = subMonths(dateRange.endDate, i)
      const summary = calculateBudgetSummary(appData.transactions, appData.categories, budgetType, monthDate)

      // Calculate category spending
      const categorySpending: Record<string, number> = {}
      summary.bucketBreakdown.forEach((bucket) => {
        bucket.categories.forEach((cat) => {
          categorySpending[cat.categoryId] = cat.actual
        })
      })

      months.push({
        month: monthDate,
        income: summary.totalIncome,
        expenses: summary.totalExpenses,
        net: summary.remainingBudget,
        categorySpending,
      })
    }

    return months.reverse() // Oldest to newest
  }, [appData.transactions, appData.categories, budgetType, dateRange])

  // Calculate averages and trends
  const analysis = useMemo(() => {
    if (historicalData.length === 0) {
      return {
        avgIncome: 0,
        avgExpenses: 0,
        avgNet: 0,
        incomeTrend: 0,
        expenseTrend: 0,
        categoryAverages: new Map<string, number>(),
        categoryTrends: new Map<string, number>(),
      }
    }

    const avgIncome = historicalData.reduce((sum, m) => sum + m.income, 0) / historicalData.length
    const avgExpenses = historicalData.reduce((sum, m) => sum + m.expenses, 0) / historicalData.length
    const avgNet = historicalData.reduce((sum, m) => sum + m.net, 0) / historicalData.length

    // Calculate trends (comparing first half to second half)
    const midpoint = Math.floor(historicalData.length / 2)
    const firstHalf = historicalData.slice(0, midpoint)
    const secondHalf = historicalData.slice(midpoint)

    const firstHalfIncome = firstHalf.reduce((sum, m) => sum + m.income, 0) / firstHalf.length
    const secondHalfIncome = secondHalf.reduce((sum, m) => sum + m.income, 0) / secondHalf.length
    const incomeTrend = ((secondHalfIncome - firstHalfIncome) / firstHalfIncome) * 100

    const firstHalfExpenses = firstHalf.reduce((sum, m) => sum + m.expenses, 0) / firstHalf.length
    const secondHalfExpenses = secondHalf.reduce((sum, m) => sum + m.expenses, 0) / secondHalf.length
    const expenseTrend = ((secondHalfExpenses - firstHalfExpenses) / firstHalfExpenses) * 100

    // Category averages and trends
    const categoryAverages = new Map<string, number>()
    const categoryTrends = new Map<string, number>()

    appData.categories
      .filter((c) => c.budgetType === budgetType)
      .forEach((category) => {
        const amounts = historicalData.map((m) => m.categorySpending[category.id] || 0)
        const avg = amounts.reduce((sum, a) => sum + a, 0) / amounts.length
        categoryAverages.set(category.id, avg)

        // Calculate trend
        const firstHalfAmounts = firstHalf.map((m) => m.categorySpending[category.id] || 0)
        const secondHalfAmounts = secondHalf.map((m) => m.categorySpending[category.id] || 0)
        const firstHalfAvg = firstHalfAmounts.reduce((sum, a) => sum + a, 0) / firstHalfAmounts.length
        const secondHalfAvg = secondHalfAmounts.reduce((sum, a) => sum + a, 0) / secondHalfAmounts.length

        if (firstHalfAvg > 0) {
          const trend = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100
          categoryTrends.set(category.id, trend)
        }
      })

    return {
      avgIncome,
      avgExpenses,
      avgNet,
      incomeTrend,
      expenseTrend,
      categoryAverages,
      categoryTrends,
    }
  }, [historicalData, appData.categories, budgetType])

  // Calculate vendor analysis (expenses only)
  const vendorAnalysis = useMemo(() => {
    const vendorMap = new Map<string, { totalPaid: number; count: number }>()

    // Filter expense transactions for the selected budget type and time range
    const relevantTransactions = appData.transactions.filter(
      (t) =>
        t.budgetType === budgetType &&
        new Date(t.date) >= dateRange.startDate &&
        new Date(t.date) <= dateRange.endDate &&
        t.amount < 0 && // Only expenses
        t.description &&
        t.description.trim()
    )

    relevantTransactions.forEach((t) => {
      const vendor = t.description.trim()
      const existing = vendorMap.get(vendor) || { totalPaid: 0, count: 0 }

      existing.totalPaid += Math.abs(t.amount)
      existing.count += 1

      vendorMap.set(vendor, existing)
    })

    // Convert to array and sort by total paid
    return Array.from(vendorMap.entries())
      .map(([vendor, data]) => ({
        vendor,
        ...data,
      }))
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .slice(0, 20) // Top 20 vendors
  }, [appData.transactions, budgetType, dateRange])

  // Calculate payee analysis (income only)
  const payeeAnalysis = useMemo(() => {
    const payeeMap = new Map<string, { totalReceived: number; count: number }>()

    // Filter income transactions for the selected budget type and time range
    const relevantTransactions = appData.transactions.filter(
      (t) =>
        t.budgetType === budgetType &&
        new Date(t.date) >= dateRange.startDate &&
        new Date(t.date) <= dateRange.endDate &&
        t.amount >= 0 && // Only income
        t.description &&
        t.description.trim()
    )

    relevantTransactions.forEach((t) => {
      const payee = t.description.trim()
      const existing = payeeMap.get(payee) || { totalReceived: 0, count: 0 }

      existing.totalReceived += t.amount
      existing.count += 1

      payeeMap.set(payee, existing)
    })

    // Convert to array and sort by total received
    return Array.from(payeeMap.entries())
      .map(([payee, data]) => ({
        payee,
        ...data,
      }))
      .sort((a, b) => b.totalReceived - a.totalReceived)
      .slice(0, 20) // Top 20 payees
  }, [appData.transactions, budgetType, dateRange])

  // Generate budget suggestions
  const suggestions = useMemo(() => {
    const suggestions: Array<{ category: Category; type: 'increase' | 'decrease' | 'create'; reason: string }> = []

    appData.categories
      .filter((c) => c.budgetType === budgetType && c.isActive)
      .forEach((category) => {
        const avg = analysis.categoryAverages.get(category.id) || 0
        const trend = analysis.categoryTrends.get(category.id) || 0
        const currentBudget = category.monthlyBudget

        // Suggest increase if consistently overspending
        if (avg > currentBudget * 1.1 && avg > 0) {
          suggestions.push({
            category,
            type: 'increase',
            reason: `Average spending (${formatCurrency(avg)}) is ${((avg / currentBudget - 1) * 100).toFixed(
              0
            )}% higher than budgeted`,
          })
        }

        // Suggest decrease if consistently underspending
        if (currentBudget > 0 && avg < currentBudget * 0.7 && avg > 0) {
          suggestions.push({
            category,
            type: 'decrease',
            reason: `Average spending (${formatCurrency(avg)}) is ${(
              (1 - avg / currentBudget) *
              100
            ).toFixed(0)}% lower than budgeted`,
          })
        }

        // Suggest creating budget if spending without one
        if (currentBudget === 0 && avg > 50) {
          suggestions.push({
            category,
            type: 'create',
            reason: `Spending ${formatCurrency(avg)} per month without a budget`,
          })
        }

        // Warn about rapidly increasing expenses
        if (trend > 20 && avg > 100) {
          suggestions.push({
            category,
            type: 'increase',
            reason: `Spending is increasing ${trend.toFixed(0)}% - consider adjusting budget`,
          })
        }
      })

    return suggestions.slice(0, 10) // Top 10 suggestions
  }, [appData.categories, budgetType, analysis])

  // 50/30/20 compliance (for household)
  const budgetCompliance = useMemo(() => {
    if (budgetType !== 'household' || analysis.avgIncome === 0) return null

    const currentMonth = calculateBudgetSummary(appData.transactions, appData.categories, 'household')

    const needsActual =
      currentMonth.bucketBreakdown.find((b) => b.bucketId === 'needs')?.actualAmount || 0
    const wantsActual =
      currentMonth.bucketBreakdown.find((b) => b.bucketId === 'wants')?.actualAmount || 0
    const savingsActual =
      currentMonth.bucketBreakdown.find((b) => b.bucketId === 'savings')?.actualAmount || 0

    const needsPercent = (needsActual / currentMonth.totalIncome) * 100
    const wantsPercent = (wantsActual / currentMonth.totalIncome) * 100
    const savingsPercent = (savingsActual / currentMonth.totalIncome) * 100

    return {
      needs: { actual: needsPercent, target: 50, diff: needsPercent - 50 },
      wants: { actual: wantsPercent, target: 30, diff: wantsPercent - 30 },
      savings: { actual: savingsPercent, target: 20, diff: savingsPercent - 20 },
    }
  }, [budgetType, analysis, appData])

  // Export handlers
  const handleExportCSV = () => {
    const exportData = appData.categories
      .filter((c) => c.budgetType === budgetType && !c.isIncomeCategory)
      .map(category => {
        const avg = analysis.categoryAverages.get(category.id) || 0
        const trend = analysis.categoryTrends.get(category.id) || 0
        const latestMonth = historicalData.length > 0
          ? (historicalData[historicalData.length - 1].categorySpending[category.id] || 0)
          : 0

        return {
          Category: category.name,
          'Average Spending': avg,
          'Latest Month': latestMonth,
          'Monthly Budget': category.monthlyBudget,
          'Trend': trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable',
          'Percent Change': `${trend.toFixed(1)}%`
        }
      })
      .filter(item => item['Average Spending'] > 0) // Only include categories with spending

    const filename = `budget-analysis-${budgetType}-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    const exportData = appData.categories
      .filter((c) => c.budgetType === budgetType && !c.isIncomeCategory)
      .map(category => {
        const avg = analysis.categoryAverages.get(category.id) || 0
        const trend = analysis.categoryTrends.get(category.id) || 0
        const latestMonth = historicalData.length > 0
          ? (historicalData[historicalData.length - 1].categorySpending[category.id] || 0)
          : 0

        return {
          category: category.name,
          average: formatCurrency(avg),
          latest: formatCurrency(latestMonth),
          budget: formatCurrency(category.monthlyBudget),
          trend: trend > 0 ? 'Increasing' : trend < 0 ? 'Decreasing' : 'Stable',
          percentChange: `${trend.toFixed(1)}%`
        }
      })
      .filter(item => parseFloat(item.average.replace(/[$,]/g, '')) > 0) // Only include categories with spending

    const filename = `budget-analysis-${budgetType}-${timeRange}-${format(new Date(), 'yyyy-MM-dd')}`
    const title = `${budgetType.charAt(0).toUpperCase() + budgetType.slice(1)} Budget Analysis`

    exportToPDF(
      exportData,
      filename,
      title,
      ['Category', 'Average', 'Latest', 'Budget', 'Trend', '% Change'],
      ['category', 'average', 'latest', 'budget', 'trend', 'percentChange']
    )
  }

  if (currentView === 'combined' && budgetFilter === 'all') {
    return (
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Budget Analysis</h2>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4">
          <p className="text-yellow-800">Please select a specific budget (Household or Business) to view analysis.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Budget Analysis</h2>

        <div className="flex items-center gap-4">
          {/* Budget filter (only show in combined view) */}
          {currentView === 'combined' && (
            <div className="flex bg-gray-100 rounded-lg p-1">
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

          {/* Time range selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="1_month">1 Month</option>
            <option value="3_months">3 Months</option>
            <option value="6_months">6 Months</option>
            <option value="1_year">1 Year</option>
            <option value="ytd">Year to Date</option>
            <option value="last_year">Last Year</option>
          </select>

          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={historicalData.length === 0 || analysis.categoryAverages.size === 0}
          />
        </div>
      </div>

      {/* Summary cards with trends */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Average Monthly Income</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(analysis.avgIncome)}</p>
          <div className="flex items-center gap-1 mt-2">
            {analysis.incomeTrend > 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm ${analysis.incomeTrend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {analysis.incomeTrend > 0 ? '+' : ''}
              {analysis.incomeTrend.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500">vs first half</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Average Monthly Expenses</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(analysis.avgExpenses)}</p>
          <div className="flex items-center gap-1 mt-2">
            {analysis.expenseTrend > 0 ? (
              <TrendingUp className="h-4 w-4 text-red-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-green-600" />
            )}
            <span className={`text-sm ${analysis.expenseTrend > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {analysis.expenseTrend > 0 ? '+' : ''}
              {analysis.expenseTrend.toFixed(1)}%
            </span>
            <span className="text-sm text-gray-500">vs first half</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Average Net</h3>
          <p className={`text-2xl font-bold ${analysis.avgNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(analysis.avgNet)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Savings rate: {((analysis.avgNet / analysis.avgIncome) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* 50/30/20 Compliance (Household only) */}
      {budgetCompliance && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">50/30/20 Budget Rule Compliance</h3>
            <p className="text-sm text-gray-500 mt-1">Based on current month spending</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Needs (Target: 50%)</span>
                  {Math.abs(budgetCompliance.needs.diff) < 5 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{budgetCompliance.needs.actual.toFixed(1)}%</p>
                <p className={`text-sm mt-1 ${budgetCompliance.needs.diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {budgetCompliance.needs.diff > 0 ? '+' : ''}
                  {budgetCompliance.needs.diff.toFixed(1)}% from target
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Wants (Target: 30%)</span>
                  {Math.abs(budgetCompliance.wants.diff) < 5 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{budgetCompliance.wants.actual.toFixed(1)}%</p>
                <p className={`text-sm mt-1 ${budgetCompliance.wants.diff > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {budgetCompliance.wants.diff > 0 ? '+' : ''}
                  {budgetCompliance.wants.diff.toFixed(1)}% from target
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Savings (Target: 20%)</span>
                  {Math.abs(budgetCompliance.savings.diff) < 5 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900">{budgetCompliance.savings.actual.toFixed(1)}%</p>
                <p
                  className={`text-sm mt-1 ${budgetCompliance.savings.diff < 0 ? 'text-red-600' : 'text-green-600'}`}
                >
                  {budgetCompliance.savings.diff > 0 ? '+' : ''}
                  {budgetCompliance.savings.diff.toFixed(1)}% from target
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900">Smart Budget Suggestions</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {suggestions.map((suggestion, idx) => (
              <div key={idx} className="p-6 hover:bg-gray-50">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      suggestion.type === 'increase'
                        ? 'bg-yellow-100 text-yellow-600'
                        : suggestion.type === 'decrease'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    {suggestion.type === 'increase' ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : suggestion.type === 'decrease' ? (
                      <TrendingDown className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">{suggestion.category.name}</h4>
                    <p className="text-sm text-gray-600">{suggestion.reason}</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Current budget: {formatCurrency(suggestion.category.monthlyBudget)} →{' '}
                      <span className="font-medium">
                        Suggested: {formatCurrency(analysis.categoryAverages.get(suggestion.category.id) || 0)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vendor Analysis (Expenses) */}
      {vendorAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Vendor Analysis</h3>
            <p className="text-sm text-gray-500 mt-1">
              Top {vendorAnalysis.length} vendors by total expenses
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Paid
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vendorAnalysis.map((vendor, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {vendor.vendor}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {vendor.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-red-600">
                      {formatCurrency(vendor.totalPaid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payee Analysis (Income) */}
      {payeeAnalysis.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Payee Analysis</h3>
            <p className="text-sm text-gray-500 mt-1">
              Top {payeeAnalysis.length} payees by total income
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payee
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transactions
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Received
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payeeAnalysis.map((payee, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {payee.payee}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-600">
                      {payee.count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-green-600">
                      {formatCurrency(payee.totalReceived)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Historical monthly trends */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Monthly Trends</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Income
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expenses
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Savings Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {historicalData.map((month, idx) => {
                const savingsRate = month.income > 0 ? (month.net / month.income) * 100 : 0
                return (
                  <tr key={idx} className={idx === historicalData.length - 1 ? 'bg-blue-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {format(month.month, 'MMM yyyy')}
                      {idx === historicalData.length - 1 && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Current</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(month.income)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(month.expenses)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${month.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(month.net)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${savingsRate >= 20 ? 'text-green-600' : 'text-gray-600'}`}>
                        {savingsRate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
