import { databaseService } from './database/databaseClient'
import {
  syncRecordToCloud,
  getRecordsFromCloud,
  deleteRecordFromCloud,
  subscribeToCollection,
  SyncableRecord,
} from './firebase/firestore'
import { getCurrentUser } from './firebase/auth'

/**
 * Sync Service
 * Manages synchronization between local SQLite and cloud Firestore
 * Strategy: Local-first with background sync to cloud
 */

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success'

export interface SyncProgress {
  status: SyncStatus
  message: string
  current?: number
  total?: number
}

class SyncService {
  private syncListeners: ((progress: SyncProgress) => void)[] = []
  private realtimeUnsubscribers: (() => void)[] = []
  private isSyncing = false

  /**
   * Add a listener for sync progress updates
   */
  onSyncProgress(callback: (progress: SyncProgress) => void): () => void {
    this.syncListeners.push(callback)
    return () => {
      this.syncListeners = this.syncListeners.filter((cb) => cb !== callback)
    }
  }

  /**
   * Notify all listeners of sync progress
   */
  private notifyProgress(progress: SyncProgress) {
    this.syncListeners.forEach((listener) => listener(progress))
  }

  /**
   * Check if user is authenticated
   */
  private isAuthenticated(): boolean {
    return !!getCurrentUser()
  }

  /**
   * Sync profiles to cloud
   */
  private async syncProfiles(profileId: string): Promise<void> {
    try {
      const profiles = await databaseService.getAllProfiles()
      const profile = profiles.find((p: any) => p.id === profileId)

      if (profile) {
        await syncRecordToCloud('profiles', {
          id: profile.id,
          profileId: profile.id,
          name: profile.name,
          description: profile.description,
          passwordHash: profile.password_hash,
          passwordHint: profile.password_hint,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync profiles:', error)
      throw error
    }
  }

  /**
   * Sync accounts to cloud
   */
  private async syncAccounts(profileId: string): Promise<void> {
    try {
      const accounts = await databaseService.getAccounts(profileId)

      for (const account of accounts) {
        await syncRecordToCloud('accounts', {
          id: account.id,
          profileId: account.profile_id,
          name: account.name,
          budgetType: account.budget_type,
          accountType: account.account_type,
          balance: account.balance,
          interestRate: account.interest_rate,
          creditLimit: account.credit_limit,
          paymentDueDate: account.payment_due_date,
          minimumPayment: account.minimum_payment,
          websiteUrl: account.website_url,
          notes: account.notes,
          createdAt: account.created_at,
          updatedAt: account.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync accounts:', error)
      throw error
    }
  }

  /**
   * Sync categories to cloud
   */
  private async syncCategories(profileId: string): Promise<void> {
    try {
      const categories = await databaseService.getCategories(profileId)

      for (const category of categories) {
        await syncRecordToCloud('categories', {
          id: category.id,
          profileId: category.profile_id,
          name: category.name,
          budgetType: category.budget_type,
          bucketId: category.bucket_id,
          categoryGroup: category.category_group,
          monthlyBudget: category.monthly_budget,
          isFixedExpense: category.is_fixed_expense,
          isActive: category.is_active,
          taxDeductibleByDefault: category.tax_deductible_by_default,
          isIncomeCategory: category.is_income_category,
          excludeFromBudget: category.exclude_from_budget,
          icon: category.icon,
          createdAt: category.created_at,
          updatedAt: category.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync categories:', error)
      throw error
    }
  }

  /**
   * Sync transactions to cloud
   */
  private async syncTransactions(profileId: string): Promise<void> {
    try {
      const transactions = await databaseService.getTransactions(profileId)

      for (const transaction of transactions) {
        await syncRecordToCloud('transactions', {
          id: transaction.id,
          profileId: transaction.profile_id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          categoryId: transaction.category_id,
          bucketId: transaction.bucket_id,
          budgetType: transaction.budget_type,
          accountId: transaction.account_id,
          toAccountId: transaction.to_account_id,
          linkedTransactionId: transaction.linked_transaction_id,
          projectId: transaction.project_id,
          incomeSourceId: transaction.income_source_id,
          taxDeductible: transaction.tax_deductible,
          reconciled: transaction.reconciled,
          notes: transaction.notes,
          createdAt: transaction.created_at,
          updatedAt: transaction.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync transactions:', error)
      throw error
    }
  }

  /**
   * Sync income sources to cloud
   */
  private async syncIncomeSources(profileId: string): Promise<void> {
    try {
      const incomeSources = await databaseService.getIncomeSources(profileId)

      for (const source of incomeSources) {
        await syncRecordToCloud('incomeSources', {
          id: source.id,
          profileId: source.profile_id,
          name: source.name,
          budgetType: source.budget_type,
          incomeType: source.income_type,
          categoryId: source.category_id,
          expectedAmount: source.expected_amount,
          frequency: source.frequency,
          nextExpectedDate: source.next_expected_date,
          clientSource: source.client_source,
          isActive: source.is_active,
          createdAt: source.created_at,
          updatedAt: source.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync income sources:', error)
      throw error
    }
  }

  /**
   * Sync projects to cloud
   */
  private async syncProjects(profileId: string): Promise<void> {
    try {
      const projects = await databaseService.getProjects(profileId)

      for (const project of projects) {
        await syncRecordToCloud('projects', {
          id: project.id,
          profileId: project.profile_id,
          name: project.name,
          budgetType: project.budget_type,
          projectTypeId: project.project_type_id,
          statusId: project.status_id,
          incomeSourceId: project.income_source_id,
          budget: project.budget,
          dateCreated: project.date_created,
          dateCompleted: project.date_completed,
          commissionPaid: project.commission_paid,
          notes: project.notes,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync projects:', error)
      throw error
    }
  }

  /**
   * Sync project types to cloud
   */
  private async syncProjectTypes(profileId: string): Promise<void> {
    try {
      const projectTypes = await databaseService.getProjectTypes(profileId)

      for (const type of projectTypes) {
        await syncRecordToCloud('projectTypes', {
          id: type.id,
          profileId: type.profile_id,
          name: type.name,
          budgetType: type.budget_type,
          allowedStatuses: type.allowed_statuses,
          createdAt: type.created_at,
          updatedAt: type.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync project types:', error)
      throw error
    }
  }

  /**
   * Sync project statuses to cloud
   */
  private async syncProjectStatuses(profileId: string): Promise<void> {
    try {
      const projectStatuses = await databaseService.getProjectStatuses(profileId)

      for (const status of projectStatuses) {
        await syncRecordToCloud('projectStatuses', {
          id: status.id,
          profileId: status.profile_id,
          name: status.name,
          description: status.description,
          createdAt: status.created_at,
          updatedAt: status.updated_at,
        })
      }
    } catch (error) {
      console.error('Failed to sync project statuses:', error)
      throw error
    }
  }

  /**
   * Pull profiles from cloud and update local database
   */
  private async pullProfiles(profileId: string): Promise<void> {
    try {
      const cloudProfiles = await getRecordsFromCloud('profiles', profileId)

      for (const cloudProfile of cloudProfiles) {
        const localProfile = await databaseService.getProfile(cloudProfile.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localProfile ||
          !localProfile.updated_at ||
          !cloudProfile.updatedAt ||
          new Date(cloudProfile.updatedAt) > new Date(localProfile.updated_at)
        ) {
          await databaseService.updateProfile(cloudProfile.id, {
            name: cloudProfile.name,
            description: cloudProfile.description,
            password_hash: cloudProfile.passwordHash,
            password_hint: cloudProfile.passwordHint,
          })
        }
      }
    } catch (error) {
      console.error('Failed to pull profiles:', error)
      throw error
    }
  }

  /**
   * Pull accounts from cloud and update local database
   */
  private async pullAccounts(profileId: string): Promise<void> {
    try {
      const cloudAccounts = await getRecordsFromCloud('accounts', profileId)

      for (const cloudAccount of cloudAccounts) {
        const localAccount = await databaseService.getAccount(cloudAccount.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localAccount ||
          !localAccount.updated_at ||
          !cloudAccount.updatedAt ||
          new Date(cloudAccount.updatedAt) > new Date(localAccount.updated_at)
        ) {
          if (localAccount) {
            // Update existing
            await databaseService.updateAccount(cloudAccount.id, {
              name: cloudAccount.name,
              budget_type: cloudAccount.budgetType,
              account_type: cloudAccount.accountType,
              balance: cloudAccount.balance,
              interest_rate: cloudAccount.interestRate,
              credit_limit: cloudAccount.creditLimit,
              payment_due_date: cloudAccount.paymentDueDate,
              minimum_payment: cloudAccount.minimumPayment,
              website_url: cloudAccount.websiteUrl,
              notes: cloudAccount.notes,
            })
          } else {
            // Create new
            await databaseService.createAccount({
              id: cloudAccount.id,
              profile_id: profileId,
              name: cloudAccount.name,
              budget_type: cloudAccount.budgetType,
              account_type: cloudAccount.accountType,
              balance: cloudAccount.balance,
              interest_rate: cloudAccount.interestRate,
              credit_limit: cloudAccount.creditLimit,
              payment_due_date: cloudAccount.paymentDueDate,
              minimum_payment: cloudAccount.minimumPayment,
              website_url: cloudAccount.websiteUrl,
              notes: cloudAccount.notes,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull accounts:', error)
      throw error
    }
  }

  /**
   * Pull categories from cloud and update local database
   */
  private async pullCategories(profileId: string): Promise<void> {
    try {
      const cloudCategories = await getRecordsFromCloud('categories', profileId)

      for (const cloudCategory of cloudCategories) {
        const localCategory = await databaseService.getCategory(cloudCategory.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localCategory ||
          !localCategory.updated_at ||
          !cloudCategory.updatedAt ||
          new Date(cloudCategory.updatedAt) > new Date(localCategory.updated_at)
        ) {
          if (localCategory) {
            // Update existing
            await databaseService.updateCategory(cloudCategory.id, {
              name: cloudCategory.name,
              budget_type: cloudCategory.budgetType,
              bucket_id: cloudCategory.bucketId,
              category_group: cloudCategory.categoryGroup,
              monthly_budget: cloudCategory.monthlyBudget,
              is_fixed_expense: cloudCategory.isFixedExpense,
              is_active: cloudCategory.isActive,
              tax_deductible_by_default: cloudCategory.taxDeductibleByDefault,
              is_income_category: cloudCategory.isIncomeCategory,
              exclude_from_budget: cloudCategory.excludeFromBudget,
              icon: cloudCategory.icon,
            })
          } else {
            // Create new
            await databaseService.createCategory({
              id: cloudCategory.id,
              profile_id: profileId,
              name: cloudCategory.name,
              budget_type: cloudCategory.budgetType,
              bucket_id: cloudCategory.bucketId,
              category_group: cloudCategory.categoryGroup,
              monthly_budget: cloudCategory.monthlyBudget,
              is_fixed_expense: cloudCategory.isFixedExpense,
              is_active: cloudCategory.isActive,
              tax_deductible_by_default: cloudCategory.taxDeductibleByDefault,
              is_income_category: cloudCategory.isIncomeCategory,
              exclude_from_budget: cloudCategory.excludeFromBudget,
              icon: cloudCategory.icon,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull categories:', error)
      throw error
    }
  }

  /**
   * Perform full sync for a profile
   */
  async syncProfile(profileId: string): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('User not authenticated')
    }

    if (this.isSyncing) {
      console.warn('Sync already in progress, skipping')
      return
    }

    this.isSyncing = true

    try {
      this.notifyProgress({ status: 'syncing', message: 'Starting sync...' })

      const totalSteps = 16 // 8 push + 8 pull

      // Step 1: Push local changes to cloud
      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing profiles...',
        current: 1,
        total: totalSteps,
      })
      await this.syncProfiles(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing accounts...',
        current: 2,
        total: totalSteps,
      })
      await this.syncAccounts(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing categories...',
        current: 3,
        total: totalSteps,
      })
      await this.syncCategories(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing transactions...',
        current: 4,
        total: totalSteps,
      })
      await this.syncTransactions(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing income sources...',
        current: 5,
        total: totalSteps,
      })
      await this.syncIncomeSources(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing projects...',
        current: 6,
        total: totalSteps,
      })
      await this.syncProjects(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing project types...',
        current: 7,
        total: totalSteps,
      })
      await this.syncProjectTypes(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing project statuses...',
        current: 8,
        total: totalSteps,
      })
      await this.syncProjectStatuses(profileId)

      // Step 2: Pull remote changes from cloud
      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling profiles...',
        current: 9,
        total: totalSteps,
      })
      await this.pullProfiles(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling accounts...',
        current: 10,
        total: totalSteps,
      })
      await this.pullAccounts(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling categories...',
        current: 11,
        total: totalSteps,
      })
      await this.pullCategories(profileId)

      // Store last synced timestamp
      localStorage.setItem('lastSyncedAt', new Date().toISOString())

      this.notifyProgress({ status: 'success', message: 'Sync completed successfully' })
    } catch (error) {
      console.error('Sync failed:', error)
      this.notifyProgress({
        status: 'error',
        message: error instanceof Error ? error.message : 'Sync failed',
      })
      throw error
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Enable real-time sync for a profile
   */
  enableRealtimeSync(profileId: string, onUpdate: () => void): () => void {
    if (!this.isAuthenticated()) {
      console.warn('User not authenticated, skipping realtime sync')
      return () => {}
    }

    // Subscribe to accounts changes
    const unsubAccounts = subscribeToCollection(
      'accounts',
      profileId,
      async () => {
        await this.pullAccounts(profileId)
        onUpdate()
      }
    )

    // Subscribe to categories changes
    const unsubCategories = subscribeToCollection(
      'categories',
      profileId,
      async () => {
        await this.pullCategories(profileId)
        onUpdate()
      }
    )

    this.realtimeUnsubscribers.push(unsubAccounts, unsubCategories)

    // Return cleanup function
    return () => {
      unsubAccounts()
      unsubCategories()
      this.realtimeUnsubscribers = this.realtimeUnsubscribers.filter(
        (unsub) => unsub !== unsubAccounts && unsub !== unsubCategories
      )
    }
  }

  /**
   * Disable all real-time sync listeners
   */
  disableRealtimeSync(): void {
    this.realtimeUnsubscribers.forEach((unsub) => unsub())
    this.realtimeUnsubscribers = []
  }

  /**
   * Check if sync is currently in progress
   */
  isSyncInProgress(): boolean {
    return this.isSyncing
  }

  /**
   * Get last synced timestamp
   */
  getLastSyncedAt(): Date | null {
    const timestamp = localStorage.getItem('lastSyncedAt')
    return timestamp ? new Date(timestamp) : null
  }

  /**
   * Enable auto-sync (sync every X minutes)
   */
  private autoSyncInterval: NodeJS.Timeout | null = null
  private autoSyncProfileId: string | null = null

  startAutoSync(profileId: string, intervalMinutes: number = 5): void {
    if (this.autoSyncInterval) {
      console.warn('Auto-sync already running')
      return
    }

    if (!this.isAuthenticated()) {
      console.warn('User not authenticated, cannot start auto-sync')
      return
    }

    this.autoSyncProfileId = profileId
    console.log(`Starting auto-sync every ${intervalMinutes} minutes`)

    // Initial sync
    this.syncProfile(profileId).catch((error) => {
      console.error('Initial auto-sync failed:', error)
    })

    // Set up interval
    this.autoSyncInterval = setInterval(() => {
      if (this.autoSyncProfileId) {
        this.syncProfile(this.autoSyncProfileId).catch((error) => {
          console.error('Auto-sync failed:', error)
        })
      }
    }, intervalMinutes * 60 * 1000)
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval)
      this.autoSyncInterval = null
      this.autoSyncProfileId = null
      console.log('Auto-sync stopped')
    }
  }

  /**
   * Check if auto-sync is running
   */
  isAutoSyncRunning(): boolean {
    return this.autoSyncInterval !== null
  }

  /**
   * Get auto-sync settings
   */
  getAutoSyncEnabled(): boolean {
    return localStorage.getItem('autoSyncEnabled') === 'true'
  }

  /**
   * Set auto-sync settings
   */
  setAutoSyncEnabled(enabled: boolean): void {
    localStorage.setItem('autoSyncEnabled', enabled ? 'true' : 'false')
  }
}

// Export singleton instance
export const syncService = new SyncService()
