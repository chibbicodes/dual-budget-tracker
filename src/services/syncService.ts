import { databaseService } from './database/databaseClient'
import {
  syncRecordToCloud,
  getRecordsFromCloud,
  subscribeToCollection,
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
      // Get ALL accounts including soft-deleted ones for sync
      const accounts = await databaseService.getAccountsForSync(profileId)

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
          deletedAt: account.deleted_at || null,
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
      // Get ALL categories including soft-deleted ones for sync
      const categories = await databaseService.getCategoriesForSync(profileId)

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
          deletedAt: category.deleted_at || null,
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
      // Verify profile exists locally before pulling accounts
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping account pull`)
        return
      }

      const cloudAccounts = await getRecordsFromCloud('accounts', profileId)

      for (const cloudAccount of cloudAccounts) {
        // Only sync accounts that belong to this profile
        if (cloudAccount.profileId !== profileId) {
          continue
        }

        const localAccount = await databaseService.getAccount(cloudAccount.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localAccount ||
          !localAccount.updated_at ||
          !cloudAccount.updatedAt ||
          new Date(cloudAccount.updatedAt) > new Date(localAccount.updated_at)
        ) {
          // Check if account exists (including soft-deleted)
          const existingAccount = await databaseService.getAccountForSync(cloudAccount.id)

          if (existingAccount) {
            // Update existing account including deleted_at field
            await databaseService.updateAccountForSync(cloudAccount.id, {
              name: cloudAccount.name,
              budgetType: cloudAccount.budgetType,
              accountType: cloudAccount.accountType,
              balance: cloudAccount.balance,
              interestRate: cloudAccount.interestRate,
              creditLimit: cloudAccount.creditLimit,
              paymentDueDate: cloudAccount.paymentDueDate,
              minimumPayment: cloudAccount.minimumPayment,
              websiteUrl: cloudAccount.websiteUrl,
              notes: cloudAccount.notes,
              deletedAt: cloudAccount.deletedAt || null,
              updatedAt: cloudAccount.updatedAt,
            })
          } else {
            // Create new account
            await databaseService.createAccountForSync({
              id: cloudAccount.id,
              profileId: profileId,
              name: cloudAccount.name,
              budgetType: cloudAccount.budgetType,
              accountType: cloudAccount.accountType,
              balance: cloudAccount.balance,
              interestRate: cloudAccount.interestRate,
              creditLimit: cloudAccount.creditLimit,
              paymentDueDate: cloudAccount.paymentDueDate,
              minimumPayment: cloudAccount.minimumPayment,
              websiteUrl: cloudAccount.websiteUrl,
              notes: cloudAccount.notes,
              deletedAt: cloudAccount.deletedAt || null,
              createdAt: cloudAccount.createdAt,
              updatedAt: cloudAccount.updatedAt,
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
      // Verify profile exists locally before pulling categories
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping category pull`)
        return
      }

      const cloudCategories = await getRecordsFromCloud('categories', profileId)

      for (const cloudCategory of cloudCategories) {
        // Only sync categories that belong to this profile
        if (cloudCategory.profileId !== profileId) {
          continue
        }

        const localCategory = await databaseService.getCategory(cloudCategory.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localCategory ||
          !localCategory.updated_at ||
          !cloudCategory.updatedAt ||
          new Date(cloudCategory.updatedAt) > new Date(localCategory.updated_at)
        ) {
          // Check if category exists (including soft-deleted)
          const existingCategory = await databaseService.getCategoryForSync(cloudCategory.id)

          if (existingCategory) {
            // Update existing category including deleted_at field
            await databaseService.updateCategoryForSync(cloudCategory.id, {
              name: cloudCategory.name,
              budgetType: cloudCategory.budgetType,
              bucketId: cloudCategory.bucketId,
              categoryGroup: cloudCategory.categoryGroup,
              monthlyBudget: cloudCategory.monthlyBudget,
              isFixedExpense: cloudCategory.isFixedExpense,
              isActive: cloudCategory.isActive,
              taxDeductibleByDefault: cloudCategory.taxDeductibleByDefault,
              isIncomeCategory: cloudCategory.isIncomeCategory,
              excludeFromBudget: cloudCategory.excludeFromBudget,
              icon: cloudCategory.icon,
              deletedAt: cloudCategory.deletedAt || null,
              updatedAt: cloudCategory.updatedAt,
            })
          } else {
            // Create new category
            await databaseService.createCategoryForSync({
              id: cloudCategory.id,
              profileId: profileId,
              name: cloudCategory.name,
              budgetType: cloudCategory.budgetType,
              bucketId: cloudCategory.bucketId,
              categoryGroup: cloudCategory.categoryGroup,
              monthlyBudget: cloudCategory.monthlyBudget,
              isFixedExpense: cloudCategory.isFixedExpense,
              isActive: cloudCategory.isActive,
              taxDeductibleByDefault: cloudCategory.taxDeductibleByDefault,
              isIncomeCategory: cloudCategory.isIncomeCategory,
              excludeFromBudget: cloudCategory.excludeFromBudget,
              icon: cloudCategory.icon,
              deletedAt: cloudCategory.deletedAt || null,
              createdAt: cloudCategory.createdAt,
              updatedAt: cloudCategory.updatedAt,
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
   * Pull transactions from cloud and update local database
   */
  private async pullTransactions(profileId: string): Promise<void> {
    try {
      // Verify profile exists locally before pulling transactions
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping transaction pull`)
        return
      }

      const cloudTransactions = await getRecordsFromCloud('transactions', profileId)

      for (const cloudTransaction of cloudTransactions) {
        // Only sync transactions that belong to this profile
        if (cloudTransaction.profileId !== profileId) {
          continue
        }

        const localTransaction = await databaseService.getTransaction(cloudTransaction.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localTransaction ||
          !localTransaction.updated_at ||
          !cloudTransaction.updatedAt ||
          new Date(cloudTransaction.updatedAt) > new Date(localTransaction.updated_at)
        ) {
          if (localTransaction) {
            // Update existing
            await databaseService.updateTransaction(cloudTransaction.id, {
              date: cloudTransaction.date,
              description: cloudTransaction.description,
              amount: cloudTransaction.amount,
              category_id: cloudTransaction.categoryId,
              bucket_id: cloudTransaction.bucketId,
              budget_type: cloudTransaction.budgetType,
              account_id: cloudTransaction.accountId,
              to_account_id: cloudTransaction.toAccountId,
              linked_transaction_id: cloudTransaction.linkedTransactionId,
              project_id: cloudTransaction.projectId,
              income_source_id: cloudTransaction.incomeSourceId,
              tax_deductible: cloudTransaction.taxDeductible,
              reconciled: cloudTransaction.reconciled,
              notes: cloudTransaction.notes,
            })
          } else {
            // Create new
            await databaseService.createTransaction({
              id: cloudTransaction.id,
              profile_id: profileId,
              date: cloudTransaction.date,
              description: cloudTransaction.description,
              amount: cloudTransaction.amount,
              category_id: cloudTransaction.categoryId,
              bucket_id: cloudTransaction.bucketId,
              budget_type: cloudTransaction.budgetType,
              account_id: cloudTransaction.accountId,
              to_account_id: cloudTransaction.toAccountId,
              linked_transaction_id: cloudTransaction.linkedTransactionId,
              project_id: cloudTransaction.projectId,
              income_source_id: cloudTransaction.incomeSourceId,
              tax_deductible: cloudTransaction.taxDeductible,
              reconciled: cloudTransaction.reconciled,
              notes: cloudTransaction.notes,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull transactions:', error)
      throw error
    }
  }

  /**
   * Pull income sources from cloud and update local database
   */
  private async pullIncomeSources(profileId: string): Promise<void> {
    try {
      // Verify profile exists locally before pulling income sources
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping income source pull`)
        return
      }

      const cloudIncomeSources = await getRecordsFromCloud('incomeSources', profileId)

      for (const cloudIncomeSource of cloudIncomeSources) {
        // Only sync income sources that belong to this profile
        if (cloudIncomeSource.profileId !== profileId) {
          continue
        }

        const localIncomeSource = await databaseService.getIncomeSource(cloudIncomeSource.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localIncomeSource ||
          !localIncomeSource.updated_at ||
          !cloudIncomeSource.updatedAt ||
          new Date(cloudIncomeSource.updatedAt) > new Date(localIncomeSource.updated_at)
        ) {
          if (localIncomeSource) {
            // Update existing
            await databaseService.updateIncomeSource(cloudIncomeSource.id, {
              name: cloudIncomeSource.name,
              budget_type: cloudIncomeSource.budgetType,
              income_type: cloudIncomeSource.incomeType,
              category_id: cloudIncomeSource.categoryId,
              expected_amount: cloudIncomeSource.expectedAmount,
              frequency: cloudIncomeSource.frequency,
              next_expected_date: cloudIncomeSource.nextExpectedDate,
              client_source: cloudIncomeSource.clientSource,
              is_active: cloudIncomeSource.isActive,
            })
          } else {
            // Create new
            await databaseService.createIncomeSource({
              id: cloudIncomeSource.id,
              profile_id: profileId,
              name: cloudIncomeSource.name,
              budget_type: cloudIncomeSource.budgetType,
              income_type: cloudIncomeSource.incomeType,
              category_id: cloudIncomeSource.categoryId,
              expected_amount: cloudIncomeSource.expectedAmount,
              frequency: cloudIncomeSource.frequency,
              next_expected_date: cloudIncomeSource.nextExpectedDate,
              client_source: cloudIncomeSource.clientSource,
              is_active: cloudIncomeSource.isActive,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull income sources:', error)
      throw error
    }
  }

  /**
   * Pull projects from cloud and update local database
   */
  private async pullProjects(profileId: string): Promise<void> {
    try {
      // Verify profile exists locally before pulling projects
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping project pull`)
        return
      }

      const cloudProjects = await getRecordsFromCloud('projects', profileId)

      for (const cloudProject of cloudProjects) {
        // Only sync projects that belong to this profile
        if (cloudProject.profileId !== profileId) {
          continue
        }

        const localProject = await databaseService.getProject(cloudProject.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localProject ||
          !localProject.updated_at ||
          !cloudProject.updatedAt ||
          new Date(cloudProject.updatedAt) > new Date(localProject.updated_at)
        ) {
          if (localProject) {
            // Update existing
            await databaseService.updateProject(cloudProject.id, {
              name: cloudProject.name,
              budget_type: cloudProject.budgetType,
              project_type_id: cloudProject.projectTypeId,
              status_id: cloudProject.statusId,
              income_source_id: cloudProject.incomeSourceId,
              budget: cloudProject.budget,
              date_created: cloudProject.dateCreated,
              date_completed: cloudProject.dateCompleted,
              commission_paid: cloudProject.commissionPaid,
              notes: cloudProject.notes,
            })
          } else {
            // Create new
            await databaseService.createProject({
              id: cloudProject.id,
              profile_id: profileId,
              name: cloudProject.name,
              budget_type: cloudProject.budgetType,
              project_type_id: cloudProject.projectTypeId,
              status_id: cloudProject.statusId,
              income_source_id: cloudProject.incomeSourceId,
              budget: cloudProject.budget,
              date_created: cloudProject.dateCreated,
              date_completed: cloudProject.dateCompleted,
              commission_paid: cloudProject.commissionPaid,
              notes: cloudProject.notes,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull projects:', error)
      throw error
    }
  }

  /**
   * Pull project types from cloud and update local database
   */
  private async pullProjectTypes(profileId: string): Promise<void> {
    try {
      // Verify profile exists locally before pulling project types
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping project type pull`)
        return
      }

      const cloudProjectTypes = await getRecordsFromCloud('projectTypes', profileId)

      for (const cloudProjectType of cloudProjectTypes) {
        // Only sync project types that belong to this profile
        if (cloudProjectType.profileId !== profileId) {
          continue
        }

        const localProjectType = await databaseService.getProjectType(cloudProjectType.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localProjectType ||
          !localProjectType.updated_at ||
          !cloudProjectType.updatedAt ||
          new Date(cloudProjectType.updatedAt) > new Date(localProjectType.updated_at)
        ) {
          if (localProjectType) {
            // Update existing
            await databaseService.updateProjectType(cloudProjectType.id, {
              name: cloudProjectType.name,
              budget_type: cloudProjectType.budgetType,
              allowed_statuses: cloudProjectType.allowedStatuses,
            })
          } else {
            // Create new
            await databaseService.createProjectType({
              id: cloudProjectType.id,
              profile_id: profileId,
              name: cloudProjectType.name,
              budget_type: cloudProjectType.budgetType,
              allowed_statuses: cloudProjectType.allowedStatuses,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull project types:', error)
      throw error
    }
  }

  /**
   * Pull project statuses from cloud and update local database
   */
  private async pullProjectStatuses(profileId: string): Promise<void> {
    try {
      // Verify profile exists locally before pulling project statuses
      const localProfile = await databaseService.getProfile(profileId)
      if (!localProfile) {
        console.warn(`Profile ${profileId} not found locally, skipping project status pull`)
        return
      }

      const cloudProjectStatuses = await getRecordsFromCloud('projectStatuses', profileId)

      for (const cloudProjectStatus of cloudProjectStatuses) {
        // Only sync project statuses that belong to this profile
        if (cloudProjectStatus.profileId !== profileId) {
          continue
        }

        const localProjectStatus = await databaseService.getProjectStatus(cloudProjectStatus.id)

        // Compare timestamps - update if cloud is newer
        if (
          !localProjectStatus ||
          !localProjectStatus.updated_at ||
          !cloudProjectStatus.updatedAt ||
          new Date(cloudProjectStatus.updatedAt) > new Date(localProjectStatus.updated_at)
        ) {
          if (localProjectStatus) {
            // Update existing
            await databaseService.updateProjectStatus(cloudProjectStatus.id, {
              name: cloudProjectStatus.name,
              description: cloudProjectStatus.description,
            })
          } else {
            // Create new
            await databaseService.createProjectStatus({
              id: cloudProjectStatus.id,
              profile_id: profileId,
              name: cloudProjectStatus.name,
              description: cloudProjectStatus.description,
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull project statuses:', error)
      throw error
    }
  }

  /**
   * Clean up orphaned data from deleted profiles
   * This removes any accounts, categories, transactions, etc. that belong to profiles that no longer exist
   */
  private async cleanupOrphanedData(): Promise<void> {
    try {
      // Get all existing profiles
      const profiles = await databaseService.getAllProfiles()
      const validProfileIds = new Set(profiles.map((p: any) => p.id))

      // Get all accounts and delete those with invalid profile_id
      const allAccounts = await databaseService.getAccounts('')
      for (const account of allAccounts as any[]) {
        if (!validProfileIds.has(account.profile_id)) {
          console.log(`Deleting orphaned account: ${account.id} (profile: ${account.profile_id})`)
          await databaseService.deleteAccount(account.id)
        }
      }

      // Get all categories and delete those with invalid profile_id
      const allCategories = await databaseService.getCategories('')
      for (const category of allCategories as any[]) {
        if (!validProfileIds.has(category.profile_id)) {
          console.log(`Deleting orphaned category: ${category.id} (profile: ${category.profile_id})`)
          await databaseService.deleteCategory(category.id)
        }
      }

      // Get all transactions and delete those with invalid profile_id
      const allTransactions = await databaseService.getTransactions('')
      for (const transaction of allTransactions as any[]) {
        if (!validProfileIds.has(transaction.profile_id)) {
          console.log(`Deleting orphaned transaction: ${transaction.id} (profile: ${transaction.profile_id})`)
          await databaseService.deleteTransaction(transaction.id)
        }
      }

      // Get all income sources and delete those with invalid profile_id
      const allIncomeSources = await databaseService.getIncomeSources('')
      for (const source of allIncomeSources as any[]) {
        if (!validProfileIds.has(source.profile_id)) {
          console.log(`Deleting orphaned income source: ${source.id} (profile: ${source.profile_id})`)
          await databaseService.deleteIncomeSource(source.id)
        }
      }

      // Get all projects and delete those with invalid profile_id
      const allProjects = await databaseService.getProjects('')
      for (const project of allProjects as any[]) {
        if (!validProfileIds.has(project.profile_id)) {
          console.log(`Deleting orphaned project: ${project.id} (profile: ${project.profile_id})`)
          await databaseService.deleteProject(project.id)
        }
      }

      // Get all project types and delete those with invalid profile_id
      const allProjectTypes = await databaseService.getProjectTypes('')
      for (const type of allProjectTypes as any[]) {
        if (!validProfileIds.has(type.profile_id)) {
          console.log(`Deleting orphaned project type: ${type.id} (profile: ${type.profile_id})`)
          await databaseService.deleteProjectType(type.id)
        }
      }

      // Get all project statuses and delete those with invalid profile_id
      const allProjectStatuses = await databaseService.getProjectStatuses('')
      for (const status of allProjectStatuses as any[]) {
        if (!validProfileIds.has(status.profile_id)) {
          console.log(`Deleting orphaned project status: ${status.id} (profile: ${status.profile_id})`)
          await databaseService.deleteProjectStatus(status.id)
        }
      }

      console.log('Cleanup of orphaned data completed')
    } catch (error) {
      console.error('Failed to cleanup orphaned data:', error)
      // Don't throw - allow sync to continue
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

      // Clean up any orphaned data from deleted profiles
      this.notifyProgress({ status: 'syncing', message: 'Cleaning up orphaned data...' })
      await this.cleanupOrphanedData()

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
      // Important: Pull in dependency order (parent tables before child tables)
      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling profiles...',
        current: 9,
        total: totalSteps,
      })
      await this.pullProfiles(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling project statuses...',
        current: 10,
        total: totalSteps,
      })
      await this.pullProjectStatuses(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling project types...',
        current: 11,
        total: totalSteps,
      })
      await this.pullProjectTypes(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling accounts...',
        current: 12,
        total: totalSteps,
      })
      await this.pullAccounts(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling categories...',
        current: 13,
        total: totalSteps,
      })
      await this.pullCategories(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling income sources...',
        current: 14,
        total: totalSteps,
      })
      await this.pullIncomeSources(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling projects...',
        current: 15,
        total: totalSteps,
      })
      await this.pullProjects(profileId)

      this.notifyProgress({
        status: 'syncing',
        message: 'Pulling transactions...',
        current: 16,
        total: totalSteps,
      })
      await this.pullTransactions(profileId)

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
