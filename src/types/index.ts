// ============================================================================
// Budget Type System
// ============================================================================

export type BudgetType = 'household' | 'business'
export type BudgetViewType = 'household' | 'business' | 'combined'

// ============================================================================
// Account Types
// ============================================================================

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'loan'
  | 'investment'
  | 'other'

export interface Account {
  id: string
  name: string
  budgetType: BudgetType // Required field
  accountType: AccountType
  balance: number
  interestRate?: number // APR percentage
  creditLimit?: number // For credit accounts
  availableCredit?: number // Calculated field
  creditUtilization?: number // Calculated percentage
  paymentDueDate?: string // Day of month (1-31) or ISO date
  minimumPayment?: number
  websiteUrl?: string // Bill pay URL
  billPayWebsite?: string // Legacy alias for websiteUrl
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Transaction Types
// ============================================================================

export interface Transaction {
  id: string
  date: string // ISO date string
  description: string // Vendor/description
  amount: number // Positive for income, negative for expenses
  categoryId: string
  bucketId?: string // Auto-assigned based on category
  budgetType: BudgetType // Auto-assigned from account, but can be overridden
  accountId: string
  toAccountId?: string // For transfers: destination account
  linkedTransactionId?: string // For transfers: links to the paired transaction in the other account
  projectId?: string // For project tracking: link to project
  incomeSourceId?: string // For transfers into checking: link to income source for tracking
  taxDeductible: boolean // Primarily for business, available for household
  reconciled: boolean // Has transaction been reviewed/confirmed
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Project Types
// ============================================================================

export interface ProjectTypeConfig {
  id: string
  name: string
  budgetType: BudgetType
  allowedStatuses: string[] // IDs of allowed statuses for this project type
  createdAt: string
  updatedAt: string
}

export interface ProjectStatusConfig {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  name: string
  budgetType: BudgetType
  projectTypeId: string // Reference to ProjectTypeConfig
  statusId: string // Reference to ProjectStatusConfig
  incomeSourceId?: string // Optional link to income source
  budget?: number // Budget amount for tracking (especially for household projects)
  dateCreated: string // ISO date string
  dateCompleted?: string // ISO date string
  commissionPaid: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Bucket Types (Top-Level Groupings)
// ============================================================================

// Household Buckets
export type HouseholdBucketId = 'needs' | 'wants' | 'savings'

export interface HouseholdBucket {
  id: HouseholdBucketId
  name: string
  description: string
  targetPercentage: number // Default: 50, 30, 20
  colorClass: string
}

// Business Buckets
export type BusinessBucketId =
  | 'travel_performance'
  | 'craft_business'
  | 'online_marketing'
  | 'professional_services'
  | 'administrative'
  | 'personnel'
  | 'business_expenses' // Legacy - used for filtering logic

export interface BusinessBucket {
  id: BusinessBucketId
  name: string
  description: string
  targetPercentage?: number // User-defined
  colorClass: string
}

export type BucketId = HouseholdBucketId | BusinessBucketId

export type Bucket = HouseholdBucket | BusinessBucket

// ============================================================================
// Category Types
// ============================================================================

export interface Category {
  id: string
  name: string
  budgetType: BudgetType
  bucketId: BucketId
  categoryGroup?: string // Optional grouping within a bucket (e.g., "Travel & Performance", "Craft Business")
  monthlyBudget: number // Default budget amount (used if no monthly budget set)
  isFixedExpense: boolean // Amount doesn't vary month to month
  isActive: boolean
  taxDeductibleByDefault: boolean // For business categories
  isIncomeCategory?: boolean // Category is only for income transactions
  excludeFromBudget?: boolean // Don't count toward budget (e.g., transfers)
  icon?: string
  autoCategorization: AutoCategorizationPattern[]
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Monthly Budget Types
// ============================================================================

export interface MonthlyBudget {
  id: string
  month: string // YYYY-MM format
  budgetType: BudgetType
  categoryId: string
  amount: number // Budgeted amount for this category in this month
  createdAt: string
  updatedAt: string
}

export interface AutoCategorizationPattern {
  pattern: string // Text to match in vendor name
  caseSensitive: boolean
}

// ============================================================================
// Income Source Types
// ============================================================================

export type IncomeFrequency =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annual'
  | 'irregular'

export type HouseholdIncomeType =
  | 'salary'
  | 'freelance'
  | 'investment'
  | 'other'

export type BusinessIncomeType =
  | 'client_revenue'
  | 'product_sales'
  | 'services'
  | 'other'

export interface IncomeSource {
  id: string
  name: string
  budgetType: BudgetType
  incomeType: HouseholdIncomeType | BusinessIncomeType
  categoryId?: string // Link to income category
  expectedAmount: number
  frequency: IncomeFrequency
  nextExpectedDate?: string // ISO date string
  clientSource?: string // For business income tracking
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Legacy Income type for backward compatibility
export interface Income {
  id: string
  source: string // Income source name
  budgetType: BudgetType
  categoryId?: string // Link to income category
  client?: string // For business income - client/customer name
  expectedAmount?: number
  isRecurring: boolean // Monthly recurring or one-time
  recurringFrequency?: 'weekly' | 'bi-weekly' | 'every-15-days' | 'monthly' | 'same-day-each-month' // How often it recurs
  recurringDayOfMonth?: number // 1-31, for same-day-each-month frequency
  expectedDate?: string // ISO date string
  createdAt?: string
  updatedAt?: string
}

// ============================================================================
// Auto-Categorization Rule Types
// ============================================================================

export interface AutoCategorizationRule {
  id: string
  vendorPattern: string // Text to match
  budgetType: BudgetType | 'both' // Apply to specific budget or both
  categoryId: string
  caseSensitive: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Budget Target Settings
// ============================================================================

export interface HouseholdBudgetTargets {
  needsPercentage: number // Default: 50
  wantsPercentage: number // Default: 30
  savingsPercentage: number // Default: 20
  monthlyIncomeBaseline: number
}

export interface BusinessBudgetTargets {
  operatingPercentage: number
  growthPercentage: number
  compensationPercentage: number
  taxReservePercentage: number
  businessSavingsPercentage: number
  monthlyRevenueBaseline: number
}

// ============================================================================
// Application Settings
// ============================================================================

export interface AppSettings {
  defaultBudgetView: BudgetViewType
  householdTargets: HouseholdBudgetTargets
  businessTargets: BusinessBudgetTargets
  dateFormat: string
  currencySymbol: string
  firstRunCompleted: boolean
  trackBusiness: boolean // Whether user wants to track business
  trackHousehold: boolean // Whether user wants to track household
}

// ============================================================================
// Application State
// ============================================================================

export interface AppData {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  incomeSources: IncomeSource[]
  income: Income[] // Legacy income tracking
  autoCategorization: AutoCategorizationRule[]
  monthlyBudgets: MonthlyBudget[] // Monthly budget overrides
  projectTypes: ProjectTypeConfig[] // Customizable project types
  projectStatuses: ProjectStatusConfig[] // Customizable project statuses
  projects: Project[] // Project tracking for P&L analysis
  settings: AppSettings
  version: string // For data migration
}

// ============================================================================
// Summary/Calculated Types
// ============================================================================

export interface AccountSummary {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  accountsByType: Record<AccountType, Account[]>
}

export interface BudgetSummary {
  totalIncome: number
  totalExpenses: number
  remainingBudget: number
  bucketBreakdown: BucketBreakdown[]
}

export interface BucketBreakdown {
  bucketId: BucketId
  bucketName: string
  targetAmount: number
  actualAmount: number
  overUnder: number
  percentOfIncome: number
  categories: CategoryBreakdown[]
}

export interface CategoryBreakdown {
  categoryId: string
  categoryName: string
  budgeted: number
  actual: number
  overUnder: number
  percentUsed: number
  transactionCount: number
}

export interface MonthlyStats {
  month: string // YYYY-MM
  income: number
  expenses: number
  net: number
  budgetType: BudgetType
}

// ============================================================================
// Business Report Types
// ============================================================================

export interface ProfitLossStatement {
  period: string // e.g., "2024-01" or "Q1 2024"
  revenue: number
  expenses: number
  netIncome: number
  expensesByCategory: CategoryExpense[]
  taxDeductibleExpenses: number
}

export interface CategoryExpense {
  categoryId: string
  categoryName: string
  amount: number
  percentOfTotal: number
  taxDeductible: boolean
}

// ============================================================================
// CSV Import Types
// ============================================================================

export interface CSVColumnMapping {
  date: number | null
  description: number | null
  amount: number | null
  category?: number | null
}

export interface CSVImportPreview {
  headers: string[]
  sampleRows: string[][]
  totalRows: number
}

// ============================================================================
// Filter/Search Types
// ============================================================================

export interface TransactionFilters {
  budgetType?: BudgetType | 'all'
  accountId?: string
  categoryId?: string
  bucketId?: BucketId
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  searchText?: string
  taxDeductible?: boolean
}

export interface DateRange {
  start: string
  end: string
  label: string
}

// ============================================================================
// Profile Types
// ============================================================================

export interface Profile {
  id: string
  name: string
  description?: string
  passwordHash?: string // Optional password protection
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
}

export interface ProfileMetadata {
  profiles: Profile[]
  activeProfileId: string | null
  version: string
}

// ============================================================================
// UI State Types
// ============================================================================

export interface BudgetContextState {
  currentView: BudgetViewType
  setCurrentView: (view: BudgetViewType) => void
  appData: AppData
  setAppData: (data: AppData) => void

  // Account operations
  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAccount: (id: string, updates: Partial<Account>) => void
  deleteAccount: (id: string) => void

  // Transaction operations
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void

  // Category operations
  addCategory: (category: Omit<Category, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void

  // Income operations
  addIncomeSource: (income: Omit<IncomeSource, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateIncomeSource: (id: string, updates: Partial<IncomeSource>) => void
  deleteIncomeSource: (id: string) => void

  // Legacy income operations
  addIncome: (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateIncome: (id: string, updates: Partial<Income>) => void
  deleteIncome: (id: string) => void

  // Rule operations
  addRule: (rule: Omit<AutoCategorizationRule, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateRule: (id: string, updates: Partial<AutoCategorizationRule>) => void
  deleteRule: (id: string) => void

  // Monthly Budget operations
  addMonthlyBudget: (budget: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateMonthlyBudget: (id: string, updates: Partial<MonthlyBudget>) => void
  deleteMonthlyBudget: (id: string) => void
  getMonthlyBudget: (month: string, categoryId: string) => MonthlyBudget | undefined

  // Project operations
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  deleteProject: (id: string) => void

  // Project type operations
  addProjectType: (projectType: Omit<ProjectTypeConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProjectType: (id: string, updates: Partial<ProjectTypeConfig>) => void
  deleteProjectType: (id: string) => void

  // Project status operations
  addProjectStatus: (status: Omit<ProjectStatusConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateProjectStatus: (id: string, updates: Partial<ProjectStatusConfig>) => void
  deleteProjectStatus: (id: string) => void

  // Settings operations
  updateSettings: (updates: Partial<AppSettings>) => void

  // Data operations
  importData: (data: Partial<AppData>) => void
  exportData: () => AppData
  clearAllData: () => void
  loadSampleData: () => void
  addMissingDefaultCategories: () => number
  cleanupOldBusinessExpenseCategories: () => number
  addCategoryGroupsToBusinessExpenses: () => number
}

export interface ProfileContextState {
  profiles: Profile[]
  activeProfile: Profile | null
  isLoading: boolean

  // Profile operations
  createProfile: (name: string, description?: string, password?: string) => Promise<Profile>
  switchProfile: (profileId: string, password?: string) => Promise<void>
  updateProfile: (profileId: string, updates: Partial<Pick<Profile, 'name' | 'description'>>) => void
  deleteProfile: (profileId: string) => Promise<void>
  logout: () => void
  refreshProfiles: () => void
}
