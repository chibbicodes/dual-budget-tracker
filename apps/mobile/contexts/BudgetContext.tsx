import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import type {
  Account, Transaction, Category, IncomeSource, Project,
  ProjectTypeConfig, ProjectStatusConfig, AppSettings, MonthlyBudget,
  BudgetSummary, AutoCategorizationRule,
} from '@dual-budget/shared'
import {
  calculateBudgetSummary,
  calculateAccountSummary,
  getProjectedMonthlyIncome,
  convertDbAccount, convertDbTransaction, convertDbCategory,
  convertDbIncomeSource, convertDbProject, convertDbProjectType,
  convertDbProjectStatus, convertDbSettings, convertDbMonthlyBudget,
} from '@dual-budget/shared'
import { format } from 'date-fns'
import { databaseService } from '../services/database'
import { useProfile } from './ProfileContext'

type BudgetType = 'household' | 'business'

interface AppDataType {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  incomeSources: IncomeSource[]
  monthlyBudgets: MonthlyBudget[]
  autoCategorization: AutoCategorizationRule[]
  projects: Project[]
  projectTypes: ProjectTypeConfig[]
  projectStatuses: ProjectStatusConfig[]
  settings: AppSettings | null
}

interface BudgetContextType {
  // Current state
  budgetType: BudgetType
  setBudgetType: (type: BudgetType) => void
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void

  // Unfiltered data (used by screens that do their own filtering)
  appData: AppDataType

  // Filtered data (pre-filtered by budgetType)
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  incomeSources: IncomeSource[]
  projects: Project[]
  projectTypes: ProjectTypeConfig[]
  projectStatuses: ProjectStatusConfig[]
  settings: AppSettings | null
  monthlyBudgets: MonthlyBudget[]

  // Computed
  budgetSummary: BudgetSummary | null
  accountSummary: ReturnType<typeof calculateAccountSummary> | null
  projectedIncome: number

  // Actions
  refreshAll: () => Promise<void>
  refreshAccounts: () => Promise<void>
  refreshTransactions: () => Promise<void>
  refreshCategories: () => Promise<void>
  refreshIncomeSources: () => Promise<void>

  // CRUD
  addTransaction: (data: Record<string, any>) => Promise<void>
  updateTransaction: (id: string, updates: Record<string, any>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
  updateIncomeSource: (id: string, updates: Record<string, any>) => Promise<void>

  // Loading
  isLoading: boolean
}

const BudgetContext = createContext<BudgetContextType>({} as BudgetContextType)

export function BudgetProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfile()
  const profileId = activeProfile?.id

  const [budgetType, setBudgetType] = useState<BudgetType>('household')
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [isLoading, setIsLoading] = useState(true)

  // Data state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectTypes, setProjectTypes] = useState<ProjectTypeConfig[]>([])
  const [projectStatuses, setProjectStatuses] = useState<ProjectStatusConfig[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [monthlyBudgets, setMonthlyBudgets] = useState<MonthlyBudget[]>([])
  const [autoCategorization, setAutoCategorization] = useState<AutoCategorizationRule[]>([])

  const selectedMonthString = format(selectedMonth, 'yyyy-MM')

  // Refresh functions
  const refreshAccounts = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getAccounts(profileId)
    setAccounts(raw.map(convertDbAccount))
  }, [profileId])

  const refreshTransactions = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getTransactions(profileId)
    setTransactions(raw.map(convertDbTransaction))
  }, [profileId])

  const refreshCategories = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getCategories(profileId)
    setCategories(raw.map(convertDbCategory))
  }, [profileId])

  const refreshIncomeSources = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getIncomeSources(profileId)
    setIncomeSources(raw.map(convertDbIncomeSource))
  }, [profileId])

  const refreshProjects = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getProjects(profileId)
    setProjects(raw.map(convertDbProject))
  }, [profileId])

  const refreshProjectTypes = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getProjectTypes(profileId)
    setProjectTypes(raw.map(convertDbProjectType))
  }, [profileId])

  const refreshProjectStatuses = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getProjectStatuses(profileId)
    setProjectStatuses(raw.map(convertDbProjectStatus))
  }, [profileId])

  const refreshSettings = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getSettings(profileId)
    if (raw) setSettings(convertDbSettings(raw))
  }, [profileId])

  const refreshMonthlyBudgets = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getMonthlyBudgets(profileId, selectedMonthString, budgetType)
    setMonthlyBudgets(raw.map(convertDbMonthlyBudget))
  }, [profileId, selectedMonthString, budgetType])

  const refreshAutoCategorization = useCallback(async () => {
    if (!profileId) return
    const raw = await databaseService.getAutoCategorizationRules(profileId)
    setAutoCategorization(raw as AutoCategorizationRule[])
  }, [profileId])

  // CRUD functions - convert camelCase from UI to snake_case for DB
  const addTransaction = useCallback(async (data: Record<string, any>) => {
    if (!profileId) return
    await databaseService.createTransaction({
      profile_id: profileId,
      date: data.date,
      description: data.description,
      amount: data.amount,
      category_id: data.categoryId ?? null,
      bucket_id: data.bucketId ?? null,
      budget_type: data.budgetType,
      account_id: data.accountId,
      to_account_id: data.toAccountId ?? null,
      linked_transaction_id: data.linkedTransactionId ?? null,
      project_id: data.projectId ?? null,
      income_source_id: data.incomeSourceId ?? null,
      tax_deductible: data.taxDeductible ? 1 : 0,
      reconciled: data.reconciled ? 1 : 0,
      notes: data.notes ?? null,
    })
    await refreshTransactions()
    await refreshAccounts()
  }, [profileId, refreshTransactions, refreshAccounts])

  const updateTransaction = useCallback(async (id: string, updates: Record<string, any>) => {
    if (!profileId) return
    const dbUpdates: Record<string, any> = {}
    if (updates.date !== undefined) dbUpdates.date = updates.date
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount
    if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId
    if (updates.bucketId !== undefined) dbUpdates.bucket_id = updates.bucketId
    if (updates.budgetType !== undefined) dbUpdates.budget_type = updates.budgetType
    if (updates.accountId !== undefined) dbUpdates.account_id = updates.accountId
    if (updates.toAccountId !== undefined) dbUpdates.to_account_id = updates.toAccountId
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId
    if (updates.incomeSourceId !== undefined) dbUpdates.income_source_id = updates.incomeSourceId
    if (updates.taxDeductible !== undefined) dbUpdates.tax_deductible = updates.taxDeductible ? 1 : 0
    if (updates.reconciled !== undefined) dbUpdates.reconciled = updates.reconciled ? 1 : 0
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes
    await databaseService.updateTransaction(id, dbUpdates)
    await refreshTransactions()
    await refreshAccounts()
  }, [profileId, refreshTransactions, refreshAccounts])

  const deleteTransaction = useCallback(async (id: string) => {
    if (!profileId) return
    await databaseService.deleteTransaction(id)
    await refreshTransactions()
    await refreshAccounts()
  }, [profileId, refreshTransactions, refreshAccounts])

  const updateIncomeSource = useCallback(async (id: string, updates: Record<string, any>) => {
    if (!profileId) return
    const dbUpdates: Record<string, any> = {}
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive ? 1 : 0
    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.expectedAmount !== undefined) dbUpdates.expected_amount = updates.expectedAmount
    if (updates.frequency !== undefined) dbUpdates.frequency = updates.frequency
    if (updates.nextExpectedDate !== undefined) dbUpdates.next_expected_date = updates.nextExpectedDate
    await databaseService.updateIncomeSource(id, dbUpdates)
    await refreshIncomeSources()
  }, [profileId, refreshIncomeSources])

  const refreshAll = useCallback(async () => {
    if (!profileId) return
    setIsLoading(true)
    try {
      await Promise.all([
        refreshAccounts(),
        refreshTransactions(),
        refreshCategories(),
        refreshIncomeSources(),
        refreshProjects(),
        refreshProjectTypes(),
        refreshProjectStatuses(),
        refreshSettings(),
        refreshMonthlyBudgets(),
        refreshAutoCategorization(),
      ])
    } finally {
      setIsLoading(false)
    }
  }, [profileId, refreshAccounts, refreshTransactions, refreshCategories, refreshIncomeSources, refreshProjects, refreshProjectTypes, refreshProjectStatuses, refreshSettings, refreshMonthlyBudgets, refreshAutoCategorization])

  // Load data when profile changes
  useEffect(() => {
    if (profileId) {
      refreshAll()
    } else {
      // Clear all data
      setAccounts([])
      setTransactions([])
      setCategories([])
      setIncomeSources([])
      setProjects([])
      setProjectTypes([])
      setProjectStatuses([])
      setSettings(null)
      setMonthlyBudgets([])
      setAutoCategorization([])
      setIsLoading(false)
    }
  }, [profileId]) // only re-run when profileId changes, not refreshAll

  // Reload monthly budgets when month or budget type changes
  useEffect(() => {
    if (profileId) {
      refreshMonthlyBudgets()
    }
  }, [selectedMonthString, budgetType])

  // Computed values
  const filteredCategories = useMemo(
    () => categories.filter((c) => c.budgetType === budgetType),
    [categories, budgetType]
  )

  const filteredTransactions = useMemo(
    () => transactions.filter((t) => t.budgetType === budgetType),
    [transactions, budgetType]
  )

  const filteredAccounts = useMemo(
    () => accounts.filter((a) => a.budgetType === budgetType),
    [accounts, budgetType]
  )

  const budgetSummary = useMemo(() => {
    if (filteredCategories.length === 0) return null
    return calculateBudgetSummary(filteredTransactions, filteredCategories, budgetType, selectedMonth, monthlyBudgets)
  }, [filteredTransactions, filteredCategories, budgetType, selectedMonth, monthlyBudgets])

  const accountSummary = useMemo(() => {
    if (filteredAccounts.length === 0) return null
    return calculateAccountSummary(filteredAccounts)
  }, [filteredAccounts])

  const filteredIncomeSources = useMemo(
    () => incomeSources.filter((s) => s.budgetType === budgetType),
    [incomeSources, budgetType]
  )

  const projectedIncome = useMemo(
    () => getProjectedMonthlyIncome(filteredIncomeSources, selectedMonth),
    [filteredIncomeSources, selectedMonth]
  )

  // Unfiltered data object for screens that do their own filtering
  const appData: AppDataType = useMemo(
    () => ({
      accounts,
      transactions,
      categories,
      incomeSources,
      monthlyBudgets,
      autoCategorization,
      projects,
      projectTypes,
      projectStatuses,
      settings,
    }),
    [accounts, transactions, categories, incomeSources, monthlyBudgets, autoCategorization, projects, projectTypes, projectStatuses, settings]
  )

  return (
    <BudgetContext.Provider
      value={{
        budgetType,
        setBudgetType,
        selectedMonth,
        setSelectedMonth,
        appData,
        accounts: filteredAccounts,
        transactions: filteredTransactions,
        categories: filteredCategories,
        incomeSources: filteredIncomeSources,
        projects,
        projectTypes,
        projectStatuses,
        settings,
        monthlyBudgets,
        budgetSummary,
        accountSummary,
        projectedIncome,
        refreshAll,
        refreshAccounts,
        refreshTransactions,
        refreshCategories,
        refreshIncomeSources,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        updateIncomeSource,
        isLoading,
      }}
    >
      {children}
    </BudgetContext.Provider>
  )
}

export function useBudget() {
  return useContext(BudgetContext)
}
