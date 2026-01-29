import { Outlet, Link, useLocation } from 'react-router-dom'
import { useBudget } from '../contexts/BudgetContext'
import { useProfile } from '../contexts/ProfileContext'
import { useElectron } from '../hooks/useElectron'
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
  LogOut,
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
  const { activeProfile, logout } = useProfile()
  const location = useLocation()

  // Initialize Electron IPC listeners for keyboard shortcuts and menu navigation
  useElectron()

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout? You will be returned to the profile selection screen.')) {
      logout()
    }
  }

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Draggable Title Bar for macOS - accounts for traffic light buttons */}
      <div
        className="h-10 bg-white border-b border-gray-200 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />

      {/* Header - not draggable (has interactive elements) */}
      <header className="bg-white shadow-sm sticky top-0 z-50 flex-shrink-0">
        <div className="px-6">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">Dual Budget Tracker</h1>

              {/* Profile Indicator */}
              {activeProfile && (
                <div className="flex items-center gap-2">
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
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors group"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4 text-red-600 group-hover:text-red-800" />
                    <span className="text-sm font-medium text-red-700 group-hover:text-red-900">
                      Logout
                    </span>
                  </button>
                </div>
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

      {/* Main layout - sidebar fixed to left, content fills remaining space */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation - fixed width, no centering */}
        <aside className="w-56 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <nav className="p-4 space-y-1">
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

        {/* Main Content - fills remaining space, content centers within */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
