/**
 * Data conversion utilities
 * Converts database snake_case records to AppData camelCase format
 */

import type {
  Account,
  Transaction,
  Category,
  IncomeSource,
  Project,
  ProjectTypeConfig,
  ProjectStatusConfig,
  AppSettings,
} from '../types'

/**
 * Convert database account to Account type
 */
export function convertDbAccount(dbAccount: any): Account {
  return {
    id: dbAccount.id,
    name: dbAccount.name,
    budgetType: dbAccount.budget_type,
    accountType: dbAccount.account_type,
    balance: dbAccount.balance || 0,
    interestRate: dbAccount.interest_rate,
    creditLimit: dbAccount.credit_limit,
    availableCredit:
      dbAccount.account_type === 'credit_card' && dbAccount.credit_limit
        ? dbAccount.credit_limit - Math.abs(dbAccount.balance || 0)
        : undefined,
    creditUtilization:
      dbAccount.account_type === 'credit_card' && dbAccount.credit_limit
        ? (Math.abs(dbAccount.balance || 0) / dbAccount.credit_limit) * 100
        : undefined,
    paymentDueDate: dbAccount.payment_due_date,
    minimumPayment: dbAccount.minimum_payment,
    websiteUrl: dbAccount.website_url,
    notes: dbAccount.notes,
    createdAt: dbAccount.created_at,
    updatedAt: dbAccount.updated_at,
  }
}

/**
 * Convert database transaction to Transaction type
 */
export function convertDbTransaction(dbTransaction: any): Transaction {
  return {
    id: dbTransaction.id,
    date: dbTransaction.date,
    description: dbTransaction.description,
    amount: dbTransaction.amount || 0,
    categoryId: dbTransaction.category_id,
    bucketId: dbTransaction.bucket_id,
    budgetType: dbTransaction.budget_type,
    accountId: dbTransaction.account_id,
    toAccountId: dbTransaction.to_account_id,
    linkedTransactionId: dbTransaction.linked_transaction_id,
    projectId: dbTransaction.project_id,
    incomeSourceId: dbTransaction.income_source_id,
    taxDeductible: dbTransaction.tax_deductible === 1,
    reconciled: dbTransaction.reconciled === 1,
    notes: dbTransaction.notes,
    createdAt: dbTransaction.created_at,
    updatedAt: dbTransaction.updated_at,
  }
}

/**
 * Convert database category to Category type
 */
export function convertDbCategory(dbCategory: any): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    budgetType: dbCategory.budget_type,
    bucketId: dbCategory.bucket_id,
    categoryGroup: dbCategory.category_group,
    monthlyBudget: dbCategory.monthly_budget || 0,
    isFixedExpense: dbCategory.is_fixed_expense === 1,
    isActive: dbCategory.is_active === 1,
    taxDeductibleByDefault: dbCategory.tax_deductible_by_default === 1,
    isIncomeCategory: dbCategory.is_income_category === 1,
    excludeFromBudget: dbCategory.exclude_from_budget === 1,
    icon: dbCategory.icon,
    autoCategorization: [], // TODO: Load from separate table if needed
    createdAt: dbCategory.created_at,
    updatedAt: dbCategory.updated_at,
  }
}

/**
 * Convert database income source to IncomeSource type
 */
export function convertDbIncomeSource(dbIncomeSource: any): IncomeSource {
  return {
    id: dbIncomeSource.id,
    name: dbIncomeSource.name,
    budgetType: dbIncomeSource.budget_type,
    incomeType: dbIncomeSource.income_type,
    categoryId: dbIncomeSource.category_id,
    expectedAmount: dbIncomeSource.expected_amount || 0,
    frequency: dbIncomeSource.frequency,
    nextExpectedDate: dbIncomeSource.next_expected_date,
    clientSource: dbIncomeSource.client_source,
    isActive: dbIncomeSource.is_active === 1,
    createdAt: dbIncomeSource.created_at,
    updatedAt: dbIncomeSource.updated_at,
  }
}

/**
 * Convert database project to Project type
 */
export function convertDbProject(dbProject: any): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    budgetType: dbProject.budget_type,
    projectTypeId: dbProject.project_type_id,
    statusId: dbProject.status_id,
    incomeSourceId: dbProject.income_source_id,
    budget: dbProject.budget,
    dateCreated: dbProject.date_created,
    dateCompleted: dbProject.date_completed,
    commissionPaid: dbProject.commission_paid === 1,
    notes: dbProject.notes,
    createdAt: dbProject.created_at,
    updatedAt: dbProject.updated_at,
  }
}

/**
 * Convert database project type to ProjectTypeConfig type
 */
export function convertDbProjectType(dbProjectType: any): ProjectTypeConfig {
  // Parse allowedStatuses if it's a JSON string
  let allowedStatuses: string[] = []
  if (dbProjectType.allowed_statuses) {
    if (typeof dbProjectType.allowed_statuses === 'string') {
      try {
        allowedStatuses = JSON.parse(dbProjectType.allowed_statuses)
      } catch (e) {
        console.error('Failed to parse allowedStatuses:', e)
        allowedStatuses = []
      }
    } else if (Array.isArray(dbProjectType.allowed_statuses)) {
      allowedStatuses = dbProjectType.allowed_statuses
    }
  }

  return {
    id: dbProjectType.id,
    name: dbProjectType.name,
    budgetType: dbProjectType.budget_type,
    allowedStatuses,
    createdAt: dbProjectType.created_at,
    updatedAt: dbProjectType.updated_at,
  }
}

/**
 * Convert database project status to ProjectStatusConfig type
 */
export function convertDbProjectStatus(dbProjectStatus: any): ProjectStatusConfig {
  return {
    id: dbProjectStatus.id,
    name: dbProjectStatus.name,
    description: dbProjectStatus.description,
    createdAt: dbProjectStatus.created_at,
    updatedAt: dbProjectStatus.updated_at,
  }
}

/**
 * Convert database settings to AppSettings type
 */
export function convertDbSettings(dbSettings: any): AppSettings {
  return {
    defaultBudgetView: dbSettings.default_budget_view || 'household',
    dateFormat: dbSettings.date_format || 'MM/dd/yyyy',
    currencySymbol: dbSettings.currency_symbol || '$',
    firstRunCompleted: dbSettings.first_run_completed === 1,
    trackBusiness: dbSettings.track_business === 1,
    trackHousehold: dbSettings.track_household === 1,
    householdTargets: {
      needsPercentage: dbSettings.household_needs_percentage || 50,
      wantsPercentage: dbSettings.household_wants_percentage || 30,
      savingsPercentage: dbSettings.household_savings_percentage || 20,
      monthlyIncomeBaseline: dbSettings.household_monthly_income_baseline || 0,
    },
    businessTargets: {
      operatingPercentage: dbSettings.business_operating_percentage || 0,
      growthPercentage: dbSettings.business_growth_percentage || 0,
      compensationPercentage: dbSettings.business_compensation_percentage || 0,
      taxReservePercentage: dbSettings.business_tax_reserve_percentage || 0,
      businessSavingsPercentage: dbSettings.business_savings_percentage || 0,
      monthlyRevenueBaseline: dbSettings.business_monthly_revenue_baseline || 0,
    },
  }
}
