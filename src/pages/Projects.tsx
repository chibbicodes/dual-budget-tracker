import { useState, useMemo } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency } from '../utils/calculations'
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import { Plus, Edit2, Trash2, FolderOpen, TrendingUp, DollarSign } from 'lucide-react'
import type { Project, BudgetType } from '../types'

type BudgetFilter = 'all' | BudgetType
type SortBy = 'date' | 'name' | 'profit' | 'margin'
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

      return {
        project,
        revenue,
        expenses,
        profit,
        margin,
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
      case 'date':
      default:
        return sorted.sort((a, b) => b.project.dateCreated.localeCompare(a.project.dateCreated))
    }
  }, [projectMetrics, sortBy])

  // Calculate summary totals
  const summary = useMemo(() => {
    return sortedProjects.reduce(
      (acc, pm) => ({
        totalRevenue: acc.totalRevenue + pm.revenue,
        totalExpenses: acc.totalExpenses + pm.expenses,
        totalProfit: acc.totalProfit + pm.profit,
      }),
      { totalRevenue: 0, totalExpenses: 0, totalProfit: 0 }
    )
  }, [sortedProjects])

  const avgMargin = summary.totalRevenue > 0
    ? (summary.totalProfit / summary.totalRevenue) * 100
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
    const source = appData.incomeSources.find((s) => s.id === incomeSourceId)
    return source?.name || 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Track profitability by performance, craft project, or event</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Add Project
        </button>
      </div>

      {/* Summary Cards */}
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
                .filter((t) => budgetFilter === 'all' || t.budgetType === budgetFilter)
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
              {appData.incomeSources
                .filter((s) => budgetFilter === 'all' || s.budgetType === budgetFilter)
                .map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
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
              <option value="profit">Profit</option>
              <option value="margin">Margin</option>
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
              sortedProjects.map(({ project, revenue, expenses, profit, margin }) => (
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
    return appData.incomeSources.filter((s) => s.budgetType === formData.budgetType)
  }, [formData.budgetType, appData.incomeSources])

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
    onSubmit({
      ...formData,
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
                {source.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Link this project to an income source for better tracking
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

  // Get project metadata
  const projectType = appData.projectTypes.find((t) => t.id === project.projectTypeId)
  const status = appData.projectStatuses.find((s) => s.id === project.statusId)
  const incomeSource = project.incomeSourceId
    ? appData.incomeSources.find((s) => s.id === project.incomeSourceId)
    : null

  // Get all transactions for this project
  const transactions = appData.transactions.filter((t) => t.projectId === project.id)

  // Calculate P&L by category
  const categoryBreakdown = useMemo(() => {
    const categoryMap = new Map<string, { category: string; revenue: number; expenses: number; transactionIds: string[] }>()

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

    return Array.from(categoryMap.values()).sort((a, b) =>
      (b.revenue + b.expenses) - (a.revenue + a.expenses)
    )
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

  return (
    <Modal isOpen={true} onClose={onClose} title={project.name} size="xl">
      <div className="space-y-6">
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
                <p className="font-medium text-blue-600">{incomeSource.name}</p>
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Expenses</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categoryBreakdown.map((item) => {
                    const net = item.revenue - item.expenses
                    return (
                      <tr
                        key={item.category}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedCategory(item.category)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.category}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">
                          {item.revenue > 0 ? formatCurrency(item.revenue) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">
                          {item.expenses > 0 ? formatCurrency(item.expenses) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(net)}
                        </td>
                      </tr>
                    )
                  })}
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
