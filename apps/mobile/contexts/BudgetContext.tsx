import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import type {
  Account, Transaction, Category, IncomeSource, Project,
  ProjectTypeConfig, ProjectStatusConfig, AppSettings, MonthlyBudget,
  BudgetSummary,
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

interface BudgetContextType {
  // Current state
  budgetType: BudgetType
  setBudgetType: (type: BudgetType) => void
  selectedMonth: Date
  setSelectedMonth: (date: Date) => void

  // Data
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
      ])
    } finally {
      setIsLoading(false)
    }
  }, [profileId, refreshAccounts, refreshTransactions, refreshCategories, refreshIncomeSources, refreshProjects, refreshProjectTypes, refreshProjectStatuses, refreshSettings, refreshMonthlyBudgets])

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
    return calculateBudgetSummary(filteredTransactions, filteredCategories, selectedMonthString)
  }, [filteredTransactions, filteredCategories, selectedMonthString])

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

  return (
    <BudgetContext.Provider
      value={{
        budgetType,
        setBudgetType,
        selectedMonth,
        setSelectedMonth,
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
