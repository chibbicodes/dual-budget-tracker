import { useState, useMemo } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import { formatCurrency } from '../utils/calculations'
import Modal from '../components/Modal'
import BudgetBadge from '../components/BudgetBadge'
import { Plus, Edit2, Trash2, FolderOpen, TrendingUp, DollarSign } from 'lucide-react'
import type { Project, BudgetType, ProjectType, ProjectStatus } from '../types'

type BudgetFilter = 'all' | BudgetType
type SortBy = 'date' | 'name' | 'profit' | 'margin'

export default function Projects() {
  const { currentView, appData, addProject, updateProject, deleteProject } = useBudget()
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

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
      projects = projects.filter((p) => p.status === statusFilter)
    }

    return projects
  }, [appData.projects, currentView, budgetFilter, statusFilter])

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
        <div className="flex flex-wrap items-center gap-4">
          {currentView === 'combined' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
              <select
                value={budgetFilter}
                onChange={(e) => setBudgetFilter(e.target.value as BudgetFilter)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="household">Household</option>
                <option value="business">Business</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="holding">Holding</option>
              <option value="issued">Issued</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
                        <span className="capitalize">{project.projectType.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.status === 'completed' ? 'bg-green-100 text-green-800' :
                      project.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                      project.status === 'confirmed' || project.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
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

      {/* Project Detail Modal - TODO: Will implement in next iteration */}
      {selectedProject && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedProject(null)}
          title={selectedProject.name}
          size="xl"
        >
          <div className="text-center py-8 text-gray-500">
            <p>Project detail view coming soon!</p>
            <p className="text-sm mt-2">This will show category breakdown and transaction details.</p>
          </div>
        </Modal>
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
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const [formData, setFormData] = useState({
    name: project?.name || '',
    budgetType: project?.budgetType || budgetType,
    projectType: project?.projectType || ('performance' as ProjectType),
    status: project?.status || ('holding' as ProjectStatus),
    dateCreated: project?.dateCreated || getLocalDateString(),
    dateCompleted: project?.dateCompleted || '',
    commissionPaid: project?.commissionPaid || false,
    notes: project?.notes || '',
  })

  const performanceStatuses: ProjectStatus[] = ['holding', 'issued', 'confirmed', 'completed', 'cancelled']
  const generalStatuses: ProjectStatus[] = ['submitted', 'quoted', 'confirmed', 'active', 'delivered', 'completed']

  const statusOptions = formData.projectType === 'performance' ? performanceStatuses : generalStatuses

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
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
            onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as BudgetType })}
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
            value={formData.projectType}
            onChange={(e) => setFormData({ ...formData, projectType: e.target.value as ProjectType })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="performance">Performance</option>
            <option value="craft">Craft</option>
            <option value="home_improvement">Home Improvement</option>
            <option value="party">Party/Event</option>
            <option value="event">Event</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status *
          </label>
          <select
            required
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
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
