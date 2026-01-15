import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type {
  AppData,
  Account,
  Transaction,
  Category,
  IncomeSource,
  AutoCategorizationRule,
  AppSettings,
  BudgetViewType,
  BudgetContextState,
} from '../types'
import StorageService from '../services/storage'
import { generateDefaultCategories } from '../data/defaultCategories'

const BudgetContext = createContext<BudgetContextState | null>(null)

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<BudgetViewType>('household')
  const [appData, setAppDataState] = useState<AppData>(() => {
    // Load data from localStorage on initial render
    const stored = StorageService.load()
    if (stored) {
      return stored
    }
    // Return default data with pre-populated categories
    const defaultData = StorageService.getDefaultData()
    return {
      ...defaultData,
      categories: generateDefaultCategories(),
    }
  })

  // Save to localStorage whenever appData changes
  useEffect(() => {
    StorageService.save(appData)
  }, [appData])

  // Set initial view based on settings
  useEffect(() => {
    setCurrentView(appData.settings.defaultBudgetView)
  }, [appData.settings.defaultBudgetView])

  const setAppData = useCallback((data: AppData) => {
    setAppDataState(data)
  }, [])

  // ============================================================================
  // Account Operations
  // ============================================================================

  const addAccount = useCallback(
    (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newAccount: Account = {
        ...account,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        // Calculate available credit and utilization for credit cards
        availableCredit:
          account.accountType === 'credit_card' && account.creditLimit
            ? account.creditLimit - Math.abs(account.balance)
            : undefined,
        creditUtilization:
          account.accountType === 'credit_card' && account.creditLimit
            ? (Math.abs(account.balance) / account.creditLimit) * 100
            : undefined,
      }

      setAppDataState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, newAccount],
      }))
    },
    []
  )

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    setAppDataState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((account) => {
        if (account.id !== id) return account

        const updated = {
          ...account,
          ...updates,
          updatedAt: new Date().toISOString(),
        }

        // Recalculate credit card fields
        if (updated.accountType === 'credit_card' && updated.creditLimit) {
          updated.availableCredit = updated.creditLimit - Math.abs(updated.balance)
          updated.creditUtilization = (Math.abs(updated.balance) / updated.creditLimit) * 100
        }

        return updated
      }),
    }))
  }, [])

  const deleteAccount = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      // Also delete associated transactions
      transactions: prev.transactions.filter((t) => t.accountId !== id),
    }))
  }, [])

  // ============================================================================
  // Transaction Operations
  // ============================================================================

  const addTransaction = useCallback(
    (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()

      // Auto-categorize if category not provided or is "uncategorized"
      let categoryId = transaction.categoryId
      if (!categoryId || categoryId === 'uncategorized') {
        categoryId = autoCategorizeTransaction(
          transaction.description,
          transaction.budgetType
        )
      }

      // Get bucket from category
      const category = appData.categories.find((c) => c.id === categoryId)
      const bucketId = category?.bucketId

      const newTransaction: Transaction = {
        ...transaction,
        id: generateId(),
        categoryId,
        bucketId,
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        transactions: [...prev.transactions, newTransaction],
      }))

      // Update account balance
      const account = appData.accounts.find((a) => a.id === transaction.accountId)
      if (account) {
        updateAccount(account.id, {
          balance: account.balance + transaction.amount,
        })
      }
    },
    [appData.categories, appData.accounts, updateAccount]
  )

  const autoCategorizeTransaction = (description: string, budgetType: string): string => {
    const lowerDesc = description.toLowerCase()

    // Check active rules first
    for (const rule of appData.autoCategorization) {
      if (!rule.isActive) continue
      if (rule.budgetType !== budgetType && rule.budgetType !== 'both') continue

      const pattern = rule.caseSensitive ? rule.vendorPattern : rule.vendorPattern.toLowerCase()
      const searchIn = rule.caseSensitive ? description : lowerDesc

      if (searchIn.includes(pattern)) {
        return rule.categoryId
      }
    }

    // Check category auto-categorization patterns
    for (const category of appData.categories) {
      if (category.budgetType !== budgetType) continue
      if (!category.isActive) continue

      for (const pattern of category.autoCategorization) {
        const patternStr = pattern.caseSensitive ? pattern.pattern : pattern.pattern.toLowerCase()
        const searchIn = pattern.caseSensitive ? description : lowerDesc

        if (searchIn.includes(patternStr)) {
          return category.id
        }
      }
    }

    // Return uncategorized
    return 'uncategorized'
  }

  const updateTransaction = useCallback(
    (id: string, updates: Partial<Transaction>) => {
      setAppDataState((prev) => {
        const transaction = prev.transactions.find((t) => t.id === id)
        if (!transaction) return prev

        // If amount changed, update account balance
        if (updates.amount !== undefined && updates.amount !== transaction.amount) {
          const account = prev.accounts.find((a) => a.id === transaction.accountId)
          if (account) {
            const diff = updates.amount - transaction.amount
            updateAccount(account.id, {
              balance: account.balance + diff,
            })
          }
        }

        // If category changed, update bucket
        let bucketId = transaction.bucketId
        if (updates.categoryId && updates.categoryId !== transaction.categoryId) {
          const category = prev.categories.find((c) => c.id === updates.categoryId)
          bucketId = category?.bucketId
        }

        return {
          ...prev,
          transactions: prev.transactions.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...updates,
                  bucketId,
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }
      })
    },
    [updateAccount]
  )

  const deleteTransaction = useCallback((id: string) => {
    setAppDataState((prev) => {
      const transaction = prev.transactions.find((t) => t.id === id)
      if (!transaction) return prev

      // Reverse the transaction amount from account balance
      const account = prev.accounts.find((a) => a.id === transaction.accountId)
      if (account) {
        updateAccount(account.id, {
          balance: account.balance - transaction.amount,
        })
      }

      return {
        ...prev,
        transactions: prev.transactions.filter((t) => t.id !== id),
      }
    })
  }, [updateAccount])

  // ============================================================================
  // Category Operations
  // ============================================================================

  const addCategory = useCallback(
    (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newCategory: Category = {
        ...category,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategory],
      }))
    },
    []
  )

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    setAppDataState((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === id
          ? {
              ...cat,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : cat
      ),
    }))
  }, [])

  const deleteCategory = useCallback((id: string) => {
    setAppDataState((prev) => {
      // Check if any transactions use this category
      const hasTransactions = prev.transactions.some((t) => t.categoryId === id)
      if (hasTransactions) {
        // Instead of deleting, just mark as inactive
        return {
          ...prev,
          categories: prev.categories.map((cat) =>
            cat.id === id ? { ...cat, isActive: false, updatedAt: new Date().toISOString() } : cat
          ),
        }
      }

      return {
        ...prev,
        categories: prev.categories.filter((c) => c.id !== id),
      }
    })
  }, [])

  // ============================================================================
  // Income Operations
  // ============================================================================

  const addIncomeSource = useCallback(
    (income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newIncome: IncomeSource = {
        ...income,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        incomeSources: [...prev.incomeSources, newIncome],
      }))
    },
    []
  )

  const updateIncomeSource = useCallback((id: string, updates: Partial<IncomeSource>) => {
    setAppDataState((prev) => ({
      ...prev,
      incomeSources: prev.incomeSources.map((income) =>
        income.id === id
          ? {
              ...income,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : income
      ),
    }))
  }, [])

  const deleteIncomeSource = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      incomeSources: prev.incomeSources.filter((i) => i.id !== id),
    }))
  }, [])

  // ============================================================================
  // Rule Operations
  // ============================================================================

  const addRule = useCallback(
    (rule: Omit<AutoCategorizationRule, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newRule: AutoCategorizationRule = {
        ...rule,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        autoCategorization: [...prev.autoCategorization, newRule],
      }))
    },
    []
  )

  const updateRule = useCallback((id: string, updates: Partial<AutoCategorizationRule>) => {
    setAppDataState((prev) => ({
      ...prev,
      autoCategorization: prev.autoCategorization.map((rule) =>
        rule.id === id
          ? {
              ...rule,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : rule
      ),
    }))
  }, [])

  const deleteRule = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      autoCategorization: prev.autoCategorization.filter((r) => r.id !== id),
    }))
  }, [])

  // ============================================================================
  // Settings Operations
  // ============================================================================

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setAppDataState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...updates,
      },
    }))
  }, [])

  // ============================================================================
  // Data Operations
  // ============================================================================

  const importData = useCallback((data: Partial<AppData>) => {
    setAppDataState((prev) => ({
      ...prev,
      ...data,
      version: prev.version,
    }))
  }, [])

  const exportData = useCallback(() => {
    return appData
  }, [appData])

  const clearAllData = useCallback(() => {
    const defaultData = StorageService.getDefaultData()
    setAppDataState({
      ...defaultData,
      categories: generateDefaultCategories(),
    })
    StorageService.clear()
  }, [])

  const loadSampleData = useCallback(() => {
    // TODO: Implement sample data loading
    console.log('Load sample data - to be implemented')
  }, [])

  const value: BudgetContextState = {
    currentView,
    setCurrentView,
    appData,
    setAppData,
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addIncomeSource,
    updateIncomeSource,
    deleteIncomeSource,
    addRule,
    updateRule,
    deleteRule,
    updateSettings,
    importData,
    exportData,
    clearAllData,
    loadSampleData,
  }

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
}

export function useBudget() {
  const context = useContext(BudgetContext)
  if (!context) {
    throw new Error('useBudget must be used within a BudgetProvider')
  }
  return context
}
