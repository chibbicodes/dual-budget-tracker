// Re-export from shared package.
// Actual implementation lives in packages/shared/src/utils/calculations.ts
export {
  calculateAccountSummary,
  calculateBudgetSummary,
  getTopSpendingCategories,
  formatCurrency,
  formatCurrencyWithSign,
  getBudgetColorClass,
  getCreditUtilizationColor,
  getBudgetTypeColors,
  calculateCreditUtilization,
  getUpcomingDueDates,
} from '@dual-budget/shared'
