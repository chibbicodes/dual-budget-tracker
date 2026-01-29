import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBudget } from '../contexts/BudgetContext'
import { useAuth } from '../contexts/AuthContext'
import { useProfile } from '../contexts/ProfileContext'
import StorageService from '../services/storage'
import { Download, Upload, Trash2, AlertTriangle, Settings as SettingsIcon, Cloud, LogOut, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { logOut } from '../services/firebase/auth'
import { syncService, SyncProgress } from '../services/syncService'
import type { BudgetType } from '../types'
import ProfileManager from '../components/ProfileManager'

type Tab = 'profiles' | 'data' | 'preferences' | 'categories' | 'income' | 'projects' | 'cloud'

export default function Settings() {
  const navigate = useNavigate()
  const { user, isConfigured } = useAuth()
  const { activeProfile } = useProfile()
  const {
    appData,
    updateSettings,
    clearAllData,
    importData,
    addMissingDefaultCategories,
    cleanupOldBusinessExpenseCategories,
    addCategoryGroupsToBusinessExpenses,
    addIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    addProjectType,
    updateProjectType,
    deleteProjectType,
    addProjectStatus,
    updateProjectStatus,
    deleteProjectStatus,
    updateCategory,
  } = useBudget()
  const [activeTab, setActiveTab] = useState<Tab>('profiles')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ status: 'idle', message: '' })
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(syncService.getAutoSyncEnabled())
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(syncService.getLastSyncedAt())

  // Subscribe to sync progress
  useEffect(() => {
    const unsubscribe = syncService.onSyncProgress((progress) => {
      setSyncProgress(progress)
      if (progress.status === 'success') {
        setLastSyncedAt(syncService.getLastSyncedAt())
      }
    })
    return unsubscribe
  }, [])

  // Start/stop auto-sync when enabled changes or user signs in/out
  useEffect(() => {
    if (user && activeProfile && autoSyncEnabled) {
      syncService.startAutoSync(activeProfile.id, 5) // Sync every 5 minutes
    } else {
      syncService.stopAutoSync()
    }

    return () => {
      syncService.stopAutoSync()
    }
  }, [user, activeProfile, autoSyncEnabled])

  // Cloud sync handlers
  const handleSync = async () => {
    if (!activeProfile) {
      alert('No active profile selected')
      return
    }

    try {
      await syncService.syncProfile(activeProfile.id)
    } catch (error) {
      console.error('Sync error:', error)
    }
  }

  const handleToggleAutoSync = () => {
    const newValue = !autoSyncEnabled
    setAutoSyncEnabled(newValue)
    syncService.setAutoSyncEnabled(newValue)
  }

  const handleSignOut = async () => {
    if (confirm('Are you sure you want to sign out of cloud sync?')) {
      try {
        syncService.stopAutoSync()
        await logOut()
        alert('Signed out successfully')
      } catch (error) {
        console.error('Sign out error:', error)
        alert('Failed to sign out')
      }
    }
  }

  // Format last synced time
  const formatLastSynced = (date: Date | null): string => {
    if (!date) return 'Never'

    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`

    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`

    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  // Data export handlers
  const handleExportAll = () => {
    const jsonData = StorageService.exportAll(appData)
    StorageService.downloadJSON(jsonData, `budget-data-${new Date().toISOString().split('T')[0]}.json`)
  }

  const handleExportHousehold = () => {
    const jsonData = StorageService.exportHousehold(appData)
    StorageService.downloadJSON(jsonData, `household-data-${new Date().toISOString().split('T')[0]}.json`)
  }

  const handleExportBusiness = () => {
    const jsonData = StorageService.exportBusiness(appData)
    StorageService.downloadJSON(jsonData, `business-data-${new Date().toISOString().split('T')[0]}.json`)
  }

  // Data import handler
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await StorageService.readJSONFile(file)
      const importedData = StorageService.import(content, 'replace')
      importData(importedData)
      alert('Data imported successfully!')
    } catch (error) {
      alert('Failed to import data. Please check the file format.')
      console.error('Import error:', error)
    }

    // Reset file input
    event.target.value = ''
  }

  // Clear data handlers
  const handleClearBudgetType = (budgetType: BudgetType) => {
    if (
      confirm(
        `Are you sure you want to clear all ${budgetType} data? This will delete all accounts, transactions, and categories for the ${budgetType} budget. This action cannot be undone.`
      )
    ) {
      const clearedData = StorageService.clearBudgetType(appData, budgetType)
      importData(clearedData)
    }
  }

  const handleClearAll = () => {
    if (
      confirm(
        'Are you ABSOLUTELY sure you want to delete ALL data? This will permanently delete all accounts, transactions, categories, and settings. This action cannot be undone.'
      )
    ) {
      clearAllData()
      setShowClearConfirm(false)
      alert('All data has been cleared.')
    }
  }

  // Settings update handlers
  const handleDefaultViewChange = (view: 'household' | 'business' | 'combined') => {
    updateSettings({ defaultBudgetView: view })
  }

  const handleCurrencyChange = (symbol: string) => {
    updateSettings({ currencySymbol: symbol })
  }

  const handleSyncCategories = async () => {
    const count = await addMissingDefaultCategories()
    if (count > 0) {
      alert(`Successfully synced ${count} categories! This includes any missing default categories and reactivated income/transfer categories.`)
    } else {
      alert('All categories are already synced and active!')
    }
  }

  const handleCleanupBusinessExpenses = () => {
    // First, show diagnostic info
    const activeBusinessExpenses = appData.categories.filter(
      (c) => c.budgetType === 'business' && c.bucketId === 'business_expenses' && c.isActive
    )

    const diagnosticInfo = `You currently have ${activeBusinessExpenses.length} active business expense categories:\n\n${activeBusinessExpenses.map(c => `- ${c.name}`).join('\n')}\n\nClick OK to deactivate all except the 27 tailored artist categories.`

    if (confirm(diagnosticInfo)) {
      const deactivatedCount = cleanupOldBusinessExpenseCategories()
      if (deactivatedCount > 0) {
        alert(`Successfully cleaned up ${deactivatedCount} old business expense categories. They are now hidden from dropdowns but historical data is preserved.`)
      } else {
        alert('No old categories found to clean up. Your business expense categories are already up to date!')
      }
    }
  }

  const handleOrganizeCategories = () => {
    if (confirm('This will organize your business expense categories into 5 groups: Travel & Performance, Craft Business, Online & Marketing, Professional Services, and Administrative. Continue?')) {
      const updatedCount = addCategoryGroupsToBusinessExpenses()
      if (updatedCount > 0) {
        alert(`Successfully organized ${updatedCount} business expense categories into groups!`)
      } else {
        alert('All business expense categories are already organized into groups!')
      }
    }
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profiles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Profiles
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Data Management
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'preferences'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Preferences
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('income')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'income'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Income Sources
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'projects'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Projects
          </button>
          {isConfigured && (
            <button
              onClick={() => setActiveTab('cloud')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'cloud'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Cloud className="w-4 h-4" />
              Cloud Sync
            </button>
          )}
        </nav>
      </div>

      {/* Profiles Tab */}
      {activeTab === 'profiles' && <ProfileManager />}

      {/* Data Management Tab */}
      {activeTab === 'data' && (
        <div className="space-y-6">
          {/* Export Data */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Export Data</h3>
              <p className="text-sm text-gray-500 mt-1">Download your budget data as JSON files for backup</p>
            </div>
            <div className="p-6 space-y-4">
              <button
                onClick={handleExportAll}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export All Data
              </button>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportHousehold}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Household Only
                </button>

                <button
                  onClick={handleExportBusiness}
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Export Business Only
                </button>
              </div>

              <p className="text-sm text-gray-500 mt-4">
                Exported files are in JSON format and can be imported back into the application.
              </p>
            </div>
          </div>

          {/* Import Data */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Import Data</h3>
              <p className="text-sm text-gray-500 mt-1">Restore data from a previously exported JSON file</p>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Choose File to Import
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                </label>
              </div>

              <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-800">Warning</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Importing data will replace ALL existing data in the application. Make sure to export your
                      current data first if you want to keep it.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sync Categories */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Sync Default Categories</h3>
              <p className="text-sm text-gray-500 mt-1">
                Add new default categories that were added in app updates
              </p>
            </div>
            <div className="p-6">
              <button
                onClick={handleSyncCategories}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
                Sync Missing Categories
              </button>
              <p className="text-sm text-gray-500 mt-4">
                This will add any new default categories (like business expense categories) that were added to the app
                but aren't in your existing data. Your existing categories won't be affected.
              </p>
            </div>
          </div>

          {/* Cleanup Business Expenses */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Cleanup Business Categories</h3>
              <p className="text-sm text-gray-500 mt-1">
                Hide all business categories except the 27 tailored artist categories
              </p>
            </div>
            <div className="p-6">
              <button
                onClick={handleCleanupBusinessExpenses}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
                Cleanup Business Categories
              </button>
              <p className="text-sm text-gray-500 mt-4">
                This will deactivate ALL categories from Operating, Growth, Compensation, Tax Reserve, and Business Savings buckets.
                It will also clean up any old categories in Business Expenses that aren't part of the 27 tailored artist categories.
                Only the organized artist categories will remain visible in dropdowns. Historical data will be preserved.
              </p>
            </div>
          </div>

          {/* Migrate Categories */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Migrate Business Categories</h3>
              <p className="text-sm text-gray-500 mt-1">
                Update old business categories to new bucket structure
              </p>
            </div>
            <div className="p-6">
              <button
                onClick={handleOrganizeCategories}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <SettingsIcon className="h-4 w-4" />
                Migrate to New Buckets
              </button>
              <p className="text-sm text-gray-500 mt-4">
                This will migrate your business expense categories to the new 6-bucket structure:
                Travel & Performance, Craft Business, Online & Marketing, Professional Services, Administrative, and Personnel.
              </p>
            </div>
          </div>

          {/* Clear Data */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Clear Data</h3>
              <p className="text-sm text-gray-500 mt-1">Delete budget data permanently</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleClearBudgetType('household')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Household Data
                </button>

                <button
                  onClick={() => handleClearBudgetType('business')}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Business Data
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200">
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear ALL Data
                  </button>
                ) : (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-red-800">
                          Are you sure you want to delete ALL data?
                        </p>
                        <p className="text-sm text-red-700 mt-1">
                          This will permanently delete all accounts, transactions, categories, income sources, and
                          settings. This action cannot be undone.
                        </p>
                        <div className="flex items-center gap-3 mt-4">
                          <button
                            onClick={handleClearAll}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Yes, Delete Everything
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Data Statistics */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Data Statistics</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm text-gray-500">Accounts</p>
                  <p className="text-2xl font-bold text-gray-900">{appData.accounts.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{appData.transactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Categories</p>
                  <p className="text-2xl font-bold text-gray-900">{appData.categories.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Income Sources</p>
                  <p className="text-2xl font-bold text-gray-900">{appData.income.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <SettingsIcon className="h-5 w-5 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-900">Application Preferences</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Default View */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Default Budget View</label>
                <p className="text-sm text-gray-500 mb-3">Choose which budget view to show when opening the app</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDefaultViewChange('household')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.defaultBudgetView === 'household'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Household
                  </button>
                  <button
                    onClick={() => handleDefaultViewChange('business')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.defaultBudgetView === 'business'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Business
                  </button>
                  <button
                    onClick={() => handleDefaultViewChange('combined')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.defaultBudgetView === 'combined'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Combined
                  </button>
                </div>
              </div>

              {/* Currency Symbol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                <p className="text-sm text-gray-500 mb-3">Choose your preferred currency symbol</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCurrencyChange('$')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.currencySymbol === '$'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    $ (USD)
                  </button>
                  <button
                    onClick={() => handleCurrencyChange('€')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.currencySymbol === '€'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    € (EUR)
                  </button>
                  <button
                    onClick={() => handleCurrencyChange('£')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.currencySymbol === '£'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    £ (GBP)
                  </button>
                  <button
                    onClick={() => handleCurrencyChange('¥')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      appData.settings.currencySymbol === '¥'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ¥ (JPY/CNY)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <CategoryManager
          categories={appData.categories}
          onUpdateCategory={updateCategory}
        />
      )}

      {/* Income Sources Tab */}
      {activeTab === 'income' && (
        <IncomeSourceManager
          incomeSources={appData.incomeSources}
          onAddIncome={addIncomeSource}
          onUpdateIncome={updateIncomeSource}
          onDeleteIncome={deleteIncomeSource}
        />
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <ProjectTypesManager
            projectTypes={appData.projectTypes}
            projectStatuses={appData.projectStatuses}
            onAddType={addProjectType}
            onUpdateType={updateProjectType}
            onDeleteType={deleteProjectType}
          />
          <ProjectStatusesManager
            projectStatuses={appData.projectStatuses}
            onAddStatus={addProjectStatus}
            onUpdateStatus={updateProjectStatus}
            onDeleteStatus={deleteProjectStatus}
          />
        </div>
      )}

      {/* Cloud Sync Tab */}
      {activeTab === 'cloud' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-blue-600" />
              Cloud Sync Status
            </h3>

            {user ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <Cloud className="w-5 h-5 text-green-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900 mb-1">
                        Signed In
                      </h4>
                      <p className="text-sm text-green-700 mb-2">
                        {user.email}
                      </p>
                      {user.displayName && (
                        <p className="text-sm text-green-600">
                          Display name: {user.displayName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Auto-Sync Toggle */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">Auto-Sync</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Automatically sync every 5 minutes
                      </p>
                    </div>
                    <button
                      onClick={handleToggleAutoSync}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  {lastSyncedAt && (
                    <p className="text-xs text-gray-500">
                      Last synced: {formatLastSynced(lastSyncedAt)}
                    </p>
                  )}
                </div>

                {/* Sync Controls */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Manual Sync</h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Sync your local data with the cloud. This will push your changes and pull any updates from other devices.
                  </p>

                  <button
                    onClick={handleSync}
                    disabled={syncProgress.status === 'syncing'}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncProgress.status === 'syncing' ? 'animate-spin' : ''}`} />
                    {syncProgress.status === 'syncing' ? 'Syncing...' : 'Sync Now'}
                  </button>

                  {/* Sync Progress */}
                  {syncProgress.status !== 'idle' && (
                    <div className="mt-4">
                      {syncProgress.status === 'syncing' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-700">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">{syncProgress.message}</span>
                          </div>
                          {syncProgress.current && syncProgress.total && (
                            <div className="mt-2">
                              <div className="w-full bg-blue-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-blue-600 mt-1">
                                {syncProgress.current} of {syncProgress.total}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {syncProgress.status === 'success' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-700">{syncProgress.message}</span>
                        </div>
                      )}

                      {syncProgress.status === 'error' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-700">{syncProgress.message}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    What's Synced
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>✓ Profiles and settings</li>
                    <li>✓ Accounts and categories</li>
                    <li>✓ Transactions and income sources</li>
                    <li>✓ Projects and project types</li>
                    <li>• Auto-sync keeps everything up-to-date</li>
                    <li>• Conflicts resolved using latest timestamp</li>
                  </ul>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Not Signed In
                  </h4>
                  <p className="text-sm text-gray-600 mb-4">
                    Sign in to enable cloud sync and access your budget data from multiple devices.
                  </p>
                  <button
                    onClick={() => navigate('/cloud-auth')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Cloud className="w-4 h-4" />
                    Sign In or Create Account
                  </button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">
                    Features Coming Soon
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>✓ Sync data across devices</li>
                    <li>✓ Automatic backup to cloud</li>
                    <li>✓ Access from web and mobile</li>
                    <li>✓ Conflict resolution for multi-device editing</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Project Types Manager Component
interface ProjectTypesManagerProps {
  projectTypes: any[]
  projectStatuses: any[]
  onAddType: (type: any) => void
  onUpdateType: (id: string, updates: any) => void
  onDeleteType: (id: string) => void
}

function ProjectTypesManager({
  projectTypes,
  projectStatuses,
  onAddType,
  onUpdateType,
  onDeleteType,
}: ProjectTypesManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    budgetType: 'business' as 'household' | 'business',
    allowedStatuses: [] as string[],
  })

  const handleAdd = () => {
    if (!formData.name.trim()) {
      alert('Please enter a project type name')
      return
    }
    if (formData.allowedStatuses.length === 0) {
      alert('Please select at least one allowed status')
      return
    }
    onAddType(formData)
    setFormData({ name: '', budgetType: 'business', allowedStatuses: [] })
    setIsAdding(false)
  }

  const handleEdit = (type: any) => {
    setEditingId(type.id)
    setFormData({
      name: type.name,
      budgetType: type.budgetType,
      allowedStatuses: type.allowedStatuses,
    })
  }

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      alert('Please enter a project type name')
      return
    }
    if (formData.allowedStatuses.length === 0) {
      alert('Please select at least one allowed status')
      return
    }
    onUpdateType(editingId!, formData)
    setEditingId(null)
    setFormData({ name: '', budgetType: 'business', allowedStatuses: [] })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: '', budgetType: 'business', allowedStatuses: [] })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the project type "${name}"? Existing projects will keep their type for historical records.`)) {
      onDeleteType(id)
    }
  }

  const toggleStatus = (statusId: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedStatuses: prev.allowedStatuses.includes(statusId)
        ? prev.allowedStatuses.filter((id) => id !== statusId)
        : [...prev.allowedStatuses, statusId],
    }))
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Project Types</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage project types and their allowed statuses
        </p>
      </div>
      <div className="p-6 space-y-4">
        {/* Project Types List */}
        <div className="space-y-3">
          {projectTypes.map((type) => {
            const allowedStatusNames = type.allowedStatuses
              .map((id: string) => projectStatuses.find((s) => s.id === id)?.name)
              .filter(Boolean)
              .join(', ')

            return editingId === type.id ? (
              <div key={type.id} className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Project Type Name"
                  />
                  <select
                    value={formData.budgetType}
                    onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="household">Household</option>
                    <option value="business">Business</option>
                  </select>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Allowed Statuses (select multiple):
                    </label>
                    <div className="space-y-2">
                      {projectStatuses.map((status) => (
                        <label key={status.id} className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.allowedStatuses.includes(status.id)}
                            onChange={() => toggleStatus(status.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{status.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={type.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                <div>
                  <div className="font-medium text-gray-900">{type.name}</div>
                  <div className="text-sm text-gray-500">
                    {type.budgetType === 'household' ? 'Household' : 'Business'} • Statuses: {allowedStatusNames}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(type)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(type.id, type.name)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add New Form */}
        {isAdding ? (
          <div className="border border-green-300 rounded-lg p-4 bg-green-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Project Type</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Project Type Name (e.g., Workshop, Concert)"
              />
              <select
                value={formData.budgetType}
                onChange={(e) => setFormData({ ...formData, budgetType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="household">Household</option>
                <option value="business">Business</option>
              </select>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed Statuses (select multiple):
                </label>
                <div className="space-y-2">
                  {projectStatuses.map((status) => (
                    <label key={status.id} className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowedStatuses.includes(status.id)}
                        onChange={() => toggleStatus(status.id)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">{status.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Project Type
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Add Project Type
          </button>
        )}
      </div>
    </div>
  )
}

// Project Statuses Manager Component
interface ProjectStatusesManagerProps {
  projectStatuses: any[]
  onAddStatus: (status: any) => void
  onUpdateStatus: (id: string, updates: any) => void
  onDeleteStatus: (id: string) => void
}

function ProjectStatusesManager({
  projectStatuses,
  onAddStatus,
  onUpdateStatus,
  onDeleteStatus,
}: ProjectStatusesManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  const handleAdd = () => {
    if (!formData.name.trim()) {
      alert('Please enter a status name')
      return
    }
    onAddStatus(formData)
    setFormData({ name: '', description: '' })
    setIsAdding(false)
  }

  const handleEdit = (status: any) => {
    setEditingId(status.id)
    setFormData({
      name: status.name,
      description: status.description || '',
    })
  }

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      alert('Please enter a status name')
      return
    }
    onUpdateStatus(editingId!, formData)
    setEditingId(null)
    setFormData({ name: '', description: '' })
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: '', description: '' })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the status "${name}"? Existing projects will keep their status for historical records.`)) {
      onDeleteStatus(id)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Project Statuses</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage available project statuses
        </p>
      </div>
      <div className="p-6 space-y-4">
        {/* Statuses List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projectStatuses.map((status) =>
            editingId === status.id ? (
              <div key={status.id} className="border border-blue-300 rounded-lg p-4 bg-blue-50 md:col-span-2">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Status Name"
                  />
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={status.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                <div>
                  <div className="font-medium text-gray-900">{status.name}</div>
                  {status.description && <div className="text-sm text-gray-500">{status.description}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(status)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(status.id, status.name)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Add New Form */}
        {isAdding ? (
          <div className="border border-green-300 rounded-lg p-4 bg-green-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Status</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Status Name (e.g., Planning, In Progress)"
              />
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Description (optional)"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Status
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Add Status
          </button>
        )}
      </div>
    </div>
  )
}

// Category Manager Component
interface CategoryManagerProps {
  categories: any[]
  onUpdateCategory: (id: string, updates: any) => void
}

function CategoryManager({
  categories,
  onUpdateCategory,
}: CategoryManagerProps) {
  const [filterType, setFilterType] = useState<'all' | 'household' | 'business'>('all')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    isActive: true,
  })

  const handleEdit = (category: any) => {
    setEditingId(category.id)
    setFormData({
      name: category.name,
      isActive: category.isActive,
    })
  }

  const handleUpdate = () => {
    if (!formData.name.trim()) {
      alert('Please enter a category name')
      return
    }
    onUpdateCategory(editingId!, {
      name: formData.name,
      isActive: formData.isActive,
    })
    setEditingId(null)
    setFormData({ name: '', isActive: true })
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ name: '', isActive: true })
  }

  // Filter categories
  const filteredCategories = categories
    .filter((c) => {
      // Filter by budget type
      if (filterType !== 'all' && c.budgetType !== filterType) return false

      // Filter by active status
      if (filterActive === 'active' && !c.isActive) return false
      if (filterActive === 'inactive' && c.isActive) return false

      return true
    })
    .sort((a, b) => {
      // Sort by budget type first, then by name
      if (a.budgetType !== b.budgetType) {
        return a.budgetType === 'household' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Category Management</h3>
        <p className="text-sm text-gray-500 mt-1">
          View and edit all categories, including inactive ones. To edit budgets and bucket assignments, use the Budget page.
        </p>
      </div>
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Budget Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterType === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('household')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterType === 'household'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Household
              </button>
              <button
                onClick={() => setFilterType('business')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterType === 'business'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Business
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFilterActive('all')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterActive === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterActive('active')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterActive === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterActive('inactive')}
                className={`px-3 py-1 text-sm rounded-lg ${
                  filterActive === 'inactive'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>

        {/* Category List */}
        <div className="space-y-2">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No categories found matching the selected filters
            </div>
          ) : (
            filteredCategories.map((category) =>
              editingId === category.id ? (
                <div key={category.id} className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Category Name"
                    />
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Active</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdate}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={category.id}
                  className="flex items-center justify-between border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{category.name}</span>
                      {!category.isActive && (
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                          Inactive
                        </span>
                      )}
                      {category.isIncomeCategory && (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Income
                        </span>
                      )}
                      {category.excludeFromBudget && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                          Transfer
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {category.budgetType === 'household' ? 'Household' : 'Business'} •{' '}
                      {category.bucketId.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      {category.isFixedExpense && ' • Fixed Expense'}
                      {category.taxDeductibleByDefault && ' • Tax Deductible'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEdit(category)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                </div>
              )
            )
          )}
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-6">
          <p className="text-sm text-blue-700">
            <strong>Note:</strong> You can edit the category name and active status here. To edit other fields like bucket assignments, monthly budgets, and tax settings, please use the Budget page for that specific budget type.
          </p>
        </div>
      </div>
    </div>
  )
}

// Income Source Manager Component
interface IncomeSourceManagerProps {
  incomeSources: any[]
  onAddIncome: (income: any) => void
  onUpdateIncome: (id: string, updates: any) => void
  onDeleteIncome: (id: string) => void
}

function IncomeSourceManager({
  incomeSources,
  onAddIncome,
  onUpdateIncome,
  onDeleteIncome,
}: IncomeSourceManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    budgetType: 'household' as 'household' | 'business',
    incomeType: 'salary' as string,
    clientSource: '',
    expectedAmount: '',
    frequency: 'monthly' as string,
    isActive: true,
  })

  const handleAdd = async () => {
    if (!formData.name.trim()) {
      alert('Please enter an income source name')
      return
    }
    const expectedAmount = formData.expectedAmount ? parseFloat(formData.expectedAmount) : 0
    try {
      await onAddIncome({
        name: formData.name,
        budgetType: formData.budgetType,
        incomeType: formData.incomeType,
        clientSource: formData.clientSource || undefined,
        expectedAmount,
        frequency: formData.frequency,
        isActive: formData.isActive,
      })
      setFormData({ name: '', budgetType: 'household', incomeType: 'salary', clientSource: '', expectedAmount: '', frequency: 'monthly', isActive: true })
      setIsAdding(false)
    } catch (error) {
      console.error('Failed to add income source:', error)
      alert('Failed to add income source. Please check the console for details.')
    }
  }

  const handleEdit = (income: any) => {
    setEditingId(income.id)
    setFormData({
      name: income.name,
      budgetType: income.budgetType,
      incomeType: income.incomeType || 'salary',
      clientSource: income.clientSource || '',
      expectedAmount: income.expectedAmount?.toString() || '',
      frequency: income.frequency || 'monthly',
      isActive: income.isActive !== false,
    })
  }

  const handleUpdate = async () => {
    if (!formData.name.trim()) {
      alert('Please enter an income source name')
      return
    }
    const expectedAmount = formData.expectedAmount ? parseFloat(formData.expectedAmount) : 0
    try {
      await onUpdateIncome(editingId!, {
        name: formData.name,
        budgetType: formData.budgetType,
        incomeType: formData.incomeType,
        clientSource: formData.clientSource || undefined,
        expectedAmount,
        frequency: formData.frequency,
        isActive: formData.isActive,
      })
      setEditingId(null)
      setFormData({ name: '', budgetType: 'household', incomeType: 'salary', clientSource: '', expectedAmount: '', frequency: 'monthly', isActive: true })
    } catch (error) {
      console.error('Failed to update income source:', error)
      alert('Failed to update income source. Please check the console for details.')
    }
  }

  const handleCancel = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormData({ name: '', budgetType: 'household', incomeType: 'salary', clientSource: '', expectedAmount: '', frequency: 'monthly', isActive: true })
  }

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the income source "${name}"?`)) {
      try {
        await onDeleteIncome(id)
      } catch (error) {
        console.error('Failed to delete income source:', error)
        alert('Failed to delete income source. Please check the console for details.')
      }
    }
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Income Sources</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage income sources for both household and business budgets
        </p>
      </div>
      <div className="p-6 space-y-4">
        {/* Income Sources List */}
        <div className="space-y-3">
          {incomeSources.map((income) =>
            editingId === income.id ? (
              <div key={income.id} className="border border-blue-300 rounded-lg p-4 bg-blue-50">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Income Source Name"
                  />
                  <select
                    value={formData.budgetType}
                    onChange={(e) => {
                      const newBudgetType = e.target.value as 'household' | 'business'
                      setFormData({
                        ...formData,
                        budgetType: newBudgetType,
                        incomeType: newBudgetType === 'household' ? 'salary' : 'project-income'
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="household">Household</option>
                    <option value="business">Business</option>
                  </select>
                  <select
                    value={formData.incomeType}
                    onChange={(e) => setFormData({ ...formData, incomeType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {formData.budgetType === 'household' ? (
                      <>
                        <option value="salary">Salary</option>
                        <option value="freelance">Freelance</option>
                        <option value="investment">Investment</option>
                        <option value="rental">Rental</option>
                        <option value="gift">Gift</option>
                        <option value="other">Other</option>
                      </>
                    ) : (
                      <>
                        <option value="project-income">Project Income</option>
                        <option value="service-income">Service Income</option>
                        <option value="product-sales">Product Sales</option>
                        <option value="commission">Commission</option>
                        <option value="other-income">Other Income</option>
                      </>
                    )}
                  </select>
                  {formData.budgetType === 'business' && (
                    <input
                      type="text"
                      value={formData.clientSource}
                      onChange={(e) => setFormData({ ...formData, clientSource: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      placeholder="Client Name (optional)"
                    />
                  )}
                  <input
                    type="number"
                    step="0.01"
                    value={formData.expectedAmount}
                    onChange={(e) => setFormData({ ...formData, expectedAmount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Expected Amount"
                  />
                  <select
                    value={formData.frequency}
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                    <option value="irregular">Irregular</option>
                  </select>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Active</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdate}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div key={income.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                <div>
                  <div className="font-medium text-gray-900">
                    {income.name}
                    {!income.isActive && <span className="ml-2 text-xs text-gray-500">(Inactive)</span>}
                  </div>
                  <div className="text-sm text-gray-500">
                    {income.budgetType === 'household' ? 'Household' : 'Business'}
                    {income.incomeType && ` • ${income.incomeType}`}
                    {income.clientSource && ` • Client: ${income.clientSource}`}
                    {income.expectedAmount && ` • Expected: $${income.expectedAmount.toFixed(2)}`}
                    {income.frequency && ` • ${income.frequency}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(income)}
                    className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(income.id, income.name)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        {/* Add New Form */}
        {isAdding ? (
          <div className="border border-green-300 rounded-lg p-4 bg-green-50">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Income Source</h4>
            <div className="space-y-3">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Income Source Name (e.g., Salary, Freelance)"
              />
              <select
                value={formData.budgetType}
                onChange={(e) => {
                  const newBudgetType = e.target.value as 'household' | 'business'
                  setFormData({
                    ...formData,
                    budgetType: newBudgetType,
                    incomeType: newBudgetType === 'household' ? 'salary' : 'project-income'
                  })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="household">Household</option>
                <option value="business">Business</option>
              </select>
              <select
                value={formData.incomeType}
                onChange={(e) => setFormData({ ...formData, incomeType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {formData.budgetType === 'household' ? (
                  <>
                    <option value="salary">Salary</option>
                    <option value="freelance">Freelance</option>
                    <option value="investment">Investment</option>
                    <option value="rental">Rental</option>
                    <option value="gift">Gift</option>
                    <option value="other">Other</option>
                  </>
                ) : (
                  <>
                    <option value="project-income">Project Income</option>
                    <option value="service-income">Service Income</option>
                    <option value="product-sales">Product Sales</option>
                    <option value="commission">Commission</option>
                    <option value="other-income">Other Income</option>
                  </>
                )}
              </select>
              {formData.budgetType === 'business' && (
                <input
                  type="text"
                  value={formData.clientSource}
                  onChange={(e) => setFormData({ ...formData, clientSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Client Name (optional)"
                />
              )}
              <input
                type="number"
                step="0.01"
                value={formData.expectedAmount}
                onChange={(e) => setFormData({ ...formData, expectedAmount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Expected Amount"
              />
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
                <option value="irregular">Irregular</option>
              </select>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Add Income Source
                </button>
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            + Add Income Source
          </button>
        )}
      </div>
    </div>
  )
}
