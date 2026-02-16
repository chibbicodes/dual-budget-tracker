import type { BudgetType, Income as IncomeType, IncomeSource } from '../types'
import { startOfMonth, endOfMonth, parseISO, differenceInDays } from 'date-fns'

/**
 * Convert IncomeSource to legacy Income format used by date calculation helpers
 */
export function incomeSourceToLegacy(source: IncomeSource): IncomeType {
  return {
    id: source.id,
    source: source.name,
    budgetType: source.budgetType,
    categoryId: source.categoryId,
    client: source.clientSource,
    expectedAmount: source.expectedAmount,
    firstOccurrenceAmount: source.firstOccurrenceAmount,
    isRecurring: source.frequency !== 'irregular',
    recurringFrequency: source.frequency === 'biweekly' ? 'bi-weekly' : source.frequency as any,
    expectedDate: source.nextExpectedDate,
    endCondition: source.endCondition || 'none',
    endDate: source.endDate,
    totalOccurrences: source.totalOccurrences,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

/**
 * Check if income has ended based on end conditions
 */
export function hasIncomeEnded(income: IncomeType, checkDate: Date): boolean {
  if (!income.isRecurring || income.endCondition === 'none' || !income.endCondition) {
    return false
  }

  if (income.endCondition === 'date' && income.endDate) {
    const endDate = parseISO(income.endDate + 'T23:59:59')
    return checkDate > endDate
  }

  // For occurrence-based ending, we need to count occurrences up to the check date
  if (income.endCondition === 'occurrences' && income.totalOccurrences && income.expectedDate) {
    const occurrencesSoFar = countOccurrencesUpToDate(income, checkDate)
    return occurrencesSoFar >= income.totalOccurrences
  }

  return false
}

/**
 * Count total occurrences from start date up to a given date
 */
export function countOccurrencesUpToDate(income: IncomeType, upToDate: Date): number {
  if (!income.isRecurring || !income.expectedDate) {
    return income.expectedDate ? 1 : 0
  }

  const startDate = parseISO(income.expectedDate + 'T12:00:00')
  if (upToDate < startDate) {
    return 0
  }

  switch (income.recurringFrequency) {
    case 'weekly':
    case 'bi-weekly':
    case 'every-15-days': {
      const interval = income.recurringFrequency === 'weekly' ? 7 :
                      income.recurringFrequency === 'bi-weekly' ? 14 : 15
      const daysDiff = differenceInDays(upToDate, startDate)
      return Math.floor(daysDiff / interval) + 1
    }
    case 'monthly':
    case 'same-day-each-month': {
      // Count months between start and upToDate
      const months = (upToDate.getFullYear() - startDate.getFullYear()) * 12 +
                    (upToDate.getMonth() - startDate.getMonth())
      // Add 1 if we've passed the day in the current month
      const dayOfMonth = startDate.getDate()
      const currentDayInMonth = upToDate.getDate()
      return months + (currentDayInMonth >= dayOfMonth ? 1 : 0)
    }
    default:
      return 1
  }
}

/**
 * Get all expected dates for a recurring income in a given month
 */
export function getExpectedDatesForMonth(income: IncomeType, monthDate: Date): Date[] {
  const monthStart = startOfMonth(monthDate)
  const monthEnd = endOfMonth(monthDate)
  const dates: Date[] = []

  // Check if income has ended before this month
  if (hasIncomeEnded(income, monthStart)) {
    return dates
  }

  if (!income.isRecurring) {
    // One-time income: check if expected date falls in this month
    if (income.expectedDate) {
      const expectedDate = parseISO(income.expectedDate + 'T12:00:00')
      if (expectedDate >= monthStart && expectedDate <= monthEnd) {
        dates.push(expectedDate)
      }
    }
    return dates
  }

  // Get the effective end date for this income
  let effectiveEndDate = monthEnd
  if (income.endCondition === 'date' && income.endDate) {
    const endDate = parseISO(income.endDate + 'T23:59:59')
    if (endDate < monthEnd) {
      effectiveEndDate = endDate
    }
  }

  switch (income.recurringFrequency) {
    case 'weekly':
    case 'bi-weekly':
    case 'every-15-days': {
      if (!income.expectedDate) {
        return dates
      }

      let currentDate = parseISO(income.expectedDate + 'T12:00:00')
      const interval = income.recurringFrequency === 'weekly' ? 7 :
                      income.recurringFrequency === 'bi-weekly' ? 14 : 15

      // If start date is before this month, fast-forward to first occurrence in or after this month
      let occurrenceCount = 0
      while (currentDate < monthStart) {
        currentDate = new Date(currentDate.getTime() + interval * 24 * 60 * 60 * 1000)
        occurrenceCount++
      }

      // Collect all occurrences that fall within this month (respecting end conditions)
      while (currentDate <= effectiveEndDate) {
        // Check occurrence limit
        if (income.endCondition === 'occurrences' && income.totalOccurrences) {
          if (occurrenceCount >= income.totalOccurrences) {
            break
          }
        }

        if (currentDate >= monthStart) {
          dates.push(new Date(currentDate))
        }
        currentDate = new Date(currentDate.getTime() + interval * 24 * 60 * 60 * 1000)
        occurrenceCount++
      }
      break
    }
    case 'monthly':
    case 'same-day-each-month': {
      if (income.expectedDate) {
        const startDate = parseISO(income.expectedDate + 'T12:00:00')

        // If the start date is after this month, no dates
        if (startDate > monthEnd) {
          return dates
        }

        // Check occurrence limit for monthly income
        if (income.endCondition === 'occurrences' && income.totalOccurrences) {
          const occurrencesSoFar = countOccurrencesUpToDate(income, monthStart)
          if (occurrencesSoFar >= income.totalOccurrences) {
            return dates
          }
        }

        // Get the day of month from the original expected date
        const dayOfMonth = startDate.getDate()

        // Create a date for this month with the same day
        let thisMonthDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dayOfMonth, 12, 0, 0)

        // Handle edge case where day doesn't exist in this month (e.g., 31st in February)
        if (thisMonthDate.getMonth() !== monthDate.getMonth()) {
          // If the day overflowed to next month, use last day of current month
          thisMonthDate = endOfMonth(monthDate)
        }

        // Check if this date is before the effective end date
        if (thisMonthDate <= effectiveEndDate) {
          dates.push(thisMonthDate)
        }
      }
      break
    }
    default:
      // For unknown frequencies, try to show the original date if it's in this month
      if (income.expectedDate) {
        const expectedDate = parseISO(income.expectedDate + 'T12:00:00')
        if (expectedDate >= monthStart && expectedDate <= effectiveEndDate) {
          dates.push(expectedDate)
        }
      }
  }

  return dates
}

/**
 * Calculate expected income amount for a month
 * considering first occurrence amount for recurring income
 */
export function getExpectedAmountForMonth(income: IncomeType, monthDate: Date): number {
  const dates = getExpectedDatesForMonth(income, monthDate)
  if (dates.length === 0) {
    return 0
  }

  // If no first occurrence amount, all occurrences use the regular amount
  if (!income.firstOccurrenceAmount || !income.isRecurring) {
    return dates.length * (income.expectedAmount || 0)
  }

  // Calculate total considering first occurrence amount for the first occurrence each month
  const regularAmount = income.expectedAmount || 0
  const firstAmount = income.firstOccurrenceAmount

  // First occurrence in the month uses firstOccurrenceAmount, rest use regularAmount
  return firstAmount + (dates.length - 1) * regularAmount
}

/**
 * Calculate projected monthly income from income sources for a given budget type and month.
 * This uses the configured income sources (expected amounts + frequencies) rather than
 * actual transaction data, so it represents the full projected income for the month.
 */
export function getProjectedMonthlyIncome(
  incomeSources: IncomeSource[],
  budgetType: BudgetType,
  monthDate: Date
): number {
  return incomeSources
    .filter((s) => s.budgetType === budgetType && s.isActive)
    .map((s) => getExpectedAmountForMonth(incomeSourceToLegacy(s), monthDate))
    .reduce((sum, amount) => sum + amount, 0)
}
