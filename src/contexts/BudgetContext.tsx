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
  Project,
  ProjectTypeConfig,
  ProjectStatusConfig,
} from '../types'
import StorageService from '../services/storage'
import ProfileService from '../services/profileService'
import { databaseService } from '../services/database/databaseService'
import { generateDefaultCategories } from '../data/defaultCategories'

const BudgetContext = createContext<BudgetContextState | null>(null)

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<BudgetViewType>('household')
  const [appData, setAppDataState] = useState<AppData>(() => {
    // Load data from active profile
    const activeProfile = ProfileService.getActiveProfile()

    if (activeProfile) {
      const stored = ProfileService.loadProfileData(activeProfile.id)
      if (stored) {
        return stored
      }
    }

    // Fallback: Return default data with pre-populated categories
    const defaultData = StorageService.getDefaultData()
    return {
      ...defaultData,
      categories: generateDefaultCategories(),
    }
  })

  // Note: Individual operations now write directly to SQLite database
  // No need for auto-save useEffect

  // Helper to get current profile ID
  const getProfileId = useCallback((): string | null => {
    const activeProfile = ProfileService.getActiveProfile()
    return activeProfile?.id || null
  }, [])

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
      const profileId = getProfileId()
      if (!profileId) return

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

      // Save to database
      try {
        databaseService.createAccount({
          id: newAccount.id,
          profile_id: profileId,
          name: newAccount.name,
          budget_type: newAccount.budgetType,
          account_type: newAccount.accountType,
          balance: newAccount.balance,
          interest_rate: newAccount.interestRate,
          credit_limit: newAccount.creditLimit,
          payment_due_date: newAccount.paymentDueDate,
          minimum_payment: newAccount.minimumPayment,
          website_url: newAccount.websiteUrl,
          notes: newAccount.notes,
        })
      } catch (error) {
        console.error('Failed to save account to database:', error)
      }

      // Update local state
      setAppDataState((prev) => ({
        ...prev,
        accounts: [...prev.accounts, newAccount],
      }))
    },
    [getProfileId]
  )

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    // Save to database
    try {
      const dbUpdates: Record<string, any> = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.balance !== undefined) dbUpdates.balance = updates.balance
      if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
      if (updates.accountType !== undefined) dbUpdates.account_type = updates.accountType
      if (updates.interestRate !== undefined) dbUpdates.interest_rate = updates.interestRate
      if (updates.creditLimit !== undefined) dbUpdates.credit_limit = updates.creditLimit
      if (updates.paymentDueDate !== undefined) dbUpdates.payment_due_date = updates.paymentDueDate
      if (updates.minimumPayment !== undefined) dbUpdates.minimum_payment = updates.minimumPayment
      if (updates.websiteUrl !== undefined) dbUpdates.website_url = updates.websiteUrl
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes

      databaseService.updateAccount(id, dbUpdates)
    } catch (error) {
      console.error('Failed to update account in database:', error)
    }

    // Update local state
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
    // Delete from database
    try {
      databaseService.deleteAccount(id)
      // Note: Transactions will be handled by database foreign key constraints or need separate deletion
    } catch (error) {
      console.error('Failed to delete account from database:', error)
    }

    // Update local state
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
      const profileId = getProfileId()
      if (!profileId) return

      const now = new Date().toISOString()
      const newCategory: Category = {
        ...category,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        databaseService.createCategory({
          id: newCategory.id,
          profile_id: profileId,
          name: newCategory.name,
          budget_type: newCategory.budgetType,
          bucket_id: newCategory.bucketId,
          category_group: newCategory.categoryGroup,
          monthly_budget: newCategory.monthlyBudget,
          is_fixed_expense: newCategory.isFixedExpense ? 1 : 0,
          is_active: newCategory.isActive !== false ? 1 : 0,
          tax_deductible_by_default: newCategory.taxDeductibleByDefault ? 1 : 0,
          is_income_category: newCategory.isIncomeCategory ? 1 : 0,
          exclude_from_budget: newCategory.excludeFromBudget ? 1 : 0,
          icon: newCategory.icon,
        })
      } catch (error) {
        console.error('Failed to save category to database:', error)
      }

      // Update local state
      setAppDataState((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategory],
      }))
    },
    [getProfileId]
  )

  const updateCategory = useCallback((id: string, updates: Partial<Category>) => {
    // Save to database
    try {
      const dbUpdates: Record<string, any> = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
      if (updates.bucketId !== undefined) dbUpdates.bucket_id = updates.bucketId
      if (updates.categoryGroup !== undefined) dbUpdates.category_group = updates.categoryGroup
      if (updates.monthlyBudget !== undefined) dbUpdates.monthly_budget = updates.monthlyBudget
      if (updates.isFixedExpense !== undefined) dbUpdates.is_fixed_expense = updates.isFixedExpense ? 1 : 0
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive ? 1 : 0
      if (updates.taxDeductibleByDefault !== undefined) dbUpdates.tax_deductible_by_default = updates.taxDeductibleByDefault ? 1 : 0
      if (updates.isIncomeCategory !== undefined) dbUpdates.is_income_category = updates.isIncomeCategory ? 1 : 0
      if (updates.excludeFromBudget !== undefined) dbUpdates.exclude_from_budget = updates.excludeFromBudget ? 1 : 0
      if (updates.icon !== undefined) dbUpdates.icon = updates.icon

      databaseService.updateCategory(id, dbUpdates)
    } catch (error) {
      console.error('Failed to update category in database:', error)
    }

    // Update local state
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
        // Instead of deleting, just mark as inactive in database
        try {
          databaseService.updateCategory(id, { is_active: 0 })
        } catch (error) {
          console.error('Failed to deactivate category in database:', error)
        }

        // Update local state
        return {
          ...prev,
          categories: prev.categories.map((cat) =>
            cat.id === id ? { ...cat, isActive: false, updatedAt: new Date().toISOString() } : cat
          ),
        }
      }

      // Delete from database
      try {
        databaseService.deleteCategory(id)
      } catch (error) {
        console.error('Failed to delete category from database:', error)
      }

      // Update local state
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
  // Project Operations
  // ============================================================================

  const addProject = useCallback(
    (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newProject: Project = {
        ...project,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        projects: [...prev.projects, newProject],
      }))
    },
    []
  )

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setAppDataState((prev) => ({
      ...prev,
      projects: prev.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : project
      ),
    }))
  }, [])

  const deleteProject = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      // Also remove projectId from transactions that reference this project
      transactions: prev.transactions.map((t) =>
        t.projectId === id ? { ...t, projectId: undefined } : t
      ),
    }))
  }, [])

  // ============================================================================
  // Project Type Operations
  // ============================================================================

  const addProjectType = useCallback(
    (projectType: Omit<ProjectTypeConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newProjectType: ProjectTypeConfig = {
        ...projectType,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        projectTypes: [...prev.projectTypes, newProjectType],
      }))
    },
    []
  )

  const updateProjectType = useCallback((id: string, updates: Partial<ProjectTypeConfig>) => {
    setAppDataState((prev) => ({
      ...prev,
      projectTypes: prev.projectTypes.map((type) =>
        type.id === id
          ? {
              ...type,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : type
      ),
    }))
  }, [])

  const deleteProjectType = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      projectTypes: prev.projectTypes.filter((t) => t.id !== id),
      // Note: We don't delete projects using this type, as they should remain for historical records
    }))
  }, [])

  // ============================================================================
  // Project Status Operations
  // ============================================================================

  const addProjectStatus = useCallback(
    (status: Omit<ProjectStatusConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Date().toISOString()
      const newStatus: ProjectStatusConfig = {
        ...status,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      setAppDataState((prev) => ({
        ...prev,
        projectStatuses: [...prev.projectStatuses, newStatus],
      }))
    },
    []
  )

  const updateProjectStatus = useCallback((id: string, updates: Partial<ProjectStatusConfig>) => {
    setAppDataState((prev) => ({
      ...prev,
      projectStatuses: prev.projectStatuses.map((status) =>
        status.id === id
          ? {
              ...status,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : status
      ),
    }))
  }, [])

  const deleteProjectStatus = useCallback((id: string) => {
    setAppDataState((prev) => ({
      ...prev,
      projectStatuses: prev.projectStatuses.filter((s) => s.id !== id),
      // Note: We don't update projects using this status, as they should remain for historical records
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
    const profileId = getProfileId()
    if (profileId) {
      // Save to database
      try {
        const dbUpdates: Record<string, any> = {}
        if (updates.defaultBudgetView !== undefined) dbUpdates.default_budget_view = updates.defaultBudgetView
        if (updates.dateFormat !== undefined) dbUpdates.date_format = updates.dateFormat
        if (updates.currencySymbol !== undefined) dbUpdates.currency_symbol = updates.currencySymbol
        if (updates.firstRunCompleted !== undefined) dbUpdates.first_run_completed = updates.firstRunCompleted ? 1 : 0
        if (updates.trackBusiness !== undefined) dbUpdates.track_business = updates.trackBusiness ? 1 : 0
        if (updates.trackHousehold !== undefined) dbUpdates.track_household = updates.trackHousehold ? 1 : 0
        if (updates.householdNeedsPercentage !== undefined) dbUpdates.household_needs_percentage = updates.householdNeedsPercentage
        if (updates.householdWantsPercentage !== undefined) dbUpdates.household_wants_percentage = updates.householdWantsPercentage
        if (updates.householdSavingsPercentage !== undefined) dbUpdates.household_savings_percentage = updates.householdSavingsPercentage
        if (updates.householdMonthlyIncomeBaseline !== undefined) dbUpdates.household_monthly_income_baseline = updates.householdMonthlyIncomeBaseline
        if (updates.businessOperatingPercentage !== undefined) dbUpdates.business_operating_percentage = updates.businessOperatingPercentage
        if (updates.businessGrowthPercentage !== undefined) dbUpdates.business_growth_percentage = updates.businessGrowthPercentage
        if (updates.businessCompensationPercentage !== undefined) dbUpdates.business_compensation_percentage = updates.businessCompensationPercentage
        if (updates.businessTaxReservePercentage !== undefined) dbUpdates.business_tax_reserve_percentage = updates.businessTaxReservePercentage
        if (updates.businessSavingsPercentage !== undefined) dbUpdates.business_savings_percentage = updates.businessSavingsPercentage
        if (updates.businessMonthlyRevenueBaseline !== undefined) dbUpdates.business_monthly_revenue_baseline = updates.businessMonthlyRevenueBaseline

        databaseService.updateSettings(profileId, dbUpdates)
      } catch (error) {
        console.error('Failed to update settings in database:', error)
      }
    }

    // Update local state
    setAppDataState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...updates,
      },
    }))
  }, [getProfileId])

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
    addProject,
    updateProject,
    deleteProject,
    addProjectType,
    updateProjectType,
    deleteProjectType,
    addProjectStatus,
    updateProjectStatus,
    deleteProjectStatus,
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
