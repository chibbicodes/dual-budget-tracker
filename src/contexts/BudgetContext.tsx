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
import { databaseService } from '../services/database/databaseClient'
import { generateDefaultCategories } from '../data/defaultCategories'
import { syncService } from '../services/syncService'
import {
  convertDbAccount,
  convertDbTransaction,
  convertDbCategory,
  convertDbIncomeSource,
  convertDbProject,
  convertDbProjectType,
  convertDbProjectStatus,
  convertDbSettings,
  convertDbMonthlyBudget,
} from '../services/dataConverters'

const BudgetContext = createContext<BudgetContextState | null>(null)

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function BudgetProvider({ children }: { children: React.ReactNode }) {
  const [currentView, setCurrentView] = useState<BudgetViewType>('household')
  const [appData, setAppDataState] = useState<AppData>(() => {
    // Initialize with default data - actual data will be loaded in useEffect
    const defaultData = StorageService.getDefaultData()
    return {
      ...defaultData,
      categories: generateDefaultCategories(),
    }
  })
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)

  // Load profile data on mount
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        console.log('Loading profile data...')
        const activeProfile = await ProfileService.getActiveProfile()

        if (!activeProfile) {
          console.log('No active profile found')
          return
        }

        console.log('Active profile:', activeProfile.id, activeProfile.name)
        setActiveProfileId(activeProfile.id)

        // Load data from database with proper conversion (load local first)
        console.log('Loading database records...')
        const settings = await databaseService.getSettings(activeProfile.id)
        const accounts = await databaseService.getAccounts(activeProfile.id)
        let categories = await databaseService.getCategories(activeProfile.id)
        const transactions = await databaseService.getTransactions(activeProfile.id)
        const incomeSources = await databaseService.getIncomeSources(activeProfile.id)
        const monthlyBudgets = await databaseService.getMonthlyBudgets(activeProfile.id)
        const projects = await databaseService.getProjects(activeProfile.id)
        let projectTypes = await databaseService.getProjectTypes(activeProfile.id)
        let projectStatuses = await databaseService.getProjectStatuses(activeProfile.id)

        console.log('Loaded records:', {
          accounts: accounts?.length || 0,
          categories: categories?.length || 0,
          transactions: transactions?.length || 0,
          incomeSources: incomeSources?.length || 0,
          monthlyBudgets: monthlyBudgets?.length || 0,
          projects: projects?.length || 0,
          projectTypes: projectTypes?.length || 0,
          projectStatuses: projectStatuses?.length || 0,
        })

          // Initialize default categories if none exist
          if (!categories || categories.length === 0) {
            console.log('No categories found, initializing default categories...')
            const defaultCategories = generateDefaultCategories()

            // Save each default category to database
            for (const category of defaultCategories) {
              try {
                await databaseService.createCategory({
                  id: category.id,
                  profile_id: activeProfile.id,
                  name: category.name,
                  budget_type: category.budgetType,
                  bucket_id: category.bucketId,
                  category_group: category.categoryGroup,
                  monthly_budget: category.monthlyBudget,
                  is_fixed_expense: category.isFixedExpense ? 1 : 0,
                  is_active: category.isActive !== false ? 1 : 0,
                  tax_deductible_by_default: category.taxDeductibleByDefault ? 1 : 0,
                  is_income_category: category.isIncomeCategory ? 1 : 0,
                  exclude_from_budget: category.excludeFromBudget ? 1 : 0,
                  icon: category.icon,
                })
              } catch (error: any) {
                // Ignore UNIQUE constraint errors - means it already exists
                if (!error.message?.includes('UNIQUE constraint')) {
                  console.error('Failed to create default category:', category.name, error)
                }
              }
            }

            // Reload categories from database
            categories = await databaseService.getCategories(activeProfile.id)
            console.log(`Initialized ${categories?.length || 0} default categories`)
          }

          // Initialize default project statuses first (needed for project types)
          if (!projectStatuses || projectStatuses.length === 0) {
            console.log('No project statuses found, initializing defaults...')
            const defaultProjectStatuses = [
              { id: 'planned', name: 'Planned', description: 'Project is planned but not started' },
              { id: 'in-progress', name: 'In Progress', description: 'Project is currently being worked on' },
              { id: 'completed', name: 'Completed', description: 'Project has been completed' },
              { id: 'cancelled', name: 'Cancelled', description: 'Project was cancelled' },
            ]

            for (const status of defaultProjectStatuses) {
              try {
                await databaseService.createProjectStatus({
                  id: status.id,
                  profile_id: activeProfile.id,
                  name: status.name,
                  description: status.description,
                })
              } catch (error: any) {
                // Ignore UNIQUE constraint errors - means it already exists
                if (!error.message?.includes('UNIQUE constraint')) {
                  console.error('Failed to create default project status:', status.name, error)
                }
              }
            }

            projectStatuses = await databaseService.getProjectStatuses(activeProfile.id)
          }

          // Initialize default project types with valid status IDs
          if (!projectTypes || projectTypes.length === 0) {
            console.log('No project types found, initializing defaults...')

            // Get all available status IDs
            const allStatusIds = (projectStatuses || []).map(s => s.id)

            const defaultProjectTypes = [
              { id: 'speaking', name: 'Speaking Engagement', budgetType: 'business', allowedStatuses: allStatusIds },
              { id: 'craft', name: 'Craft Project', budgetType: 'business', allowedStatuses: allStatusIds },
              { id: 'household', name: 'Household Project', budgetType: 'household', allowedStatuses: allStatusIds },
            ]

            for (const type of defaultProjectTypes) {
              try {
                await databaseService.createProjectType({
                  id: type.id,
                  profile_id: activeProfile.id,
                  name: type.name,
                  budget_type: type.budgetType as any,
                  allowed_statuses: type.allowedStatuses,
                })
              } catch (error: any) {
                // Ignore UNIQUE constraint errors - means it already exists
                if (!error.message?.includes('UNIQUE constraint')) {
                  console.error('Failed to create default project type:', type.name, error)
                }
              }
            }

            projectTypes = await databaseService.getProjectTypes(activeProfile.id)
          } else {
            // Update existing project types if they have empty allowed_statuses
            const allStatusIds = (projectStatuses || []).map(s => s.id)
            for (const type of projectTypes) {
              if (!type.allowed_statuses || type.allowed_statuses === '[]' ||
                  (Array.isArray(type.allowed_statuses) && type.allowed_statuses.length === 0)) {
                try {
                  await databaseService.updateProjectType(type.id, {
                    allowed_statuses: allStatusIds,
                  })
                } catch (error: any) {
                  console.error('Failed to update project type allowed statuses:', type.name, error)
                }
              }
            }
            // Reload project types after updates
            projectTypes = await databaseService.getProjectTypes(activeProfile.id)
          }

          // Convert database records to AppData format
          console.log('Converting database records to AppData format...')
          const appData: AppData = {
            settings: settings ? convertDbSettings(settings) : StorageService.getDefaultData().settings,
            accounts: (accounts || []).map(convertDbAccount),
            transactions: (transactions || []).map(convertDbTransaction),
            categories: (categories || []).map(convertDbCategory),
            incomeSources: (incomeSources || []).map(convertDbIncomeSource),
            income: [], // Legacy income array (not used)
            autoCategorization: [], // TODO: Load from database if needed
            monthlyBudgets: (monthlyBudgets || []).map(convertDbMonthlyBudget),
            projects: (projects || []).map(convertDbProject),
            projectTypes: (projectTypes || []).map(convertDbProjectType),
            projectStatuses: (projectStatuses || []).map(convertDbProjectStatus),
            version: '1.0.0',
          }

          console.log('Setting app data state with converted records...')
          setAppDataState(appData)
          console.log('Profile data loaded successfully!')

          // NOTE: We don't automatically sync on app load to give users control over
          // when cloud sync happens. Users should explicitly click the sync button
          // when they want to sync with the cloud.
          // Soft deletes are now implemented so deletions will sync properly across devices.

          // Start auto-sync if enabled
          const autoSyncEnabled = syncService.getAutoSyncEnabled()
          if (autoSyncEnabled && !syncService.isAutoSyncRunning()) {
            syncService.startAutoSync(activeProfile.id, 5) // Sync every 5 minutes
          }
      } catch (error) {
        console.error('CRITICAL ERROR: Failed to load profile data:', error)
        // Show error to user
        alert('Failed to load profile data. Please check the console for details and restart the app.')
      }
    }

    loadProfileData()

    // Cleanup on unmount
    return () => {
      syncService.stopAutoSync()
    }
  }, [])

  // Note: Individual operations now write directly to SQLite database
  // No need for auto-save useEffect

  // Helper to get current profile ID
  const getProfileId = useCallback((): string | null => {
    return activeProfileId
  }, [activeProfileId])

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
          last_payment_month: newAccount.lastPaymentMonth,
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
      if (updates.lastPaymentMonth !== undefined) dbUpdates.last_payment_month = updates.lastPaymentMonth
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
    async (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> & { linkingOption?: string }) => {
      const profileId = getProfileId()
      if (!profileId) {
        console.error('No active profile')
        return
      }

      const now = new Date().toISOString()

      // Extract linking option
      const linkingOption = (transaction as any).linkingOption || 'create_paired'
      const transactionWithoutLinking = { ...transaction }
      delete (transactionWithoutLinking as any).linkingOption

      // Validate account exists
      const account = appData.accounts.find(a => a.id === transactionWithoutLinking.accountId)
      if (!account) {
        console.error('Account not found:', transactionWithoutLinking.accountId)
        alert('The selected account does not exist. Please refresh the page and try again.')
        return
      }

      // Auto-categorize if category not provided or is "uncategorized"
      let categoryId = transactionWithoutLinking.categoryId
      if (!categoryId || categoryId === 'uncategorized') {
        categoryId = autoCategorizeTransaction(
          transactionWithoutLinking.description,
          transactionWithoutLinking.budgetType
        )
      }

      // Get bucket from category and validate category exists
      const category = appData.categories.find((c) => c.id === categoryId)
      if (!category) {
        console.error('Category not found:', categoryId)
        alert('The selected category does not exist. Please refresh the page and try again.')
        return
      }
      const bucketId = category?.bucketId

      // Validate project exists if provided
      if (transactionWithoutLinking.projectId) {
        const project = appData.projects.find(p => p.id === transactionWithoutLinking.projectId)
        if (!project) {
          console.error('Project not found:', transactionWithoutLinking.projectId)
          alert('The selected project does not exist. Please refresh the page and try again.')
          return
        }
      }

      // Validate income source exists if provided (check both new incomeSources and legacy income)
      if (transactionWithoutLinking.incomeSourceId) {
        const incomeSource = appData.incomeSources.find(s => s.id === transactionWithoutLinking.incomeSourceId)
        const legacyIncome = appData.income.find(i => i.id === transactionWithoutLinking.incomeSourceId)
        if (!incomeSource && !legacyIncome) {
          console.warn('Income source not found:', transactionWithoutLinking.incomeSourceId, '- removing invalid reference')
          // Remove the invalid income source reference instead of blocking the transaction
          delete transactionWithoutLinking.incomeSourceId
        }
      }

      // Validate destination account exists if provided (for transfers)
      const destAccount = transactionWithoutLinking.toAccountId
        ? appData.accounts.find(a => a.id === transactionWithoutLinking.toAccountId)
        : null
      if (transactionWithoutLinking.toAccountId && !destAccount) {
        console.error('Destination account not found:', transactionWithoutLinking.toAccountId)
        alert('The destination account does not exist. Please refresh the page and try again.')
        return
      }

      // Generate IDs upfront for linking
      const mainTransactionId = generateId()
      const pairedTransactionId = generateId()

      // Determine if we need to link to a paired transaction (for create_paired option)
      const shouldCreatePaired = transactionWithoutLinking.toAccountId && linkingOption === 'create_paired'

      // Build main transaction with proper linkedTransactionId
      const newTransaction: Transaction = {
        ...transactionWithoutLinking,
        id: mainTransactionId,
        categoryId,
        bucketId,
        reconciled: transactionWithoutLinking.reconciled ?? false,
        // For create_paired, link to the paired transaction we'll create
        // For link_existing, keep the linkedTransactionId from form
        linkedTransactionId: shouldCreatePaired ? pairedTransactionId : transactionWithoutLinking.linkedTransactionId,
        createdAt: now,
        updatedAt: now,
      }

      // Save main transaction to database
      try {
        await databaseService.createTransaction({
          id: newTransaction.id,
          profile_id: profileId,
          date: newTransaction.date,
          description: newTransaction.description,
          amount: newTransaction.amount,
          category_id: newTransaction.categoryId,
          bucket_id: newTransaction.bucketId,
          budget_type: newTransaction.budgetType,
          account_id: newTransaction.accountId,
          to_account_id: newTransaction.toAccountId,
          linked_transaction_id: newTransaction.linkedTransactionId,
          project_id: newTransaction.projectId,
          income_source_id: newTransaction.incomeSourceId,
          tax_deductible: newTransaction.taxDeductible ? 1 : 0,
          reconciled: newTransaction.reconciled ? 1 : 0,
          notes: newTransaction.notes,
        })
      } catch (error) {
        console.error('Failed to create transaction in database:', error)
        return
      }

      // Update source account balance
      const newSourceBalance = account.balance + transactionWithoutLinking.amount
      try {
        await databaseService.updateAccount(account.id, { balance: newSourceBalance })
      } catch (error) {
        console.error('Failed to update account balance in database:', error)
      }

      // Variables for paired/linked transaction handling
      let depositTransaction: Transaction | null = null
      let destNewBalance = destAccount?.balance || 0

      // Handle transfer linking
      if (transactionWithoutLinking.toAccountId && destAccount) {
        if (linkingOption === 'create_paired') {
          // Find the category for the paired transaction (should match budget type)
          let pairedCategoryId = categoryId
          let pairedBucketId = bucketId

          // If the category doesn't match the destination budget type, try to find a matching Transfer/Payment category
          const pairedCategory = appData.categories.find(c => c.id === categoryId && c.budgetType === destAccount.budgetType)
          if (!pairedCategory) {
            // Look for Transfer income category in destination budget (for receiving money)
            const transferCategory = appData.categories.find(
              c => c.name === 'Transfer' && c.isIncomeCategory && c.budgetType === destAccount.budgetType
            )
            if (transferCategory) {
              pairedCategoryId = transferCategory.id
              pairedBucketId = transferCategory.bucketId
            }
          }

          // Create paired transaction and link both
          depositTransaction = {
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
            description: transactionWithoutLinking.description || 'Transfer from ' + account?.name,
            createdAt: now,
            updatedAt: now,
          }

          // Save paired transaction to database
          try {
            await databaseService.createTransaction({
              id: depositTransaction.id,
              profile_id: profileId,
              date: depositTransaction.date,
              description: depositTransaction.description,
              amount: depositTransaction.amount,
              category_id: depositTransaction.categoryId,
              bucket_id: depositTransaction.bucketId,
              budget_type: depositTransaction.budgetType,
              account_id: depositTransaction.accountId,
              to_account_id: depositTransaction.toAccountId,
              linked_transaction_id: depositTransaction.linkedTransactionId,
              project_id: depositTransaction.projectId,
              income_source_id: depositTransaction.incomeSourceId,
              tax_deductible: depositTransaction.taxDeductible ? 1 : 0,
              reconciled: depositTransaction.reconciled ? 1 : 0,
              notes: depositTransaction.notes,
            })
          } catch (error) {
            console.error('Failed to create paired transaction in database:', error)
          }

          // Update destination account balance
          destNewBalance = destAccount.balance + Math.abs(transactionWithoutLinking.amount)
          try {
            await databaseService.updateAccount(destAccount.id, { balance: destNewBalance })
          } catch (error) {
            console.error('Failed to update destination account balance in database:', error)
          }
        } else if (linkingOption === 'link_existing' && transactionWithoutLinking.linkedTransactionId) {
          // Link to existing transaction - update the existing transaction to link back and change category
          // Find the linked transaction to get its budget type
          const linkedTx = appData.transactions.find(t => t.id === transactionWithoutLinking.linkedTransactionId)

          // Find the Transfer income category for the linked transaction
          const transferCategory = linkedTx ? appData.categories.find(
            c => c.name === 'Transfer' && c.isIncomeCategory && c.budgetType === linkedTx.budgetType
          ) : null

          try {
            const updateData: any = {
              linked_transaction_id: mainTransactionId,
            }
            // Update the receiving transaction's category to Transfer income category
            if (transferCategory) {
              updateData.category_id = transferCategory.id
              updateData.bucket_id = transferCategory.bucketId
            }
            await databaseService.updateTransaction(transactionWithoutLinking.linkedTransactionId, updateData)

            // Also update in-memory state for the linked transaction
            if (linkedTx && transferCategory) {
              linkedTx.linkedTransactionId = mainTransactionId
              linkedTx.categoryId = transferCategory.id
              linkedTx.bucketId = transferCategory.bucketId
            }
          } catch (error) {
            console.error('Failed to update existing transaction link in database:', error)
          }
        }
      }

      // Now update state with all the changes
      setAppDataState((prev) => {
        const transactions = [...prev.transactions, newTransaction]
        let accounts = prev.accounts

        // Update source account balance in state
        accounts = accounts.map((a) =>
          a.id === account.id
            ? { ...a, balance: newSourceBalance, updatedAt: now }
            : a
        )

        // Handle transfer state updates
        if (transactionWithoutLinking.toAccountId && destAccount) {
          if (linkingOption === 'create_paired' && depositTransaction) {
            // Add paired transaction to state
            transactions.push(depositTransaction)

            // Update destination account balance in state
            accounts = accounts.map((a) =>
              a.id === destAccount.id
                ? { ...a, balance: destNewBalance, updatedAt: now }
                : a
            )
          } else if (linkingOption === 'link_existing' && transactionWithoutLinking.linkedTransactionId) {
            // Update existing transaction in state to link back
            const existingTxIndex = transactions.findIndex(t => t.id === transactionWithoutLinking.linkedTransactionId)
            if (existingTxIndex >= 0) {
              transactions[existingTxIndex] = {
                ...transactions[existingTxIndex],
                linkedTransactionId: mainTransactionId,
                updatedAt: now,
              }
            }
          }
        }

        return {
          ...prev,
          transactions,
          accounts,
        }
      })
    },
    [appData.categories, appData.accounts, appData.incomeSources, appData.projects, getProfileId]
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
    async (id: string, updates: Partial<Transaction>) => {
      // Update in database
      try {
        const dbUpdates: any = {}
        if (updates.date !== undefined) dbUpdates.date = updates.date
        if (updates.description !== undefined) dbUpdates.description = updates.description
        if (updates.amount !== undefined) dbUpdates.amount = updates.amount
        if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId
        if (updates.bucketId !== undefined) dbUpdates.bucket_id = updates.bucketId
        if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
        if (updates.accountId !== undefined) dbUpdates.account_id = updates.accountId
        if (updates.toAccountId !== undefined) dbUpdates.to_account_id = updates.toAccountId
        if (updates.linkedTransactionId !== undefined) dbUpdates.linked_transaction_id = updates.linkedTransactionId
        if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId
        if (updates.incomeSourceId !== undefined) dbUpdates.income_source_id = updates.incomeSourceId
        if (updates.taxDeductible !== undefined) dbUpdates.tax_deductible = updates.taxDeductible ? 1 : 0
        if (updates.reconciled !== undefined) dbUpdates.reconciled = updates.reconciled ? 1 : 0
        if (updates.notes !== undefined) dbUpdates.notes = updates.notes

        await databaseService.updateTransaction(id, dbUpdates)
      } catch (error) {
        console.error('Failed to update transaction in database:', error)
      }

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

  const deleteTransaction = useCallback(async (id: string) => {
    // Delete from database
    try {
      await databaseService.deleteTransaction(id)
    } catch (error) {
      console.error('Failed to delete transaction from database:', error)
    }

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
    async (income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) => {
      const profileId = getProfileId()
      if (!profileId) {
        console.error('No active profile')
        return
      }

      const now = new Date().toISOString()
      const newIncome: IncomeSource = {
        ...income,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        await databaseService.createIncomeSource({
          id: newIncome.id,
          profile_id: profileId,
          name: newIncome.name,
          budget_type: newIncome.budgetType,
          income_type: newIncome.incomeType,
          category_id: newIncome.categoryId,
          expected_amount: newIncome.expectedAmount,
          first_occurrence_amount: newIncome.firstOccurrenceAmount,
          frequency: newIncome.frequency,
          next_expected_date: newIncome.nextExpectedDate,
          end_condition: newIncome.endCondition || 'none',
          end_date: newIncome.endDate,
          total_occurrences: newIncome.totalOccurrences,
          client_source: newIncome.clientSource,
          is_active: newIncome.isActive !== false ? 1 : 0,
        })

        // Only update state after successful database write
        setAppDataState((prev) => ({
          ...prev,
          incomeSources: [...prev.incomeSources, newIncome],
        }))
      } catch (error) {
        console.error('Failed to create income source in database:', error)
        throw error
      }
    },
    [getProfileId]
  )

  const updateIncomeSource = useCallback(async (id: string, updates: Partial<IncomeSource>) => {
    // Update in database
    try {
      const dbUpdates: any = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
      if (updates.incomeType !== undefined) dbUpdates.income_type = updates.incomeType
      if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId
      if (updates.expectedAmount !== undefined) dbUpdates.expected_amount = updates.expectedAmount
      if (updates.firstOccurrenceAmount !== undefined) dbUpdates.first_occurrence_amount = updates.firstOccurrenceAmount
      if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency
      if (updates.nextExpectedDate !== undefined) dbUpdates.next_expected_date = updates.nextExpectedDate
      if (updates.endCondition !== undefined) dbUpdates.end_condition = updates.endCondition
      if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
      if (updates.totalOccurrences !== undefined) dbUpdates.total_occurrences = updates.totalOccurrences
      if (updates.clientSource !== undefined) dbUpdates.client_source = updates.clientSource
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive ? 1 : 0

      await databaseService.updateIncomeSource(id, dbUpdates)

      // Only update state after successful database write
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
    } catch (error) {
      console.error('Failed to update income source in database:', error)
      throw error
    }
  }, [])

  const deleteIncomeSource = useCallback(async (id: string) => {
    // Delete from database
    try {
      await databaseService.deleteIncomeSource(id)

      // Only update state after successful database write
      setAppDataState((prev) => ({
        ...prev,
        incomeSources: prev.incomeSources.filter((i) => i.id !== id),
      }))
    } catch (error) {
      console.error('Failed to delete income source from database:', error)
      throw error
    }
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
      const profileId = getProfileId()
      if (!profileId) {
        console.error('No active profile')
        return
      }

      const now = new Date().toISOString()
      const newProject: Project = {
        ...project,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        databaseService.createProject({
          id: newProject.id,
          profile_id: profileId,
          name: newProject.name,
          budget_type: newProject.budgetType,
          project_type_id: newProject.projectTypeId,
          status_id: newProject.statusId,
          income_source_id: newProject.incomeSourceId,
          budget: newProject.budget,
          date_created: newProject.dateCreated,
          date_completed: newProject.dateCompleted,
          commission_paid: newProject.commissionPaid,
          notes: newProject.notes,
        })
      } catch (error) {
        console.error('Failed to create project in database:', error)
      }

      setAppDataState((prev) => ({
        ...prev,
        projects: [...prev.projects, newProject],
      }))
    },
    [getProfileId]
  )

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    // Update in database
    try {
      const dbUpdates: any = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
      if (updates.projectTypeId !== undefined) dbUpdates.project_type_id = updates.projectTypeId
      if (updates.statusId !== undefined) dbUpdates.status_id = updates.statusId
      if (updates.incomeSourceId !== undefined) dbUpdates.income_source_id = updates.incomeSourceId
      if (updates.budget !== undefined) dbUpdates.budget = updates.budget
      if (updates.dateCreated !== undefined) dbUpdates.date_created = updates.dateCreated
      if (updates.dateCompleted !== undefined) dbUpdates.date_completed = updates.dateCompleted
      if (updates.commissionPaid !== undefined) dbUpdates.commission_paid = updates.commissionPaid
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes

      databaseService.updateProject(id, dbUpdates)
    } catch (error) {
      console.error('Failed to update project in database:', error)
    }

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
    // Delete from database
    try {
      databaseService.deleteProject(id)
    } catch (error) {
      console.error('Failed to delete project from database:', error)
    }

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
      const profileId = getProfileId()
      if (!profileId) {
        console.error('No active profile')
        return
      }

      const now = new Date().toISOString()
      const newProjectType: ProjectTypeConfig = {
        ...projectType,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        databaseService.createProjectType({
          id: newProjectType.id,
          profile_id: profileId,
          name: newProjectType.name,
          budget_type: newProjectType.budgetType,
          allowed_statuses: newProjectType.allowedStatuses,
        })
      } catch (error) {
        console.error('Failed to create project type in database:', error)
      }

      setAppDataState((prev) => ({
        ...prev,
        projectTypes: [...prev.projectTypes, newProjectType],
      }))
    },
    [getProfileId]
  )

  const updateProjectType = useCallback((id: string, updates: Partial<ProjectTypeConfig>) => {
    // Update in database
    try {
      const dbUpdates: any = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
      if (updates.allowedStatuses !== undefined) dbUpdates.allowed_statuses = updates.allowedStatuses

      databaseService.updateProjectType(id, dbUpdates)
    } catch (error) {
      console.error('Failed to update project type in database:', error)
    }

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
    // Delete from database (soft delete)
    try {
      databaseService.deleteProjectType(id)
    } catch (error) {
      console.error('Failed to delete project type from database:', error)
    }

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
      const profileId = getProfileId()
      if (!profileId) {
        console.error('No active profile')
        return
      }

      const now = new Date().toISOString()
      const newStatus: ProjectStatusConfig = {
        ...status,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        databaseService.createProjectStatus({
          id: newStatus.id,
          profile_id: profileId,
          name: newStatus.name,
          description: newStatus.description,
        })
      } catch (error) {
        console.error('Failed to create project status in database:', error)
      }

      setAppDataState((prev) => ({
        ...prev,
        projectStatuses: [...prev.projectStatuses, newStatus],
      }))
    },
    [getProfileId]
  )

  const updateProjectStatus = useCallback((id: string, updates: Partial<ProjectStatusConfig>) => {
    // Update in database
    try {
      const dbUpdates: any = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.description !== undefined) dbUpdates.description = updates.description

      databaseService.updateProjectStatus(id, dbUpdates)
    } catch (error) {
      console.error('Failed to update project status in database:', error)
    }

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
    // Delete from database (soft delete)
    try {
      databaseService.deleteProjectStatus(id)
    } catch (error) {
      console.error('Failed to delete project status from database:', error)
    }

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
      const profileId = getProfileId()
      if (!profileId) {
        console.error('Cannot add monthly budget: No active profile')
        return
      }

      const now = new Date().toISOString()
      const newBudget: MonthlyBudget = {
        ...budget,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }

      // Save to database
      try {
        databaseService.upsertMonthlyBudget({
          profile_id: profileId,
          month: budget.month,
          budget_type: budget.budgetType,
          category_id: budget.categoryId,
          amount: budget.amount,
        })
      } catch (error) {
        console.error('Failed to save monthly budget to database:', error)
      }

      // Update local state
      setAppDataState((prev) => ({
        ...prev,
        monthlyBudgets: [...prev.monthlyBudgets, newBudget],
      }))
    },
    [getProfileId]
  )

  const updateMonthlyBudget = useCallback((id: string, updates: Partial<MonthlyBudget>) => {
    const profileId = getProfileId()
    if (!profileId) {
      console.error('Cannot update monthly budget: No active profile')
      return
    }

    // Update local state and get updated budget
    let updatedBudget: MonthlyBudget | null = null
    setAppDataState((prev) => {
      const newBudgets = prev.monthlyBudgets.map((budget) => {
        if (budget.id === id) {
          updatedBudget = {
            ...budget,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
          return updatedBudget
        }
        return budget
      })
      return {
        ...prev,
        monthlyBudgets: newBudgets,
      }
    })

    // Save to database
    if (updatedBudget) {
      try {
        const budget = updatedBudget as MonthlyBudget
        databaseService.upsertMonthlyBudget({
          profile_id: profileId,
          month: budget.month,
          budget_type: budget.budgetType,
          category_id: budget.categoryId,
          amount: budget.amount,
        })
      } catch (error) {
        console.error('Failed to update monthly budget in database:', error)
      }
    }
  }, [getProfileId])

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
        // Handle nested household targets
        if (updates.householdTargets) {
          if (updates.householdTargets.needsPercentage !== undefined) {
            dbUpdates.household_needs_percentage = updates.householdTargets.needsPercentage
          }
          if (updates.householdTargets.wantsPercentage !== undefined) {
            dbUpdates.household_wants_percentage = updates.householdTargets.wantsPercentage
          }
          if (updates.householdTargets.savingsPercentage !== undefined) {
            dbUpdates.household_savings_percentage = updates.householdTargets.savingsPercentage
          }
          if (updates.householdTargets.monthlyIncomeBaseline !== undefined) {
            dbUpdates.household_monthly_income_baseline = updates.householdTargets.monthlyIncomeBaseline
          }
        }

        // Handle nested business targets
        if (updates.businessTargets) {
          if (updates.businessTargets.operatingPercentage !== undefined) {
            dbUpdates.business_operating_percentage = updates.businessTargets.operatingPercentage
          }
          if (updates.businessTargets.growthPercentage !== undefined) {
            dbUpdates.business_growth_percentage = updates.businessTargets.growthPercentage
          }
          if (updates.businessTargets.compensationPercentage !== undefined) {
            dbUpdates.business_compensation_percentage = updates.businessTargets.compensationPercentage
          }
          if (updates.businessTargets.taxReservePercentage !== undefined) {
            dbUpdates.business_tax_reserve_percentage = updates.businessTargets.taxReservePercentage
          }
          if (updates.businessTargets.businessSavingsPercentage !== undefined) {
            dbUpdates.business_savings_percentage = updates.businessTargets.businessSavingsPercentage
          }
          if (updates.businessTargets.monthlyRevenueBaseline !== undefined) {
            dbUpdates.business_monthly_revenue_baseline = updates.businessTargets.monthlyRevenueBaseline
          }
        }

        // Handle bucket customization
        if (updates.bucketCustomization) {
          // Household buckets
          if (updates.bucketCustomization.householdNeedsName !== undefined) {
            dbUpdates.household_needs_name = updates.bucketCustomization.householdNeedsName
          }
          if (updates.bucketCustomization.householdWantsName !== undefined) {
            dbUpdates.household_wants_name = updates.bucketCustomization.householdWantsName
          }
          if (updates.bucketCustomization.householdSavingsName !== undefined) {
            dbUpdates.household_savings_name = updates.bucketCustomization.householdSavingsName
          }

          // Business buckets
          if (updates.bucketCustomization.businessTravelPerformanceName !== undefined) {
            dbUpdates.business_travel_performance_name = updates.bucketCustomization.businessTravelPerformanceName
          }
          if (updates.bucketCustomization.businessTravelPerformancePercentage !== undefined) {
            dbUpdates.business_travel_performance_percentage = updates.bucketCustomization.businessTravelPerformancePercentage
          }
          if (updates.bucketCustomization.businessCraftBusinessName !== undefined) {
            dbUpdates.business_craft_business_name = updates.bucketCustomization.businessCraftBusinessName
          }
          if (updates.bucketCustomization.businessCraftBusinessPercentage !== undefined) {
            dbUpdates.business_craft_business_percentage = updates.bucketCustomization.businessCraftBusinessPercentage
          }
          if (updates.bucketCustomization.businessOnlineMarketingName !== undefined) {
            dbUpdates.business_online_marketing_name = updates.bucketCustomization.businessOnlineMarketingName
          }
          if (updates.bucketCustomization.businessOnlineMarketingPercentage !== undefined) {
            dbUpdates.business_online_marketing_percentage = updates.bucketCustomization.businessOnlineMarketingPercentage
          }
          if (updates.bucketCustomization.businessProfessionalServicesName !== undefined) {
            dbUpdates.business_professional_services_name = updates.bucketCustomization.businessProfessionalServicesName
          }
          if (updates.bucketCustomization.businessProfessionalServicesPercentage !== undefined) {
            dbUpdates.business_professional_services_percentage = updates.bucketCustomization.businessProfessionalServicesPercentage
          }
          if (updates.bucketCustomization.businessAdministrativeName !== undefined) {
            dbUpdates.business_administrative_name = updates.bucketCustomization.businessAdministrativeName
          }
          if (updates.bucketCustomization.businessAdministrativePercentage !== undefined) {
            dbUpdates.business_administrative_percentage = updates.bucketCustomization.businessAdministrativePercentage
          }
          if (updates.bucketCustomization.businessPersonnelName !== undefined) {
            dbUpdates.business_personnel_name = updates.bucketCustomization.businessPersonnelName
          }
          if (updates.bucketCustomization.businessPersonnelPercentage !== undefined) {
            dbUpdates.business_personnel_percentage = updates.bucketCustomization.businessPersonnelPercentage
          }
        }

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

  const clearAllData = useCallback(async () => {
    const profileId = getProfileId()
    if (!profileId) {
      console.error('No active profile to clear data for')
      return
    }

    console.log('Clearing all data for profile:', profileId)

    // Stop auto-sync to prevent cloud data from being restored
    syncService.stopAutoSync()
    console.log('Stopped auto-sync')

    // Clear data from the local database
    try {
      await databaseService.clearProfileData(profileId)
      console.log('Local database data cleared successfully')
    } catch (error) {
      console.error('Failed to clear local database data:', error)
      return
    }

    // Clear data from the cloud (if authenticated)
    try {
      await syncService.clearCloudData(profileId)
      console.log('Cloud data cleared successfully')
    } catch (error) {
      console.error('Failed to clear cloud data:', error)
      // Continue anyway - local data is cleared
    }

    // Clear legacy localStorage
    StorageService.clear()

    console.log('All data cleared successfully, reloading app...')

    // Reload the page to reinitialize everything properly
    // This ensures default categories, project types, etc. are created fresh
    window.location.reload()
  }, [getProfileId])

  const loadSampleData = useCallback(() => {
    // TODO: Implement sample data loading
    console.log('Load sample data - to be implemented')
  }, [])

  const addMissingDefaultCategories = useCallback(async () => {
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

    const profileId = getProfileId()
    if (!profileId) {
      console.error('No active profile')
      return 0
    }

    // Reactivate any deactivated income categories or transfer categories
    for (const category of appData.categories) {
      if ((category.isIncomeCategory || category.excludeFromBudget) && !category.isActive) {
        try {
          await databaseService.updateCategory(category.id, {
            is_active: 1,
          })
          reactivatedCount++
        } catch (error) {
          console.error('Failed to reactivate category in database:', error)
        }
      }
    }

    // Add missing categories to database
    for (const category of missingCategories) {
      try {
        await databaseService.createCategory({
          id: category.id,
          profile_id: profileId,
          name: category.name,
          budget_type: category.budgetType,
          bucket_id: category.bucketId,
          category_group: category.categoryGroup,
          monthly_budget: category.monthlyBudget || 0,
          is_fixed_expense: category.isFixedExpense ? 1 : 0,
          is_active: 1,
          tax_deductible_by_default: category.taxDeductibleByDefault ? 1 : 0,
          is_income_category: category.isIncomeCategory ? 1 : 0,
          exclude_from_budget: category.excludeFromBudget ? 1 : 0,
          icon: category.icon,
        })
        addedCount++
      } catch (error) {
        console.error('Failed to create category in database:', error)
      }
    }

    // Reload categories from database if any changes were made
    if (addedCount > 0 || reactivatedCount > 0) {
      try {
        const categories = await databaseService.getCategories(profileId)
        setAppDataState((prev) => ({
          ...prev,
          categories: categories.map(convertDbCategory),
        }))
      } catch (error) {
        console.error('Failed to reload categories from database:', error)
      }
    }

    return addedCount + reactivatedCount
  }, [appData.categories, getProfileId])

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
