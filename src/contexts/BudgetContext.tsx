import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type {
  AppData,
  Account,
  Transaction,
  Category,
  IncomeSource,
  Income,
  AutoCategorizationRule,
  AppSettings,
  BudgetViewType,
  BudgetContextState,
  MonthlyBudget,
  BucketId,
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
    (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { linkingOption?: string }) => {
      const now = new Date().toISOString()

      // Extract linking option
      const linkingOption = (transaction as any).linkingOption || 'create_paired'
      const transactionWithoutLinking = { ...transaction }
      delete (transactionWithoutLinking as any).linkingOption

      // Auto-categorize if category not provided or is "uncategorized"
      let categoryId = transactionWithoutLinking.categoryId
      if (!categoryId || categoryId === 'uncategorized') {
        categoryId = autoCategorizeTransaction(
          transactionWithoutLinking.description,
          transactionWithoutLinking.budgetType
        )
      }

      // Get bucket from category
      const category = appData.categories.find((c) => c.id === categoryId)
      const bucketId = category?.bucketId

      // Generate IDs upfront for linking
      const mainTransactionId = generateId()
      const pairedTransactionId = generateId()

      const newTransaction: Transaction = {
        ...transactionWithoutLinking,
        id: mainTransactionId,
        categoryId,
        bucketId,
        reconciled: transactionWithoutLinking.reconciled ?? false,
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => {
        const transactions = [...prev.transactions, newTransaction]
        let accounts = prev.accounts

        // Update source account balance
        const sourceAccount = accounts.find((a) => a.id === transactionWithoutLinking.accountId)
        if (sourceAccount) {
          accounts = accounts.map((a) =>
            a.id === sourceAccount.id
              ? { ...a, balance: a.balance + transactionWithoutLinking.amount, updatedAt: now }
              : a
          )
        }

        // Handle transfer linking
        if (transactionWithoutLinking.toAccountId) {
          const destAccount = accounts.find((a) => a.id === transactionWithoutLinking.toAccountId)
          if (destAccount) {
            if (linkingOption === 'create_paired') {
              // Find the category for the paired transaction (should match budget type)
              let pairedCategoryId = categoryId
              let pairedBucketId = bucketId

              // If the category doesn't match the destination budget type, try to find a matching Transfer/Payment category
              const pairedCategory = appData.categories.find(c => c.id === categoryId && c.budgetType === destAccount.budgetType)
              if (!pairedCategory) {
                // Look for Transfer/Payment category in destination budget
                const transferCategory = appData.categories.find(
                  c => c.name === 'Transfer/Payment' && c.budgetType === destAccount.budgetType
                )
                if (transferCategory) {
                  pairedCategoryId = transferCategory.id
                  pairedBucketId = transferCategory.bucketId
                }
              }

              // Create paired transaction and link both
              const depositTransaction: Transaction = {
                ...transactionWithoutLinking,
                id: pairedTransactionId,
                accountId: transactionWithoutLinking.toAccountId,
                amount: Math.abs(transactionWithoutLinking.amount), // Positive amount for deposit
                categoryId: pairedCategoryId,
                bucketId: pairedBucketId,
                budgetType: destAccount.budgetType,
                toAccountId: undefined, // Don't create circular reference
                linkedTransactionId: mainTransactionId, // Link to source transaction
                reconciled: transactionWithoutLinking.reconciled ?? false,
                description: transactionWithoutLinking.description || 'Transfer from ' + sourceAccount?.name,
                createdAt: now,
                updatedAt: now,
              }
              transactions.push(depositTransaction)

              // Update main transaction to link to paired transaction
              const mainTxIndex = transactions.findIndex(t => t.id === mainTransactionId)
              if (mainTxIndex >= 0) {
                transactions[mainTxIndex] = {
                  ...transactions[mainTxIndex],
                  linkedTransactionId: pairedTransactionId,
                }
              }

              // Update destination account balance
              accounts = accounts.map((a) =>
                a.id === destAccount.id
                  ? { ...a, balance: a.balance + Math.abs(transactionWithoutLinking.amount), updatedAt: now }
                  : a
              )
            } else if (linkingOption === 'link_existing' && transactionWithoutLinking.linkedTransactionId) {
              // Link to existing transaction - update both
              const existingTx = prev.transactions.find(t => t.id === transactionWithoutLinking.linkedTransactionId)
              if (existingTx) {
                // Update existing transaction to link back
                const existingTxIndex = transactions.findIndex(t => t.id === existingTx.id)
                if (existingTxIndex >= 0) {
                  transactions[existingTxIndex] = {
                    ...transactions[existingTxIndex],
                    linkedTransactionId: mainTransactionId,
                    updatedAt: now,
                  }
                }
              }
            }
            // If linkingOption is 'no_link', don't create paired transaction (no balance update for dest account)
          }
        }

        return {
          ...prev,
          transactions,
          accounts,
        }
      })
    },
    [appData.categories, appData.accounts]
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
  // Legacy Income Operations
  // ============================================================================

  const addIncome = useCallback(
    (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newIncome: Income = {
        ...income,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        income: [...prev.income, newIncome],
      }))
    },
    []
  )

  const updateIncome = useCallback((id: string, updates: Partial<Income>) => {
    setAppDataState((prev) => ({
      ...prev,
      income: prev.income.map((income) =>
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

  const deleteIncome = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      income: prev.income.filter((i) => i.id !== id),
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
  // Monthly Budget Operations
  // ============================================================================

  const addMonthlyBudget = useCallback(
    (budget: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newBudget: MonthlyBudget = {
        ...budget,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        monthlyBudgets: [...prev.monthlyBudgets, newBudget],
      }))
    },
    []
  )

  const updateMonthlyBudget = useCallback((id: string, updates: Partial<MonthlyBudget>) => {
    setAppDataState((prev) => ({
      ...prev,
      monthlyBudgets: prev.monthlyBudgets.map((budget) =>
        budget.id === id
          ? {
              ...budget,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : budget
      ),
    }))
  }, [])

  const deleteMonthlyBudget = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      monthlyBudgets: prev.monthlyBudgets.filter((b) => b.id !== id),
    }))
  }, [])

  const getMonthlyBudget = useCallback((month: string, categoryId: string) => {
    return appData.monthlyBudgets.find(
      (b) => b.month === month && b.categoryId === categoryId
    )
  }, [appData.monthlyBudgets])

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

  const addMissingDefaultCategories = useCallback(() => {
    const defaultCategories = generateDefaultCategories()
    const existingCategoryKeys = new Set(
      appData.categories.map((c) => `${c.name}|${c.budgetType}`)
    )

    const missingCategories = defaultCategories.filter((defaultCat) => {
      const key = `${defaultCat.name}|${defaultCat.budgetType}`
      return !existingCategoryKeys.has(key)
    })

    let addedCount = 0
    let reactivatedCount = 0

    setAppDataState((prev) => {
      const updatedCategories = prev.categories.map((category) => {
        // Reactivate any deactivated income categories or transfer categories
        if ((category.isIncomeCategory || category.excludeFromBudget) && !category.isActive) {
          reactivatedCount++
          return { ...category, isActive: true }
        }
        return category
      })

      if (missingCategories.length > 0) {
        addedCount = missingCategories.length
        return {
          ...prev,
          categories: [...updatedCategories, ...missingCategories],
        }
      }

      if (reactivatedCount > 0) {
        return {
          ...prev,
          categories: updatedCategories,
        }
      }

      return prev
    })

    return addedCount + reactivatedCount
  }, [appData.categories])

  const cleanupOldBusinessExpenseCategories = useCallback(() => {
    // List of the 34 tailored category names that should remain active
    const tailoredCategoryNames = [
      // Travel & Performance (7)
      'Travel - Airfare',
      'Travel - Lodging',
      'Travel - Meals',
      'Travel - Transportation (rental, taxi, etc)',
      'Mileage & Vehicle Expenses',
      'Speaking Engagement Fees',
      'Performance Equipment & Gear',
      // Craft Business (5)
      'Craft Supplies & Materials',
      'Packaging & Labels',
      'Shipping & Postage',
      'Booth/Vendor Fees',
      'Event Registration Fees',
      // Online & Marketing (4)
      'Website & Online Store Fees',
      'Marketing & Advertising',
      'Business Cards & Promotional Materials',
      'Photography & Media',
      // Professional Services (5)
      'Software & Subscriptions',
      'Professional Development',
      'Workshops & Classes',
      'Licenses & Permits',
      'Insurance',
      // Administrative (6)
      'Bank & Merchant Fees',
      'Office Supplies',
      'Internet & Phone',
      'Accounting & Bookkeeping',
      'Legal & Professional Services',
      'Taxes & Compliance',
      'Other Business Expenses',
      // Personnel (7)
      'Owner Salary/Draw',
      'Owner Health Insurance',
      'Owner Retirement Contributions',
      'Contractor Payments',
      'Employee Wages',
      'Payroll Taxes',
      'Employee Benefits',
    ]

    // Valid new bucket IDs
    const validBucketIds = [
      'travel_performance',
      'craft_business',
      'online_marketing',
      'professional_services',
      'administrative',
      'personnel',
    ]

    let deactivatedCount = 0

    setAppDataState((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => {
        // Skip income categories and transfer categories - never deactivate these
        if (category.isIncomeCategory || category.excludeFromBudget) {
          return category
        }

        // Process ALL active business categories
        if (category.budgetType === 'business' && category.isActive) {
          // Deactivate if it's in an old bucket (Operating, Growth, Compensation, etc.)
          if (!validBucketIds.includes(category.bucketId as any)) {
            deactivatedCount++
            return {
              ...category,
              isActive: false,
            }
          }
          // Or if it's in a valid bucket but not in the tailored list
          if (validBucketIds.includes(category.bucketId as any) && !tailoredCategoryNames.includes(category.name)) {
            deactivatedCount++
            return {
              ...category,
              isActive: false,
            }
          }
        }
        return category
      }),
    }))

    return deactivatedCount
  }, [appData.categories])

  const addCategoryGroupsToBusinessExpenses = useCallback(() => {
    // Map of category names to their new bucket IDs
    // This migrates old business_expenses categories to the new bucket structure
    const categoryBucketMap: { [name: string]: string } = {
      // Travel & Performance
      'Travel - Airfare': 'travel_performance',
      'Travel - Lodging': 'travel_performance',
      'Travel - Meals': 'travel_performance',
      'Travel - Transportation (rental, taxi, etc)': 'travel_performance',
      'Mileage & Vehicle Expenses': 'travel_performance',
      'Speaking Engagement Fees': 'travel_performance',
      'Performance Equipment & Gear': 'travel_performance',
      // Craft Business
      'Craft Supplies & Materials': 'craft_business',
      'Packaging & Labels': 'craft_business',
      'Shipping & Postage': 'craft_business',
      'Booth/Vendor Fees': 'craft_business',
      'Event Registration Fees': 'craft_business',
      // Online & Marketing
      'Website & Online Store Fees': 'online_marketing',
      'Marketing & Advertising': 'online_marketing',
      'Business Cards & Promotional Materials': 'online_marketing',
      'Photography & Media': 'online_marketing',
      // Professional Services
      'Software & Subscriptions': 'professional_services',
      'Professional Development': 'professional_services',
      'Workshops & Classes': 'professional_services',
      'Licenses & Permits': 'professional_services',
      'Insurance': 'professional_services',
      // Administrative
      'Bank & Merchant Fees': 'administrative',
      'Office Supplies': 'administrative',
      'Internet & Phone': 'administrative',
      'Accounting & Bookkeeping': 'administrative',
      'Legal & Professional Services': 'administrative',
      'Taxes & Compliance': 'administrative',
      'Other Business Expenses': 'administrative',
      // Personnel
      'Owner Salary/Draw': 'personnel',
      'Owner Health Insurance': 'personnel',
      'Owner Retirement Contributions': 'personnel',
      'Contractor Payments': 'personnel',
      'Employee Wages': 'personnel',
      'Payroll Taxes': 'personnel',
      'Employee Benefits': 'personnel',
    }

    let updatedCount = 0

    setAppDataState((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => {
        // Migrate old business_expenses categories to new bucket IDs
        if (
          category.budgetType === 'business' &&
          category.bucketId === 'business_expenses' &&
          categoryBucketMap[category.name]
        ) {
          updatedCount++
          const newCategory = {
            ...category,
            bucketId: categoryBucketMap[category.name] as BucketId,
          }
          // Remove categoryGroup if it exists (no longer used)
          delete (newCategory as any).categoryGroup
          return newCategory
        }
        return category
      }),
    }))

    return updatedCount
  }, [appData.categories])

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
    addIncome,
    updateIncome,
    deleteIncome,
    addRule,
    updateRule,
    deleteRule,
    addMonthlyBudget,
    updateMonthlyBudget,
    deleteMonthlyBudget,
    getMonthlyBudget,
    updateSettings,
    importData,
    exportData,
    clearAllData,
    loadSampleData,
    addMissingDefaultCategories,
    cleanupOldBusinessExpenseCategories,
    addCategoryGroupsToBusinessExpenses,
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
