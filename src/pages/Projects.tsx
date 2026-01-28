import { useState, useMemo } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency } from '../utils/calculations'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import ExportButtons from '../components/ExportButtons'
import { Plus, Edit2, Trash2, FolderOpen, TrendingUp, DollarSign } from 'lucide-react'
import { exportToCSV, exportToPDF } from '../utils/export'
import type { Project, BudgetType } from '../types'

type BudgetFilter = 'all' | BudgetType
type SortBy = 'date' | 'name' | 'profit' | 'margin' | 'budget' | 'spent' | 'remaining' | 'percentUsed'
type DateRangeFilter = 'all' | 'this-month' | 'last-month' | '1-month' | '3-months' | '6-months' | '9-months' | 'this-year' | 'last-year' | string

export default function Projects() {
  const { currentView, appData, addProject, updateProject, deleteProject } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>('all')
  const [incomeSourceFilter, setIncomeSourceFilter] = useState<string>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  // Get effective budget filter (considers both currentView and budgetFilter)
  const effectiveBudgetFilter = useMemo(() => {
    if (currentView !== 'combined') {
      return currentView
    }
    return budgetFilter
  }, [currentView, budgetFilter])

  // Get unique years from projects for date filter
  const availableYears = useMemo(() => {
    const years = new Set<number>()
    appData.projects.forEach((project) => {
      const year = new Date(project.dateCreated).getFullYear()
      years.add(year)
    })
    return Array.from(years).sort((a, b) => b - a)
  }, [appData.projects])

  // Calculate date range based on filter
  const getDateRange = (filter: DateRangeFilter): { start: Date; end: Date } | null => {
    const now = new Date()

    switch (filter) {
      case 'this-month':
        return { start: startOfMonth(now), end: endOfMonth(now) }
      case 'last-month': {
        const lastMonth = subMonths(now, 1)
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) }
      }
      case '1-month':
        return { start: subMonths(now, 1), end: now }
      case '3-months':
        return { start: subMonths(now, 3), end: now }
      case '6-months':
        return { start: subMonths(now, 6), end: now }
      case '9-months':
        return { start: subMonths(now, 9), end: now }
      case 'this-year':
        return { start: startOfYear(now), end: endOfYear(now) }
      case 'last-year': {
        const lastYear = subYears(now, 1)
        return { start: startOfYear(lastYear), end: endOfYear(lastYear) }
      }
      default:
        // Check if it's a year filter (e.g., "2024")
        if (filter !== 'all' && /^\d{4}$/.test(filter)) {
          const year = parseInt(filter)
          return {
            start: new Date(year, 0, 1),
            end: new Date(year, 11, 31, 23, 59, 59)
          }
        }
        return null
    }
  }

  // Filter projects
  const filteredProjects = useMemo(() => {
    let projects = appData.projects

    // Filter by current view
    if (currentView !== 'combined') {
      projects = projects.filter((p) => p.budgetType === currentView)
    }

    // Apply budget filter
    if (budgetFilter !== 'all') {
      projects = projects.filter((p) => p.budgetType === budgetFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      projects = projects.filter((p) => p.statusId === statusFilter)
    }

    // Apply project type filter
    if (projectTypeFilter !== 'all') {
      projects = projects.filter((p) => p.projectTypeId === projectTypeFilter)
    }

    // Apply income source filter
    if (incomeSourceFilter !== 'all') {
      projects = projects.filter((p) => p.incomeSourceId === incomeSourceFilter)
    }

    // Apply date range filter
    if (dateRangeFilter !== 'all') {
      const dateRange = getDateRange(dateRangeFilter)
      if (dateRange) {
        projects = projects.filter((p) => {
          const projectDate = parseISO(p.dateCreated + 'T12:00:00')
          return projectDate >= dateRange.start && projectDate <= dateRange.end
        })
      }
    }

    return projects
  }, [appData.projects, currentView, budgetFilter, statusFilter, projectTypeFilter, incomeSourceFilter, dateRangeFilter])

  // Calculate project metrics
  const projectMetrics = useMemo(() => {
    return filteredProjects.map((project) => {
      const transactions = appData.transactions.filter((t) => t.projectId === project.id)

      const revenue = transactions
        .filter((t) => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)

      const expenses = Math.abs(
        transactions
          .filter((t) => t.amount < 0)
          .reduce((sum, t) => sum + t.amount, 0)
      )

      const profit = revenue - expenses
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0

      // Budget tracking metrics (primarily for household)
      const budget = project.budget || 0
      const spent = expenses // For household, "spent" is typically expenses
      const remaining = budget - spent
      const percentUsed = budget > 0 ? (spent / budget) * 100 : 0
      const isOverBudget = spent > budget && budget > 0

      return {
        project,
        revenue,
        expenses,
        profit,
        margin,
        budget,
        spent,
        remaining,
        percentUsed,
        isOverBudget,
      }
    })
  }, [filteredProjects, appData.transactions])

  // Sort projects
  const sortedProjects = useMemo(() => {
    const sorted = [...projectMetrics]

    switch (sortBy) {
      case 'name':
        return sorted.sort((a, b) => a.project.name.localeCompare(b.project.name))
      case 'profit':
        return sorted.sort((a, b) => b.profit - a.profit)
      case 'margin':
        return sorted.sort((a, b) => b.margin - a.margin)
      case 'budget':
        return sorted.sort((a, b) => b.budget - a.budget)
      case 'spent':
        return sorted.sort((a, b) => b.spent - a.spent)
      case 'remaining':
        return sorted.sort((a, b) => b.remaining - a.remaining)
      case 'percentUsed':
        return sorted.sort((a, b) => b.percentUsed - a.percentUsed)
      case 'date':
      default:
        return sorted.sort((a, b) => b.project.dateCreated.localeCompare(a.project.dateCreated))
    }
  }, [projectMetrics, sortBy])

  // Calculate summary totals
  const summary = useMemo(() => {
    return sortedProjects.reduce(
      (acc, pm) => ({
        // P&L metrics (for business)
        totalRevenue: acc.totalRevenue + pm.revenue,
        totalExpenses: acc.totalExpenses + pm.expenses,
        totalProfit: acc.totalProfit + pm.profit,
        // Budget tracking metrics (for household)
        totalBudget: acc.totalBudget + pm.budget,
        totalSpent: acc.totalSpent + pm.spent,
        totalRemaining: acc.totalRemaining + pm.remaining,
        projectsWithBudget: acc.projectsWithBudget + (pm.budget > 0 ? 1 : 0),
        projectsOverBudget: acc.projectsOverBudget + (pm.isOverBudget ? 1 : 0),
      }),
      {
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        totalBudget: 0,
        totalSpent: 0,
        totalRemaining: 0,
        projectsWithBudget: 0,
        projectsOverBudget: 0,
      }
    )
  }, [sortedProjects])

  const avgMargin = summary.totalRevenue > 0
    ? (summary.totalProfit / summary.totalRevenue) * 100
    : 0

  const avgPercentUsed = summary.totalBudget > 0
    ? (summary.totalSpent / summary.totalBudget) * 100
    : 0

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this project? Transactions will not be deleted.')) {
      deleteProject(id)
    }
  }

  // Helper functions to get config names
  const getProjectTypeName = (projectTypeId: string) => {
    const type = appData.projectTypes.find((t) => t.id === projectTypeId)
    return type?.name || 'Unknown'
  }

  const getStatusName = (statusId: string) => {
    const status = appData.projectStatuses.find((s) => s.id === statusId)
    return status?.name || 'Unknown'
  }

  const getIncomeSourceName = (incomeSourceId?: string) => {
    if (!incomeSourceId) return null
    const source = appData.income.find((s) => s.id === incomeSourceId)
    return source?.source || 'Unknown'
  }

  // Export handlers
  const handleExportCSV = () => {
    const exportData = filteredProjects.map(project => {
      const spent = appData.transactions
        .filter((t) => t.projectId === project.id)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      const remaining = project.budget - spent
      const percentUsed = project.budget > 0 ? (spent / project.budget) * 100 : 0

      return {
        Name: project.name,
        Type: getProjectTypeName(project.projectTypeId),
        Status: getStatusName(project.statusId),
        Budget: project.budgetType === 'household' ? 'Household' : 'Business',
        'Date Created': format(parseISO(project.dateCreated), 'MM/dd/yyyy'),
        'Project Budget': project.budget,
        Spent: spent,
        Remaining: remaining,
        'Percent Used': `${percentUsed.toFixed(1)}%`,
        Revenue: project.revenue || 0,
        Profit: (project.revenue || 0) - spent,
        'Profit Margin': project.revenue ? `${(((project.revenue - spent) / project.revenue) * 100).toFixed(1)}%` : 'N/A',
        'Income Source': getIncomeSourceName(project.incomeSourceId) || '',
        Notes: project.notes || ''
      }
    })

    const filename = `projects-${currentView}-${format(new Date(), 'yyyy-MM-dd')}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    const exportData = filteredProjects.map(project => {
      const spent = appData.transactions
        .filter((t) => t.projectId === project.id)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      const remaining = project.budget - spent
      const profit = (project.revenue || 0) - spent

      return {
        name: project.name,
        type: getProjectTypeName(project.projectTypeId),
        status: getStatusName(project.statusId),
        budget: formatCurrency(project.budget),
        spent: formatCurrency(spent),
        remaining: formatCurrency(remaining),
        revenue: formatCurrency(project.revenue || 0),
        profit: formatCurrency(profit)
      }
    })

    const filename = `projects-${currentView}-${format(new Date(), 'yyyy-MM-dd')}`
    const title = `${currentView.charAt(0).toUpperCase() + currentView.slice(1)} Projects`

    exportToPDF(
      exportData,
      filename,
      title,
      ['Name', 'Type', 'Status', 'Budget', 'Spent', 'Remaining', 'Revenue', 'Profit'],
      ['name', 'type', 'status', 'budget', 'spent', 'remaining', 'revenue', 'profit']
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Track profitability by performance, craft project, or event</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={filteredProjects.length === 0}
          />
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5" />
            Add Project
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {effectiveBudgetFilter === 'business' ? (
        /* Business P&L View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Expenses</h3>
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalExpenses)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Profit</h3>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className={`text-2xl font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(summary.totalProfit)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg Margin</h3>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgMargin.toFixed(1)}%</p>
          </div>
        </div>
      ) : effectiveBudgetFilter === 'household' ? (
        /* Household Budget View */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Budget</h3>
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalBudget)}</p>
            <p className="text-xs text-gray-500 mt-1">{summary.projectsWithBudget} projects with budget</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Used So Far</h3>
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSpent)}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Still Available</h3>
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <p className={`text-2xl font-bold ${summary.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(summary.totalRemaining))}
              {summary.totalRemaining < 0 && ' over'}
            </p>
            {summary.projectsOverBudget > 0 && (
              <p className="text-xs text-red-500 mt-1">{summary.projectsOverBudget} over budget</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg % Used</h3>
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <p className={`text-2xl font-bold ${avgPercentUsed > 100 ? 'text-red-600' : 'text-gray-900'}`}>
              {avgPercentUsed.toFixed(1)}%
            </p>
          </div>
        </div>
      ) : (
        /* Combined View - Show both sets */
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Business Projects (P&L)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Revenue</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalRevenue)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Expenses</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalExpenses)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Profit</p>
                <p className={`text-lg font-bold ${summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(summary.totalProfit)}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Avg Margin</p>
                <p className="text-lg font-bold text-gray-900">{avgMargin.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Household Projects (Budget)</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Budget</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalBudget)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Used So Far</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(summary.totalSpent)}</p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Still Available</p>
                <p className={`text-lg font-bold ${summary.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(Math.abs(summary.totalRemaining))}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-xs text-gray-600">Avg % Used</p>
                <p className={`text-lg font-bold ${avgPercentUsed > 100 ? 'text-red-600' : 'text-gray-900'}`}>
                  {avgPercentUsed.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sort */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {currentView === 'combined' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Type</label>
            <select
              value={projectTypeFilter}
              onChange={(e) => setProjectTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {appData.projectTypes
                .filter((t) => effectiveBudgetFilter === 'all' || t.budgetType === effectiveBudgetFilter)
                .map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              {appData.projectStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Income Source</label>
            <select
              value={incomeSourceFilter}
              onChange={(e) => setIncomeSourceFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Sources</option>
              {appData.income
                .filter((s) => effectiveBudgetFilter === 'all' || s.budgetType === effectiveBudgetFilter)
                .map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.source}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as DateRangeFilter)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="1-month">Last 1 Month</option>
              <option value="3-months">Last 3 Months</option>
              <option value="6-months">Last 6 Months</option>
              <option value="9-months">Last 9 Months</option>
              <option value="this-year">This Year (YTD)</option>
              <option value="last-year">Last Year</option>
              {availableYears.map((year) => (
                <option key={year} value={year.toString()}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Date Created</option>
              <option value="name">Name</option>
              {effectiveBudgetFilter === 'business' ? (
                <>
                  <option value="profit">Profit</option>
                  <option value="margin">Margin</option>
                </>
              ) : effectiveBudgetFilter === 'household' ? (
                <>
                  <option value="budget">Budget</option>
                  <option value="spent">Used</option>
                  <option value="remaining">Available</option>
                  <option value="percentUsed">% Used</option>
                </>
              ) : (
                <>
                  <option value="profit">Profit</option>
                  <option value="margin">Margin</option>
                  <option value="budget">Budget</option>
                  <option value="spent">Used</option>
                  <option value="remaining">Available</option>
                  <option value="percentUsed">% Used</option>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              {effectiveBudgetFilter === 'household' ? (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    % Used
                  </th>
                </>
              ) : effectiveBudgetFilter === 'business' ? (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expenses
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit/Loss
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin
                  </th>
                </>
              ) : (
                <>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue/Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expenses/Spent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profit/Remaining
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margin/% Used
                  </th>
                </>
              )}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProjects.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  <FolderOpen className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No projects found. Click "Add Project" to get started.</p>
                </td>
              </tr>
            ) : (
              sortedProjects.map(({ project, revenue, expenses, profit, margin, budget, spent, remaining, percentUsed, isOverBudget }) => (
                <tr
                  key={project.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedProject(project)}
                >
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                        <BudgetBadge budgetType={project.budgetType} />
                        <span>•</span>
                        <span>{getProjectTypeName(project.projectTypeId)}</span>
                        {project.incomeSourceId && (
                          <>
                            <span>•</span>
                            <span className="text-blue-600">{getIncomeSourceName(project.incomeSourceId)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      getStatusName(project.statusId).toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                      getStatusName(project.statusId).toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                      getStatusName(project.statusId).toLowerCase() === 'confirmed' || getStatusName(project.statusId).toLowerCase() === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {getStatusName(project.statusId)}
                    </span>
                  </td>
                  {effectiveBudgetFilter === 'household' ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {budget > 0 ? formatCurrency(budget) : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(spent)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={isOverBudget ? 'text-red-600' : remaining >= 0 ? 'text-green-600' : 'text-gray-900'}>
                          {formatCurrency(Math.abs(remaining))}
                          {isOverBudget && ' over'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <span className={percentUsed > 100 ? 'text-red-600 font-semibold' : percentUsed > 80 ? 'text-yellow-600' : 'text-gray-900'}>
                          {percentUsed.toFixed(1)}%
                        </span>
                      </td>
                    </>
                  ) : effectiveBudgetFilter === 'business' ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {formatCurrency(expenses)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(profit)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {margin.toFixed(1)}%
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {project.budgetType === 'household'
                          ? (budget > 0 ? formatCurrency(budget) : '—')
                          : formatCurrency(revenue)
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {project.budgetType === 'household' ? formatCurrency(spent) : formatCurrency(expenses)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {project.budgetType === 'household' ? (
                          <span className={isOverBudget ? 'text-red-600' : remaining >= 0 ? 'text-green-600' : 'text-gray-900'}>
                            {formatCurrency(Math.abs(remaining))}
                            {isOverBudget && ' over'}
                          </span>
                        ) : (
                          <span className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatCurrency(profit)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {project.budgetType === 'household' ? (
                          <span className={percentUsed > 100 ? 'text-red-600 font-semibold' : percentUsed > 80 ? 'text-yellow-600' : 'text-gray-900'}>
                            {percentUsed.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-gray-900">{margin.toFixed(1)}%</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingProject(project)
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(project.id)
                      }}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Project"
        size="lg"
      >
        <ProjectForm
          budgetType={currentView === 'combined' ? 'business' : currentView}
          onSubmit={(project) => {
            addProject(project)
            setIsAddModalOpen(false)
          }}
          onCancel={() => setIsAddModalOpen(false)}
        />
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={editingProject !== null}
        onClose={() => setEditingProject(null)}
        title="Edit Project"
        size="lg"
      >
        {editingProject && (
          <ProjectForm
            project={editingProject}
            budgetType={editingProject.budgetType}
            onSubmit={(updates) => {
              updateProject(editingProject.id, updates)
              setEditingProject(null)
            }}
            onCancel={() => setEditingProject(null)}
          />
        )}
      </Modal>

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectDetailView
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      )}
    </div>
  )
}

// Project Form Component
interface ProjectFormProps {
  project?: Project
  budgetType: BudgetType
  onSubmit: (project: any) => void
  onCancel: () => void
}

function ProjectForm({ project, budgetType, onSubmit, onCancel }: ProjectFormProps) {
  const { appData } = useBudget()

  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get default values based on budget type
  const getDefaultProjectTypeId = (budgetType: BudgetType) => {
    const defaultType = appData.projectTypes.find((t) => t.budgetType === budgetType)
    return defaultType?.id || ''
  }

  const getDefaultStatusId = (projectTypeId: string) => {
    const projectType = appData.projectTypes.find((t) => t.id === projectTypeId)
    if (projectType && projectType.allowedStatuses.length > 0) {
      return projectType.allowedStatuses[0]
    }
    return appData.projectStatuses[0]?.id || ''
  }

  const defaultProjectTypeId = project?.projectTypeId || getDefaultProjectTypeId(budgetType)
  const [formData, setFormData] = useState({
    name: project?.name || '',
    budgetType: project?.budgetType || budgetType,
    projectTypeId: defaultProjectTypeId,
    statusId: project?.statusId || getDefaultStatusId(defaultProjectTypeId),
    incomeSourceId: project?.incomeSourceId || '',
    budget: project?.budget?.toString() || '',
    dateCreated: project?.dateCreated || getLocalDateString(),
    dateCompleted: project?.dateCompleted || '',
    commissionPaid: project?.commissionPaid || false,
    notes: project?.notes || '',
  })

  // Get available statuses for selected project type
  const availableStatuses = useMemo(() => {
    const projectType = appData.projectTypes.find((t) => t.id === formData.projectTypeId)
    if (!projectType) return appData.projectStatuses

    return appData.projectStatuses.filter((status) =>
      projectType.allowedStatuses.includes(status.id)
    )
  }, [formData.projectTypeId, appData.projectTypes, appData.projectStatuses])

  // Get available project types for selected budget
  const availableProjectTypes = useMemo(() => {
    return appData.projectTypes.filter((t) => t.budgetType === formData.budgetType)
  }, [formData.budgetType, appData.projectTypes])

  // Get available income sources for selected budget
  const availableIncomeSources = useMemo(() => {
    return appData.income.filter((s) => s.budgetType === formData.budgetType)
  }, [formData.budgetType, appData.income])

  // When project type changes, reset status to first allowed status
  const handleProjectTypeChange = (projectTypeId: string) => {
    setFormData({
      ...formData,
      projectTypeId,
      statusId: getDefaultStatusId(projectTypeId),
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required foreign keys exist
    if (!formData.projectTypeId) {
      alert('Please select a project type')
      return
    }

    if (!formData.statusId) {
      alert('Please select a status')
      return
    }

    // Verify project type exists
    const projectTypeExists = appData.projectTypes.some(t => t.id === formData.projectTypeId)
    if (!projectTypeExists) {
      alert('Selected project type is invalid. Please refresh the page and try again.')
      return
    }

    // Verify status exists
    const statusExists = appData.projectStatuses.some(s => s.id === formData.statusId)
    if (!statusExists) {
      alert('Selected status is invalid. Please refresh the page and try again.')
      return
    }

    // Verify income source exists if provided
    if (formData.incomeSourceId) {
      const incomeSourceExists = appData.income.some(s => s.id === formData.incomeSourceId)
      if (!incomeSourceExists) {
        alert('Selected income source is invalid. Please select a different one or leave it empty.')
        return
      }
    }

    const budgetValue = formData.budget ? parseFloat(formData.budget) : undefined
    onSubmit({
      ...formData,
      budget: budgetValue,
      incomeSourceId: formData.incomeSourceId || undefined,
      dateCompleted: formData.dateCompleted || undefined,
      notes: formData.notes || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Project Name */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., XYZ Theater Show, Kitchen Remodel"
          />
        </div>

        {/* Budget Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget Type *
          </label>
          <select
            required
            value={formData.budgetType}
            onChange={(e) => {
              const newBudgetType = e.target.value as BudgetType
              const newProjectTypeId = getDefaultProjectTypeId(newBudgetType)
              setFormData({
                ...formData,
                budgetType: newBudgetType,
                projectTypeId: newProjectTypeId,
                statusId: getDefaultStatusId(newProjectTypeId),
                incomeSourceId: '', // Reset income source
              })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="household">Household</option>
            <option value="business">Business</option>
          </select>
        </div>

        {/* Project Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Project Type *
          </label>
          <select
            required
            value={formData.projectTypeId}
            onChange={(e) => handleProjectTypeChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {availableProjectTypes.length === 0 ? (
              <option value="">No project types available</option>
            ) : (
              availableProjectTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.statusId}
            onChange={(e) => setFormData({ ...formData, statusId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {availableStatuses.length === 0 ? (
              <option value="">No statuses available</option>
            ) : (
              availableStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Income Source */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Income Source
            <span className="text-xs text-gray-500 ml-2">(Optional)</span>
          </label>
          <select
            value={formData.incomeSourceId}
            onChange={(e) => setFormData({ ...formData, incomeSourceId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">None</option>
            {availableIncomeSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.source}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Link this project to an income source for better tracking
          </p>
        </div>

        {/* Budget */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Budget
            <span className="text-xs text-gray-500 ml-2">(Optional)</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.budget}
            onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="0.00"
          />
          <p className="text-xs text-gray-500 mt-1">
            {formData.budgetType === 'household'
              ? 'Set a budget to track spending against'
              : 'Optional budget for this project'}
          </p>
        </div>

        {/* Date Created */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Created *
          </label>
          <input
            type="date"
            required
            value={formData.dateCreated}
            onChange={(e) => setFormData({ ...formData, dateCreated: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Date Completed */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date Completed
          </label>
          <input
            type="date"
            value={formData.dateCompleted}
            onChange={(e) => setFormData({ ...formData, dateCompleted: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Commission Paid */}
        <div className="md:col-span-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={formData.commissionPaid}
              onChange={(e) => setFormData({ ...formData, commissionPaid: e.target.checked })}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="ml-2 text-sm font-medium text-gray-700">
              Commission Paid
            </span>
          </label>
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="Additional notes..."
          />
        </div>
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
          {project ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}

// Project Detail View Component
interface ProjectDetailViewProps {
  project: Project
  onClose: () => void
}

function ProjectDetailView({ project, onClose }: ProjectDetailViewProps) {
  const { appData } = useBudget()

  // Export handlers for project detail
  const handleExportCSV = () => {
    const projectType = appData.projectTypes.find((t) => t.id === project.projectTypeId)
    const status = appData.projectStatuses.find((s) => s.id === project.statusId)
    const incomeSource = project.incomeSourceId
      ? appData.income.find((s) => s.id === project.incomeSourceId)
      : null

    // Project header info
    const headerData = {
      'Project Name': project.name,
      'Budget Type': project.budgetType === 'household' ? 'Household' : 'Business',
      'Project Type': projectType?.name || 'Unknown',
      'Status': status?.name || 'Unknown',
      'Date Created': format(parseISO(project.dateCreated + 'T12:00:00'), 'MM/dd/yyyy'),
      'Date Completed': project.dateCompleted ? format(parseISO(project.dateCompleted + 'T12:00:00'), 'MM/dd/yyyy') : '',
      'Income Source': incomeSource?.source || '',
      'Notes': project.notes || ''
    }

    // Categories summary
    const categoriesData = categoryBreakdown.map((item) => ({
      Category: item.category,
      Type: item.isIncome ? 'Income' : 'Expense',
      Amount: item.amount,
      'Percentage of Total': `${item.percentage.toFixed(1)}%`
    }))

    // Transactions detail
    const transactionsData = transactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((transaction) => {
        const category = appData.categories.find((c) => c.id === transaction.categoryId)
        return {
          Date: format(parseISO(transaction.date + 'T12:00:00'), 'MM/dd/yyyy'),
          Description: transaction.description,
          Category: category?.name || 'Uncategorized',
          Amount: transaction.amount,
          Type: transaction.amount >= 0 ? 'Income' : 'Expense'
        }
      })

    // Combine all sections with headers
    const exportData = [
      { Section: '=== PROJECT DETAILS ===' },
      headerData,
      { Section: '' },
      { Section: '=== SUMMARY ===' },
      project.budgetType === 'household'
        ? {
            'Total Budget': budgetMetrics.budget,
            'Amount Spent': budgetMetrics.spent,
            'Remaining': budgetMetrics.remaining,
            'Percent Used': `${budgetMetrics.percentUsed.toFixed(1)}%`,
            'Over Budget': budgetMetrics.isOverBudget ? 'Yes' : 'No'
          }
        : {
            Revenue: totals.revenue,
            Expenses: totals.expenses,
            Profit: totals.profit,
            'Profit Margin': `${totals.margin.toFixed(1)}%`
          },
      { Section: '' },
      { Section: '=== CATEGORIES ===' },
      ...categoriesData,
      { Section: '' },
      { Section: '=== TRANSACTIONS ===' },
      ...transactionsData
    ]

    const filename = `project-${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}`
    exportToCSV(exportData, filename)
  }

  const handleExportPDF = () => {
    // Import jsPDF and autoTable dynamically
    import('jspdf').then((jsPDFModule) => {
      import('jspdf-autotable').then((autoTableModule) => {
        const jsPDF = jsPDFModule.default
        const autoTable = autoTableModule.default

        const doc = new jsPDF()
        const projectType = appData.projectTypes.find((t) => t.id === project.projectTypeId)
        const status = appData.projectStatuses.find((s) => s.id === project.statusId)
        const incomeSource = project.incomeSourceId
          ? appData.income.find((s) => s.id === project.incomeSourceId)
          : null

        let yPos = 20

        // Title
        doc.setFontSize(18)
        doc.text(`Project: ${project.name}`, 14, yPos)
        yPos += 10

        // Date
        doc.setFontSize(9)
        doc.text(`Generated on: ${format(new Date(), 'MM/dd/yyyy')}`, 14, yPos)
        yPos += 10

        // Project Details Section
        doc.setFontSize(12)
        doc.text('Project Details', 14, yPos)
        yPos += 6

        doc.setFontSize(9)
        doc.text(`Type: ${projectType?.name || 'Unknown'}`, 20, yPos)
        yPos += 5
        doc.text(`Status: ${status?.name || 'Unknown'}`, 20, yPos)
        yPos += 5
        doc.text(`Budget Type: ${project.budgetType === 'household' ? 'Household' : 'Business'}`, 20, yPos)
        yPos += 5
        doc.text(`Created: ${format(parseISO(project.dateCreated + 'T12:00:00'), 'MM/dd/yyyy')}`, 20, yPos)
        yPos += 5
        if (project.dateCompleted) {
          doc.text(`Completed: ${format(parseISO(project.dateCompleted + 'T12:00:00'), 'MM/dd/yyyy')}`, 20, yPos)
          yPos += 5
        }
        if (incomeSource) {
          doc.text(`Income Source: ${incomeSource.source}`, 20, yPos)
          yPos += 5
        }
        yPos += 5

        // Summary Section
        doc.setFontSize(12)
        doc.text(project.budgetType === 'household' ? 'Budget Summary' : 'P&L Summary', 14, yPos)
        yPos += 6

        doc.setFontSize(9)
        if (project.budgetType === 'household') {
          doc.text(`Budget: ${formatCurrency(budgetMetrics.budget)}`, 20, yPos)
          yPos += 5
          doc.text(`Spent: ${formatCurrency(budgetMetrics.spent)}`, 20, yPos)
          yPos += 5
          doc.text(`Remaining: ${formatCurrency(budgetMetrics.remaining)}`, 20, yPos)
          yPos += 5
          doc.text(`% Used: ${budgetMetrics.percentUsed.toFixed(1)}%`, 20, yPos)
          yPos += 5
          if (budgetMetrics.isOverBudget) {
            doc.text(`Over Budget: Yes`, 20, yPos)
            yPos += 5
          }
        } else {
          doc.text(`Revenue: ${formatCurrency(totals.revenue)}`, 20, yPos)
          yPos += 5
          doc.text(`Expenses: ${formatCurrency(totals.expenses)}`, 20, yPos)
          yPos += 5
          doc.text(`Profit: ${formatCurrency(totals.profit)}`, 20, yPos)
          yPos += 5
          doc.text(`Margin: ${totals.margin.toFixed(1)}%`, 20, yPos)
          yPos += 5
        }
        yPos += 5

        // Categories Section
        doc.setFontSize(12)
        doc.text('Categories', 14, yPos)
        yPos += 3

        const categoriesData = categoryBreakdown.map((item) => [
          item.category,
          item.isIncome ? 'Income' : 'Expense',
          formatCurrency(item.amount),
          `${item.percentage.toFixed(1)}%`
        ])

        autoTable(doc, {
          head: [['Category', 'Type', 'Amount', '% of Total']],
          body: categoriesData,
          startY: yPos,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        })

        yPos = (doc as any).lastAutoTable.finalY + 10

        // Check if we need a new page
        if (yPos > 240) {
          doc.addPage()
          yPos = 20
        }

        // Transactions Section
        doc.setFontSize(12)
        const transactionCount = transactions.length
        const displayCount = Math.min(50, transactionCount)
        doc.text(`Transactions (${displayCount}${transactionCount > 50 ? ` of ${transactionCount}` : ''})`, 14, yPos)
        yPos += 3

        const transactionsData = transactions
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 50)
          .map((transaction) => {
            const category = appData.categories.find((c) => c.id === transaction.categoryId)
            return [
              format(parseISO(transaction.date + 'T12:00:00'), 'MM/dd/yy'),
              transaction.description.substring(0, 35),
              (category?.name || 'Uncategorized').substring(0, 15),
              formatCurrency(transaction.amount)
            ]
          })

        autoTable(doc, {
          head: [['Date', 'Description', 'Category', 'Amount']],
          body: transactionsData,
          startY: yPos,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [59, 130, 246] },
        })

        const filename = `project-${project.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${format(new Date(), 'yyyy-MM-dd')}`
        doc.save(`${filename}.pdf`)
      })
    })
  }

  // Get project metadata
  const projectType = appData.projectTypes.find((t) => t.id === project.projectTypeId)
  const status = appData.projectStatuses.find((s) => s.id === project.statusId)
  const incomeSource = project.incomeSourceId
    ? appData.income.find((s) => s.id === project.incomeSourceId)
    : null

  // Get all transactions for this project
  const transactions = appData.transactions.filter((t) => t.projectId === project.id)

  // Calculate budget metrics (for household projects)
  const budgetMetrics = useMemo(() => {
    const budget = project.budget || 0
    const spent = Math.abs(
      transactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )
    const remaining = budget - spent
    const percentUsed = budget > 0 ? (spent / budget) * 100 : 0
    const isOverBudget = spent > budget && budget > 0

    return { budget, spent, remaining, percentUsed, isOverBudget }
  }, [transactions, project.budget])

  // Get similar completed projects for comparison (same project type)
  const similarProjects = useMemo(() => {
    return appData.projects
      .filter((p) =>
        p.id !== project.id && // Not the current project
        p.projectTypeId === project.projectTypeId && // Same type
        p.budgetType === 'household' && // Household only
        p.dateCompleted // Only completed projects
      )
      .map((p) => {
        const projectTransactions = appData.transactions.filter((t) => t.projectId === p.id)
        const spent = Math.abs(
          projectTransactions
            .filter((t) => t.amount < 0)
            .reduce((sum, t) => sum + t.amount, 0)
        )
        const budget = p.budget || 0
        return { project: p, spent, budget }
      })
      .sort((a, b) => {
        // Sort by date completed (most recent first)
        if (!a.project.dateCompleted || !b.project.dateCompleted) return 0
        return b.project.dateCompleted.localeCompare(a.project.dateCompleted)
      })
      .slice(0, 5) // Show top 5 similar projects
  }, [appData.projects, appData.transactions, project.id, project.projectTypeId])

  // Calculate average cost for similar projects
  const avgSimilarCost = useMemo(() => {
    if (similarProjects.length === 0) return 0
    const totalSpent = similarProjects.reduce((sum, p) => sum + p.spent, 0)
    return totalSpent / similarProjects.length
  }, [similarProjects])

  // Calculate P&L by category
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, {
      category: string
      revenue: number
      expenses: number
      transactionIds: string[]
    }>()

    transactions.forEach((transaction) => {
      const category = appData.categories.find((c) => c.id === transaction.categoryId)
      const categoryName = category?.name || 'Uncategorized'

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          category: categoryName,
          revenue: 0,
          expenses: 0,
          transactionIds: [],
        })
      }

      const item = categoryMap.get(categoryName)!
      if (transaction.amount > 0) {
        item.revenue += transaction.amount
      } else {
        item.expenses += Math.abs(transaction.amount)
      }
      item.transactionIds.push(transaction.id)
    })

    // Calculate totals for percentages
    const totalRevenue = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const totalExpenses = Math.abs(
      transactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )

    // Convert to array with amount and percentage
    return Array.from(categoryMap.values())
      .map((item) => {
        // Determine if this is primarily an income or expense category
        const isIncome = item.revenue > item.expenses
        const amount = isIncome ? item.revenue : item.expenses
        const total = isIncome ? totalRevenue : totalExpenses
        const percentage = total > 0 ? (amount / total) * 100 : 0

        return {
          category: item.category,
          amount,
          percentage,
          isIncome,
          transactionIds: item.transactionIds,
        }
      })
      .sort((a, b) => b.amount - a.amount) // Sort by amount descending
  }, [transactions, appData.categories])

  // Calculate totals
  const totals = useMemo(() => {
    const revenue = transactions
      .filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const expenses = Math.abs(
      transactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )

    const profit = revenue - expenses
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0

    return { revenue, expenses, profit, margin }
  }, [transactions])

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // Render household or business view based on project type
  if (project.budgetType === 'household') {
    return (
      <Modal isOpen={true} onClose={onClose} title={project.name} size="xl">
        <div className="space-y-6">
          {/* Export Buttons */}
          <div className="flex justify-end">
            <ExportButtons
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              disabled={transactions.length === 0}
            />
          </div>

          {/* Project Info with Status Badge */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <BudgetBadge budgetType={project.budgetType} />
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  status?.name.toLowerCase() === 'completed' ? 'bg-green-100 text-green-800' :
                  status?.name.toLowerCase() === 'cancelled' ? 'bg-red-100 text-red-800' :
                  status?.name.toLowerCase() === 'active' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {status?.name || 'Unknown'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Project Type</p>
                <p className="text-sm font-medium text-gray-900">{projectType?.name || 'Unknown'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Date Created:</span>
                <p className="font-medium">{format(parseISO(project.dateCreated + 'T12:00:00'), 'MMM d, yyyy')}</p>
              </div>
              {project.dateCompleted && (
                <div>
                  <span className="text-gray-600">Date Completed:</span>
                  <p className="font-medium">{format(parseISO(project.dateCompleted + 'T12:00:00'), 'MMM d, yyyy')}</p>
                </div>
              )}
              {incomeSource && (
                <div>
                  <span className="text-gray-600">Income Source:</span>
                  <p className="font-medium text-blue-600">{incomeSource.source}</p>
                </div>
              )}
            </div>

            {project.notes && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-gray-600 text-sm">Notes:</span>
                <p className="mt-1 text-sm">{project.notes}</p>
              </div>
            )}
          </div>

          {/* Budget Tracking Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Budget Tracking</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900">Total Budget</h4>
                <p className="text-xl font-bold text-blue-600 mt-1">{formatCurrency(budgetMetrics.budget)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-red-900">Amount Spent</h4>
                <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(budgetMetrics.spent)}</p>
              </div>
              <div className={`${budgetMetrics.isOverBudget ? 'bg-red-50' : 'bg-green-50'} rounded-lg p-4`}>
                <h4 className={`text-sm font-medium ${budgetMetrics.isOverBudget ? 'text-red-900' : 'text-green-900'}`}>
                  {budgetMetrics.isOverBudget ? 'Over Budget' : 'Remaining'}
                </h4>
                <p className={`text-xl font-bold mt-1 ${budgetMetrics.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(Math.abs(budgetMetrics.remaining))}
                </p>
              </div>
              <div className={`${budgetMetrics.percentUsed > 100 ? 'bg-red-50' : budgetMetrics.percentUsed > 80 ? 'bg-yellow-50' : 'bg-purple-50'} rounded-lg p-4`}>
                <h4 className={`text-sm font-medium ${budgetMetrics.percentUsed > 100 ? 'text-red-900' : budgetMetrics.percentUsed > 80 ? 'text-yellow-900' : 'text-purple-900'}`}>
                  % Used
                </h4>
                <p className={`text-xl font-bold mt-1 ${budgetMetrics.percentUsed > 100 ? 'text-red-600' : budgetMetrics.percentUsed > 80 ? 'text-yellow-600' : 'text-purple-600'}`}>
                  {budgetMetrics.percentUsed.toFixed(1)}%
                </p>
              </div>
            </div>

            {budgetMetrics.isOverBudget && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ This project is over budget by {formatCurrency(Math.abs(budgetMetrics.remaining))}
                </p>
              </div>
            )}
          </div>

          {/* Category Breakdown (Expenses Only for Household) */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Spending by Category</h3>
            {categoryBreakdown.filter(item => !item.isIncome).length === 0 ? (
              <p className="text-center text-gray-500 py-8">No expenses linked to this project yet.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Spent</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Budget</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {categoryBreakdown
                      .filter(item => !item.isIncome)
                      .map((item) => {
                        const percentOfBudget = budgetMetrics.budget > 0 ? (item.amount / budgetMetrics.budget) * 100 : 0
                        return (
                          <tr
                            key={item.category}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedCategory(item.category)}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.category}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                              {formatCurrency(item.amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {item.percentage.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">
                              {percentOfBudget.toFixed(1)}%
                            </td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Similar Projects Comparison */}
          {similarProjects.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Similar Past Projects</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                <p className="text-sm text-blue-900">
                  <span className="font-semibold">Average cost for {projectType?.name || 'this type'}:</span>{' '}
                  {formatCurrency(avgSimilarCost)}
                  {budgetMetrics.spent > 0 && (
                    <span className="ml-2">
                      ({budgetMetrics.spent > avgSimilarCost ? (
                        <span className="text-red-700 font-medium">
                          +{formatCurrency(budgetMetrics.spent - avgSimilarCost)} more than average
                        </span>
                      ) : (
                        <span className="text-green-700 font-medium">
                          {formatCurrency(avgSimilarCost - budgetMetrics.spent)} less than average
                        </span>
                      )})
                    </span>
                  )}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Budget</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Spent</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {similarProjects.map(({ project: p, spent, budget }) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{p.name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {budget > 0 ? formatCurrency(budget) : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(spent)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {p.dateCompleted ? format(parseISO(p.dateCompleted + 'T12:00:00'), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transaction Details (if category selected) */}
          {selectedCategory && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-md font-semibold text-gray-900">Transactions - {selectedCategory}</h4>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Close
                </button>
              </div>
              <div className="bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions
                      .filter((t) => {
                        const category = appData.categories.find((c) => c.id === t.categoryId)
                        return (category?.name || 'Uncategorized') === selectedCategory
                      })
                      .map((transaction) => (
                        <tr key={transaction.id}>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {format(parseISO(transaction.date + 'T12:00:00'), 'MMM d, yyyy')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{transaction.description}</td>
                          <td className={`px-4 py-2 text-sm text-right font-medium ${
                            transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(transaction.amount)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // Business projects - show P&L view
  return (
    <Modal isOpen={true} onClose={onClose} title={project.name} size="xl">
      <div className="space-y-6">
        {/* Export Buttons */}
        <div className="flex justify-end">
          <ExportButtons
            onExportCSV={handleExportCSV}
            onExportPDF={handleExportPDF}
            disabled={transactions.length === 0}
          />
        </div>

        {/* Project Info */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Type:</span>
              <p className="font-medium">{projectType?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-gray-600">Status:</span>
              <p className="font-medium">{status?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-gray-600">Date Created:</span>
              <p className="font-medium">{format(parseISO(project.dateCreated + 'T12:00:00'), 'MMM d, yyyy')}</p>
            </div>
            {project.dateCompleted && (
              <div>
                <span className="text-gray-600">Date Completed:</span>
                <p className="font-medium">{format(parseISO(project.dateCompleted + 'T12:00:00'), 'MMM d, yyyy')}</p>
              </div>
            )}
            {incomeSource && (
              <div>
                <span className="text-gray-600">Income Source:</span>
                <p className="font-medium text-blue-600">{incomeSource.source}</p>
              </div>
            )}
            {project.commissionPaid && (
              <div>
                <span className="text-gray-600">Commission:</span>
                <p className="font-medium text-green-600">Paid</p>
              </div>
            )}
          </div>
          {project.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <span className="text-gray-600 text-sm">Notes:</span>
              <p className="mt-1 text-sm">{project.notes}</p>
            </div>
          )}
        </div>

        {/* P&L Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-green-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-900">Revenue</h4>
            <p className="text-xl font-bold text-green-600 mt-1">{formatCurrency(totals.revenue)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-900">Expenses</h4>
            <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totals.expenses)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900">Profit</h4>
            <p className={`text-xl font-bold mt-1 ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(totals.profit)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-purple-900">Margin</h4>
            <p className="text-xl font-bold text-purple-600 mt-1">{totals.margin.toFixed(1)}%</p>
          </div>
        </div>

        {/* Category Breakdown */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Category Breakdown</h3>
          {categoryBreakdown.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No transactions linked to this project yet.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categoryBreakdown.map((item) => (
                    <tr
                      key={item.category}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedCategory(item.category)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.category}</td>
                      <td className="px-4 py-3 text-sm text-left">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          item.isIncome ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {item.isIncome ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        item.isIncome ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-700">
                        {item.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Transaction Details (if category selected) */}
        {selectedCategory && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-md font-semibold text-gray-900">Transactions - {selectedCategory}</h4>
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Close
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {transactions
                    .filter((t) => {
                      const category = appData.categories.find((c) => c.id === t.categoryId)
                      return (category?.name || 'Uncategorized') === selectedCategory
                    })
                    .map((transaction) => (
                      <tr key={transaction.id}>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {format(parseISO(transaction.date + 'T12:00:00'), 'MMM d, yyyy')}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{transaction.description}</td>
                        <td className={`px-4 py-2 text-sm text-right font-medium ${
                          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
