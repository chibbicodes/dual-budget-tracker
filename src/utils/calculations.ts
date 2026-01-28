import type {
  Account,
  Transaction,
  Category,
  BudgetType,
  AccountSummary,
  BudgetSummary,
  BucketBreakdown,
  CategoryBreakdown,
} from '../types'
import { getAllBuckets } from '../data/defaultCategories'
import { startOfMonth, endOfMonth } from 'date-fns'

/**
 * Calculate account summary (total assets, liabilities, net worth)
 */
export function calculateAccountSummary(
  accounts: Account[],
  budgetType?: BudgetType
): AccountSummary {
  const filteredAccounts = budgetType
    ? accounts.filter((a) => a.budgetType === budgetType)
    : accounts

  let totalAssets = 0
  let totalLiabilities = 0

  filteredAccounts.forEach((account) => {
    // Credit cards and loans are always liabilities, regardless of sign
    if (account.accountType === 'credit_card' || account.accountType === 'loan') {
      totalLiabilities += Math.abs(account.balance)
    } else if (account.balance >= 0) {
      totalAssets += account.balance
    } else {
      totalLiabilities += Math.abs(account.balance)
    }
  })

  const netWorth = totalAssets - totalLiabilities

  // Group accounts by type
  const accountsByType: Record<string, Account[]> = {}
  filteredAccounts.forEach((account) => {
    if (!accountsByType[account.accountType]) {
      accountsByType[account.accountType] = []
    }
    accountsByType[account.accountType].push(account)
  })

  return {
    totalAssets,
    totalLiabilities,
    netWorth,
    accountsByType,
  }
}

/**
 * Calculate budget summary for current month
 */
export function calculateBudgetSummary(
  transactions: Transaction[],
  categories: Category[],
  budgetType: BudgetType,
  month?: Date
): BudgetSummary {
  const currentMonth = month || new Date()
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Filter transactions for current month and budget type
  const monthTransactions = transactions.filter((t) => {
    const transDate = new Date(t.date)
    return (
      t.budgetType === budgetType &&
      transDate >= monthStart &&
      transDate <= monthEnd
    )
  })

  // Calculate totals (exclude transactions with excludeFromBudget categories)
  // Note: Income transactions are always included, only expenses check excludeFromBudget
  const includedTransactions = monthTransactions.filter((t) => {
    // Always include income transactions
    if (t.amount > 0) return true

    // For expenses, check if category should be excluded from budget
    const category = categories.find((c) => c.id === t.categoryId)
    return !category?.excludeFromBudget
  })

  const totalIncome = includedTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)

  const totalExpenses = Math.abs(
    includedTransactions
      .filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + t.amount, 0)
  )

  const remainingBudget = totalIncome - totalExpenses

  // Get buckets for this budget type
  const buckets = getAllBuckets()
  const relevantBuckets =
    budgetType === 'household' ? buckets.household : buckets.business

  // Calculate bucket breakdown
  const bucketBreakdown: BucketBreakdown[] = relevantBuckets.map((bucket) => {
    // Get categories for this bucket (exclude categories marked as excludeFromBudget)
    const bucketCategories = categories.filter(
      (c) => c.budgetType === budgetType && c.bucketId === bucket.id && !c.excludeFromBudget
    )

    // Calculate target amount based on income
    const targetAmount = ((bucket.targetPercentage || 0) / 100) * totalIncome

    // Calculate actual amount spent in this bucket (only included transactions)
    const bucketTransactions = includedTransactions.filter((t) =>
      bucketCategories.some((c) => c.id === t.categoryId)
    )
    const actualAmount = Math.abs(
      bucketTransactions
        .filter((t) => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    )

    // Calculate category breakdown
    const categoryBreakdown: CategoryBreakdown[] = bucketCategories.map(
      (category) => {
        const categoryTransactions = bucketTransactions.filter(
          (t) => t.categoryId === category.id
        )
        const actual = Math.abs(
          categoryTransactions
            .filter((t) => t.amount < 0)
            .reduce((sum, t) => sum + t.amount, 0)
        )
        const budgeted = category.monthlyBudget
        const overUnder = budgeted - actual
        const percentUsed = budgeted > 0 ? (actual / budgeted) * 100 : 0

        return {
          categoryId: category.id,
          categoryName: category.name,
          budgeted,
          actual,
          overUnder,
          percentUsed,
          transactionCount: categoryTransactions.length,
        }
      }
    )

    const overUnder = targetAmount - actualAmount
    const percentOfIncome = totalIncome > 0 ? (actualAmount / totalIncome) * 100 : 0

    return {
      bucketId: bucket.id,
      bucketName: bucket.name,
      targetAmount,
      actualAmount,
      overUnder,
      percentOfIncome,
      categories: categoryBreakdown,
    }
  })

  return {
    totalIncome,
    totalExpenses,
    remainingBudget,
    bucketBreakdown,
  }
}

/**
 * Get top spending categories for current month
 */
export function getTopSpendingCategories(
  transactions: Transaction[],
  categories: Category[],
  budgetType: BudgetType,
  limit: number = 5
): Array<{ category: Category; amount: number; transactionCount: number }> {
  const currentMonth = new Date()
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Filter transactions for current month and budget type
  const monthTransactions = transactions.filter((t) => {
    const transDate = new Date(t.date)
    return (
      t.budgetType === budgetType &&
      t.amount < 0 && // Only expenses
      transDate >= monthStart &&
      transDate <= monthEnd
    )
  })

  // Group by category
  const categorySpending = new Map<string, { amount: number; count: number }>()

  monthTransactions.forEach((t) => {
    const existing = categorySpending.get(t.categoryId) || { amount: 0, count: 0 }
    categorySpending.set(t.categoryId, {
      amount: existing.amount + Math.abs(t.amount),
      count: existing.count + 1,
    })
  })

  // Convert to array and sort by amount
  const results = Array.from(categorySpending.entries())
    .map(([categoryId, data]) => ({
      category: categories.find((c) => c.id === categoryId)!,
      amount: data.amount,
      transactionCount: data.count,
    }))
    .filter((item) => item.category) // Remove if category not found
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)

  return results
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currencySymbol: string = '$'): string {
  const absAmount = Math.abs(amount)
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currencySymbol}${formatted}`
}

/**
 * Format currency with sign
 */
export function formatCurrencyWithSign(
  amount: number,
  currencySymbol: string = '$'
): string {
  const sign = amount >= 0 ? '+' : '-'
  const absAmount = Math.abs(amount)
  const formatted = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${sign}${currencySymbol}${formatted}`
}

/**
 * Get color class for budget percentage
 */
export function getBudgetColorClass(percentUsed: number): string {
  if (percentUsed < 70) return 'text-green-600'
  if (percentUsed < 90) return 'text-yellow-600'
  return 'text-red-600'
}

/**
 * Get color class for credit utilization
 */
export function getCreditUtilizationColor(utilization: number): string {
  if (utilization < 30) return 'text-green-600 bg-green-50'
  if (utilization < 50) return 'text-yellow-600 bg-yellow-50'
  return 'text-red-600 bg-red-50'
}

/**
 * Get budget type color classes
 */
export function getBudgetTypeColors(budgetType: BudgetType): {
  bg: string
  text: string
  border: string
  light: string
} {
  if (budgetType === 'household') {
    return {
      bg: 'bg-blue-500',
      text: 'text-blue-700',
      border: 'border-blue-500',
      light: 'bg-blue-50',
    }
  }
  return {
    bg: 'bg-green-500',
    text: 'text-green-700',
    border: 'border-green-500',
    light: 'bg-green-50',
  }
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(
  balance: number,
  creditLimit: number
): number {
  if (creditLimit <= 0) return 0
  return (Math.abs(balance) / creditLimit) * 100
}

/**
 * Get upcoming due dates
 */
export function getUpcomingDueDates(
  accounts: Account[],
  daysAhead: number = 30
): Array<{
  account: Account
  daysUntilDue: number
  isOverdue: boolean
}> {
  const today = new Date()

  return accounts
    .filter((a) => a.paymentDueDate)
    .map((account) => {
      const dueDay = parseInt(account.paymentDueDate || '0')
      const currentMonth = today.getMonth()
      const currentYear = today.getFullYear()

      // Create due date for current month
      let dueDate = new Date(currentYear, currentMonth, dueDay)

      // If due date is in the past, use next month
      if (dueDate < today) {
        dueDate = new Date(currentYear, currentMonth + 1, dueDay)
      }

      const diffTime = dueDate.getTime() - today.getTime()
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      const isOverdue = daysUntilDue < 0

      return {
        account,
        daysUntilDue,
        isOverdue,
      }
    })
    .filter((item) => item.daysUntilDue <= daysAhead || item.isOverdue)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
}
