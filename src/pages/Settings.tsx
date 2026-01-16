import { useState } from 'react'
import { useBudget } from '../contexts/BudgetContext'
import StorageService from '../services/storage'
import { Download, Upload, Trash2, AlertTriangle, Settings as SettingsIcon } from 'lucide-react'
import type { BudgetType } from '../types'

type Tab = 'data' | 'preferences' | 'categories'

export default function Settings() {
  const { appData, updateSettings, clearAllData, importData } = useBudget()
  const [activeTab, setActiveTab] = useState<Tab>('data')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

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

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
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
        </nav>
      </div>

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
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Category Management</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage your budget categories from the Budget page for each budget type
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Household Categories</h4>
                <p className="text-sm text-gray-600 mb-2">
                  {appData.categories.filter((c) => c.budgetType === 'household').length} categories
                </p>
                <p className="text-sm text-gray-500">
                  View and edit categories from the Budget page in Household view
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Business Categories</h4>
                <p className="text-sm text-gray-600 mb-2">
                  {appData.categories.filter((c) => c.budgetType === 'business').length} categories
                </p>
                <p className="text-sm text-gray-500">
                  View and edit categories from the Budget page in Business view
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
