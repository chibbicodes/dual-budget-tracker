// Types
export * from './types/index'

// Utilities
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
} from './utils/calculations'

export {
  incomeSourceToLegacy,
  hasIncomeEnded,
  countOccurrencesUpToDate,
  getExpectedDatesForMonth,
  getExpectedAmountForMonth,
  getProjectedMonthlyIncome,
} from './utils/incomeCalculations'

// Data
export {
  HOUSEHOLD_BUCKETS,
  BUSINESS_BUCKETS,
  HOUSEHOLD_CATEGORIES,
  INCOME_CATEGORIES,
  TRANSFER_CATEGORIES,
  BUSINESS_EXPENSE_CATEGORIES,
  generateDefaultCategories,
  getAllBuckets,
} from './data/defaultCategories'

export {
  generateDefaultProjectStatuses,
  generateDefaultProjectTypes,
} from './data/defaultProjects'

// Firebase services
export {
  initializeFirebase,
  isFirebaseConfigured,
  app as firebaseApp,
  auth as firebaseAuth,
  db as firebaseDb,
} from './services/firebase/config'
export type { FirebaseConfig, FirebaseInitOptions } from './services/firebase/config'

export {
  signUp,
  signIn,
  logOut,
  getCurrentUser,
  onAuthChange,
  resetPassword,
  changePassword,
  updateDisplayName,
  isSignedIn,
} from './services/firebase/auth'
export type { AuthUser } from './services/firebase/auth'

export {
  syncRecordToCloud,
  syncRecordsToCloud,
  getRecordFromCloud,
  getRecordsFromCloud,
  deleteRecordFromCloud,
  deleteAllRecordsFromCloud,
  subscribeToCollection,
  needsSync,
  syncAllRecordsToCloud,
} from './services/firebase/firestore'
export type { SyncableRecord } from './services/firebase/firestore'

// Sync service
export { createSyncService } from './services/syncService'
export type { DatabaseAdapter, StorageAdapter, SyncStatus, SyncProgress } from './services/syncService'

// Data converters
export {
  convertDbAccount,
  convertDbTransaction,
  convertDbCategory,
  convertDbIncomeSource,
  convertDbProject,
  convertDbProjectType,
  convertDbProjectStatus,
  convertDbSettings,
  convertDbMonthlyBudget,
} from './services/dataConverters'
