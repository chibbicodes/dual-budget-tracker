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

      // Step 1: Push local changes to cloud
      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing profiles...',
        current: 1,
        total: 6,
      })
      await this.syncProfiles(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing accounts...',
        current: 2,
        total: 6,
      })
      await this.syncAccounts(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Syncing categories...',
        current: 3,
        total: 6,
      })
      await this.syncCategories(profileId)

      // Step 2: Pull remote changes from cloud
      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling profiles...',
        current: 4,
        total: 6,
      })
      await this.pullProfiles(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling accounts...',
        current: 5,
        total: 6,
      })
      await this.pullAccounts(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling categories...',
        current: 6,
        total: 6,
      })
      await this.pullCategories(profileId)

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
}

// Export singleton instance
export const syncService = new SyncService()
