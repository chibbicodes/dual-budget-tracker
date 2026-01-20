import { Outlet, Link, useLocation } from 'react-router-dom'
import { useBudget } from '../contexts/BudgetContext'
import { useProfile } from '../contexts/ProfileContext'
import {
  Home,
  Wallet,
  Calendar,
  PieChart,
  TrendingUp,
  Receipt,
  DollarSign,
  FolderOpen,
  FileText,
  Settings,
  User,
} from 'lucide-react'
import type { BudgetViewType } from '../types'

const navigation = [
  { name: 'Dashboard', path: '/', icon: Home },
  { name: 'Accounts', path: '/accounts', icon: Wallet },
  { name: 'Due Dates', path: '/due-dates', icon: Calendar },
  { name: 'Budget', path: '/budget', icon: PieChart },
  { name: 'Analysis', path: '/budget-analysis', icon: TrendingUp },
  { name: 'Transactions', path: '/transactions', icon: Receipt },
  { name: 'Income', path: '/income', icon: DollarSign },
  { name: 'Projects', path: '/projects', icon: FolderOpen },
  { name: 'Reports', path: '/business-reports', icon: FileText, businessOnly: true },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export default function Layout() {
  const { currentView, setCurrentView } = useBudget()
  const { activeProfile } = useProfile()
  const location = useLocation()

  const handleViewChange = (view: BudgetViewType) => {
    setCurrentView(view)
  }

  const getBudgetBadgeClass = () => {
    switch (currentView) {
      case 'household':
        return 'bg-household-500 text-white'
      case 'business':
        return 'bg-business-500 text-white'
      case 'combined':
        return 'bg-gradient-to-r from-household-500 to-business-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Dual Budget Tracker</h1>

              {/* Profile Indicator */}
              {activeProfile && (
                <Link
                  to="/settings"
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
                  title="View profile settings"
                >
                  <User className="h-4 w-4 text-gray-600 group-hover:text-gray-800" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {activeProfile.name}
                  </span>
                </Link>
              )}
            </div>

            {/* Budget Selector */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Budget View:</span>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => handleViewChange('household')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'household'
                      ? 'bg-household-500 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Switch to Household budget (Ctrl+1)"
                >
                  Household
                </button>
                <button
                  onClick={() => handleViewChange('business')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'business'
                      ? 'bg-business-500 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Switch to Business budget (Ctrl+2)"
                >
                  Business
                </button>
                <button
                  onClick={() => handleViewChange('combined')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentView === 'combined'
                      ? 'bg-gradient-to-r from-household-500 to-business-500 text-white'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                  title="Switch to Combined view (Ctrl+3)"
                >
                  Combined
                </button>
              </div>

              {/* Current View Badge */}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBudgetBadgeClass()}`}>
                {currentView.charAt(0).toUpperCase() + currentView.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {navigation.map((item) => {
                // Hide business reports for household view
                if (item.businessOnly && currentView === 'household') {
                  return null
                }

                const isActive = location.pathname === item.path
                const Icon = item.icon

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? currentView === 'household'
                          ? 'bg-household-100 text-household-700'
                          : currentView === 'business'
                          ? 'bg-business-100 text-business-700'
                          : 'bg-purple-100 text-purple-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
