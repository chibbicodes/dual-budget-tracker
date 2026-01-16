import type { AppData, BudgetType } from '../types'

const STORAGE_KEY = 'dual-budget-tracker-data'
const CURRENT_VERSION = '1.0.0'

/**
 * Local storage service for persisting application data
 */
export class StorageService {
  /**
   * Load application data from localStorage
   */
  static load(): AppData | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null

      const data: AppData = JSON.parse(stored)

      // Version migration logic can be added here in the future
      if (data.version !== CURRENT_VERSION) {
        console.warn(`Data version mismatch: ${data.version} vs ${CURRENT_VERSION}`)
        // Perform migrations if needed
      }

      // Ensure new fields exist (migration for backward compatibility)
      if (!data.income) {
        data.income = []
      }

      return data
    } catch (error) {
      console.error('Error loading data from localStorage:', error)
      return null
    }
  }

  /**
   * Save application data to localStorage
   */
  static save(data: AppData): void {
    try {
      const dataToSave = {
        ...data,
        version: CURRENT_VERSION,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave))
    } catch (error) {
      console.error('Error saving data to localStorage:', error)
      throw new Error('Failed to save data. Storage may be full.')
    }
  }

  /**
   * Export all data as JSON string
   */
  static exportAll(data: AppData): string {
    const exportData = {
      ...data,
      version: CURRENT_VERSION,
      exportDate: new Date().toISOString(),
      exportType: 'all',
    }
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Export only Household budget data
   */
  static exportHousehold(data: AppData): string {
    const householdData: Partial<AppData> = {
      accounts: data.accounts.filter((a) => a.budgetType === 'household'),
      transactions: data.transactions.filter((t) => t.budgetType === 'household'),
      categories: data.categories.filter((c) => c.budgetType === 'household'),
      incomeSources: data.incomeSources.filter((i) => i.budgetType === 'household'),
      income: data.income.filter((i) => i.budgetType === 'household'),
      autoCategorization: data.autoCategorization.filter(
        (r) => r.budgetType === 'household' || r.budgetType === 'both'
      ),
      settings: {
        ...data.settings,
        // Include only household-specific settings
        businessTargets: undefined as any,
      },
      version: CURRENT_VERSION,
    }

    const exportData = {
      ...householdData,
      exportDate: new Date().toISOString(),
      exportType: 'household',
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Export only Business budget data
   */
  static exportBusiness(data: AppData): string {
    const businessData: Partial<AppData> = {
      accounts: data.accounts.filter((a) => a.budgetType === 'business'),
      transactions: data.transactions.filter((t) => t.budgetType === 'business'),
      categories: data.categories.filter((c) => c.budgetType === 'business'),
      incomeSources: data.incomeSources.filter((i) => i.budgetType === 'business'),
      income: data.income.filter((i) => i.budgetType === 'business'),
      autoCategorization: data.autoCategorization.filter(
        (r) => r.budgetType === 'business' || r.budgetType === 'both'
      ),
      settings: {
        ...data.settings,
        // Include only business-specific settings
        householdTargets: undefined as any,
      },
      version: CURRENT_VERSION,
    }

    const exportData = {
      ...businessData,
      exportDate: new Date().toISOString(),
      exportType: 'business',
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import data from JSON string
   * @param jsonString - JSON string containing app data
   * @param mergeMode - Whether to merge with existing data or replace
   */
  static import(jsonString: string, mergeMode: 'merge' | 'replace' = 'replace'): AppData {
    try {
      const importedData = JSON.parse(jsonString)

      // Validate imported data structure
      if (!this.isValidAppData(importedData)) {
        throw new Error('Invalid data format')
      }

      if (mergeMode === 'replace') {
        return {
          ...importedData,
          version: CURRENT_VERSION,
        }
      } else {
        // Merge mode: combine imported data with existing
        const existing = this.load() || this.getDefaultData()

        return {
          accounts: [...existing.accounts, ...importedData.accounts],
          transactions: [...existing.transactions, ...importedData.transactions],
          categories: [...existing.categories, ...importedData.categories],
          incomeSources: [...existing.incomeSources, ...(importedData.incomeSources || [])],
          income: [...existing.income, ...(importedData.income || [])],
          autoCategorization: [
            ...existing.autoCategorization,
            ...(importedData.autoCategorization || []),
          ],
          settings: importedData.settings || existing.settings,
          version: CURRENT_VERSION,
        }
      }
    } catch (error) {
      console.error('Error importing data:', error)
      throw new Error('Failed to import data. Invalid JSON format.')
    }
  }

  /**
   * Validate app data structure
   */
  private static isValidAppData(data: any): data is AppData {
    return (
      data &&
      Array.isArray(data.accounts) &&
      Array.isArray(data.transactions) &&
      Array.isArray(data.categories) &&
      Array.isArray(data.incomeSources) &&
      Array.isArray(data.autoCategorization) &&
      typeof data.settings === 'object'
    )
  }

  /**
   * Get default empty application data
   */
  static getDefaultData(): AppData {
    return {
      accounts: [],
      transactions: [],
      categories: [],
      incomeSources: [],
      income: [],
      autoCategorization: [],
      settings: {
        defaultBudgetView: 'household',
        householdTargets: {
          needsPercentage: 50,
          wantsPercentage: 30,
          savingsPercentage: 20,
          monthlyIncomeBaseline: 0,
        },
        businessTargets: {
          operatingPercentage: 50,
          growthPercentage: 20,
          compensationPercentage: 20,
          taxReservePercentage: 5,
          businessSavingsPercentage: 5,
          monthlyRevenueBaseline: 0,
        },
        dateFormat: 'MM/dd/yyyy',
        currencySymbol: '$',
        firstRunCompleted: false,
        trackBusiness: true,
        trackHousehold: true,
      },
      version: CURRENT_VERSION,
    }
  }

  /**
   * Clear all data from localStorage
   */
  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('Error clearing localStorage:', error)
    }
  }

  /**
   * Download data as a JSON file
   */
  static downloadJSON(data: string, filename: string): void {
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Read JSON file from user upload
   */
  static readJSONFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const content = e.target?.result
        if (typeof content === 'string') {
          resolve(content)
        } else {
          reject(new Error('Failed to read file'))
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsText(file)
    })
  }

  /**
   * Clear data for specific budget type
   */
  static clearBudgetType(data: AppData, budgetType: BudgetType): AppData {
    return {
      ...data,
      accounts: data.accounts.filter((a) => a.budgetType !== budgetType),
      transactions: data.transactions.filter((t) => t.budgetType !== budgetType),
      categories: data.categories.filter((c) => c.budgetType !== budgetType),
      incomeSources: data.incomeSources.filter((i) => i.budgetType !== budgetType),
      income: data.income.filter((i) => i.budgetType !== budgetType),
      autoCategorization: data.autoCategorization.filter(
        (r) => r.budgetType !== budgetType && r.budgetType !== 'both'
      ),
    }
  }
}

export default StorageService
