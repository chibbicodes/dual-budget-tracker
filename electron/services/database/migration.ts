/**
 * Migration utility to move data from localStorage to SQLite
 */

interface LocalStorageProfile {
  id: string
  name: string
  description?: string
  passwordHash?: string
  passwordHint?: string
  createdAt: string
  updatedAt: string
  lastAccessedAt: string
}

/**
 * Check if there's localStorage data that needs migration
 */
export function hasLocalStorageData(): boolean {
  const profiles = localStorage.getItem('profiles')
  return profiles !== null && profiles !== '[]'
}

/**
 * Get all profiles from localStorage
 */
function getLocalStorageProfiles(): LocalStorageProfile[] {
  const profilesStr = localStorage.getItem('profiles')
  if (!profilesStr) return []

  try {
    return JSON.parse(profilesStr)
  } catch (error) {
    console.error('Failed to parse profiles from localStorage:', error)
    return []
  }
}

/**
 * Get profile data from localStorage
 */
function getProfileDataFromLocalStorage(profileId: string): any {
  const key = `profile_${profileId}`
  const dataStr = localStorage.getItem(key)

  if (!dataStr) return null

  try {
    return JSON.parse(dataStr)
  } catch (error) {
    console.error(`Failed to parse profile data for ${profileId}:`, error)
    return null
  }
}

/**
 * Migrate a single profile from localStorage to SQLite
 */
async function migrateProfile(localProfile: LocalStorageProfile, databaseService: any): Promise<void> {
  console.log(`Migrating profile: ${localProfile.name}`)

  // Create profile in SQLite
  databaseService.createProfile({
    id: localProfile.id,
    name: localProfile.name,
    description: localProfile.description,
    password_hash: localProfile.passwordHash,
    password_hint: localProfile.passwordHint,
  })

  // Get profile data from localStorage
  const profileData = getProfileDataFromLocalStorage(localProfile.id)
  if (!profileData) {
    console.log(`No data found for profile ${localProfile.name}`)
    return
  }

  // Migrate settings
  if (profileData.settings) {
    const settings: any = {}

    // Map localStorage settings to SQLite schema
    if (profileData.settings.defaultBudgetView) {
      settings.default_budget_view = profileData.settings.defaultBudgetView
    }
    if (profileData.settings.dateFormat) {
      settings.date_format = profileData.settings.dateFormat
    }
    if (profileData.settings.currencySymbol) {
      settings.currency_symbol = profileData.settings.currencySymbol
    }
    if (profileData.settings.firstRunCompleted !== undefined) {
      settings.first_run_completed = profileData.settings.firstRunCompleted ? 1 : 0
    }
    if (profileData.settings.trackBusiness !== undefined) {
      settings.track_business = profileData.settings.trackBusiness ? 1 : 0
    }
    if (profileData.settings.trackHousehold !== undefined) {
      settings.track_household = profileData.settings.trackHousehold ? 1 : 0
    }

    // Household percentages
    if (profileData.settings.householdNeedsPercentage !== undefined) {
      settings.household_needs_percentage = profileData.settings.householdNeedsPercentage
    }
    if (profileData.settings.householdWantsPercentage !== undefined) {
      settings.household_wants_percentage = profileData.settings.householdWantsPercentage
    }
    if (profileData.settings.householdSavingsPercentage !== undefined) {
      settings.household_savings_percentage = profileData.settings.householdSavingsPercentage
    }
    if (profileData.settings.householdMonthlyIncomeBaseline !== undefined) {
      settings.household_monthly_income_baseline = profileData.settings.householdMonthlyIncomeBaseline
    }

    // Business percentages
    if (profileData.settings.businessOperatingPercentage !== undefined) {
      settings.business_operating_percentage = profileData.settings.businessOperatingPercentage
    }
    if (profileData.settings.businessGrowthPercentage !== undefined) {
      settings.business_growth_percentage = profileData.settings.businessGrowthPercentage
    }
    if (profileData.settings.businessCompensationPercentage !== undefined) {
      settings.business_compensation_percentage = profileData.settings.businessCompensationPercentage
    }
    if (profileData.settings.businessTaxReservePercentage !== undefined) {
      settings.business_tax_reserve_percentage = profileData.settings.businessTaxReservePercentage
    }
    if (profileData.settings.businessSavingsPercentage !== undefined) {
      settings.business_savings_percentage = profileData.settings.businessSavingsPercentage
    }
    if (profileData.settings.businessMonthlyRevenueBaseline !== undefined) {
      settings.business_monthly_revenue_baseline = profileData.settings.businessMonthlyRevenueBaseline
    }

    if (Object.keys(settings).length > 0) {
      databaseService.updateSettings(localProfile.id, settings)
    }
  }

  // Migrate accounts
  if (profileData.accounts && Array.isArray(profileData.accounts)) {
    for (const account of profileData.accounts) {
      try {
        databaseService.createAccount({
          id: account.id,
          profile_id: localProfile.id,
          name: account.name,
          budget_type: account.budgetType || 'household',
          account_type: account.type || account.accountType,
          balance: account.balance || 0,
          interest_rate: account.interestRate,
          credit_limit: account.creditLimit,
          payment_due_date: account.paymentDueDate,
          minimum_payment: account.minimumPayment,
          website_url: account.websiteUrl,
          notes: account.notes,
        })
      } catch (error) {
        console.error(`Failed to migrate account ${account.name}:`, error)
      }
    }
  }

  // Migrate categories
  if (profileData.categories && Array.isArray(profileData.categories)) {
    for (const category of profileData.categories) {
      try {
        databaseService.createCategory({
          id: category.id,
          profile_id: localProfile.id,
          name: category.name,
          budget_type: category.budgetType || 'household',
          bucket_id: category.bucketId || category.bucket,
          category_group: category.categoryGroup || category.group,
          monthly_budget: category.monthlyBudget || category.budget || 0,
          is_fixed_expense: category.isFixedExpense ? 1 : 0,
          is_active: category.isActive !== false ? 1 : 0,
          tax_deductible_by_default: category.taxDeductibleByDefault ? 1 : 0,
          is_income_category: category.isIncomeCategory ? 1 : 0,
          exclude_from_budget: category.excludeFromBudget ? 1 : 0,
          icon: category.icon,
        })
      } catch (error) {
        console.error(`Failed to migrate category ${category.name}:`, error)
      }
    }
  }

  // Migrate transactions
  if (profileData.transactions && Array.isArray(profileData.transactions)) {
    for (const transaction of profileData.transactions) {
      try {
        databaseService.createTransaction({
          id: transaction.id,
          profile_id: localProfile.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category_id: transaction.categoryId || transaction.category,
          bucket_id: transaction.bucketId || transaction.bucket,
          budget_type: transaction.budgetType || 'household',
          account_id: transaction.accountId || transaction.account,
          to_account_id: transaction.toAccountId,
          linked_transaction_id: transaction.linkedTransactionId,
          project_id: transaction.projectId,
          income_source_id: transaction.incomeSourceId,
          tax_deductible: transaction.taxDeductible ? 1 : 0,
          reconciled: transaction.reconciled ? 1 : 0,
          notes: transaction.notes,
        })
      } catch (error) {
        console.error(`Failed to migrate transaction ${transaction.description}:`, error)
      }
    }
  }

  // Migrate income sources
  if (profileData.incomeSources && Array.isArray(profileData.incomeSources)) {
    for (const source of profileData.incomeSources) {
      try {
        databaseService.createIncomeSource({
          id: source.id,
          profile_id: localProfile.id,
          name: source.name,
          budget_type: source.budgetType || 'household',
          income_type: source.incomeType || source.type,
          category_id: source.categoryId,
          expected_amount: source.expectedAmount || 0,
          frequency: source.frequency,
          next_expected_date: source.nextExpectedDate,
          client_source: source.clientSource || source.client,
          is_active: source.isActive !== false ? 1 : 0,
        })
      } catch (error) {
        console.error(`Failed to migrate income source ${source.name}:`, error)
      }
    }
  }

  // Migrate projects
  if (profileData.projects && Array.isArray(profileData.projects)) {
    for (const project of profileData.projects) {
      try {
        databaseService.createProject({
          id: project.id,
          profile_id: localProfile.id,
          name: project.name,
          budget_type: project.budgetType || 'household',
          project_type_id: project.projectTypeId || project.type,
          status_id: project.statusId || project.status,
          income_source_id: project.incomeSourceId,
          budget: project.budget,
          date_created: project.dateCreated || project.createdDate,
          date_completed: project.dateCompleted || project.completedDate,
          commission_paid: project.commissionPaid ? 1 : 0,
          notes: project.notes,
        })
      } catch (error) {
        console.error(`Failed to migrate project ${project.name}:`, error)
      }
    }
  }

  // Migrate project types
  if (profileData.projectTypes && Array.isArray(profileData.projectTypes)) {
    for (const type of profileData.projectTypes) {
      try {
        databaseService.createProjectType({
          id: type.id,
          profile_id: localProfile.id,
          name: type.name,
          budget_type: type.budgetType || 'household',
          allowed_statuses: type.allowedStatuses || [],
        })
      } catch (error) {
        console.error(`Failed to migrate project type ${type.name}:`, error)
      }
    }
  }

  // Migrate project statuses
  if (profileData.projectStatuses && Array.isArray(profileData.projectStatuses)) {
    for (const status of profileData.projectStatuses) {
      try {
        databaseService.createProjectStatus({
          id: status.id,
          profile_id: localProfile.id,
          name: status.name,
          description: status.description,
        })
      } catch (error) {
        console.error(`Failed to migrate project status ${status.name}:`, error)
      }
    }
  }

  // Migrate monthly budgets
  if (profileData.monthlyBudgets && Array.isArray(profileData.monthlyBudgets)) {
    for (const budget of profileData.monthlyBudgets) {
      try {
        databaseService.upsertMonthlyBudget({
          profile_id: localProfile.id,
          month: budget.month,
          budget_type: budget.budgetType || 'household',
          category_id: budget.categoryId,
          amount: budget.amount || 0,
        })
      } catch (error) {
        console.error(`Failed to migrate monthly budget:`, error)
      }
    }
  }

  // Migrate auto-categorization rules
  if (profileData.autoCategorizationRules && Array.isArray(profileData.autoCategorizationRules)) {
    for (const rule of profileData.autoCategorizationRules) {
      try {
        databaseService.createAutoCategorizationRule({
          id: rule.id,
          profile_id: localProfile.id,
          vendor_pattern: rule.vendorPattern || rule.pattern,
          budget_type: rule.budgetType || 'household',
          category_id: rule.categoryId,
          case_sensitive: rule.caseSensitive ? 1 : 0,
          is_active: rule.isActive !== false ? 1 : 0,
        })
      } catch (error) {
        console.error(`Failed to migrate auto-categorization rule:`, error)
      }
    }
  }

  console.log(`Completed migration for profile: ${localProfile.name}`)
}

/**
 * Migrate all data from localStorage to SQLite
 */
export async function migrateFromLocalStorage(databaseService: any): Promise<{
  success: boolean
  profilesMigrated: number
  errors: string[]
}> {
  const errors: string[] = []
  let profilesMigrated = 0

  try {
    console.log('Starting migration from localStorage to SQLite...')

    // Get all profiles from localStorage
    const localProfiles = getLocalStorageProfiles()
    console.log(`Found ${localProfiles.length} profiles in localStorage`)

    if (localProfiles.length === 0) {
      return { success: true, profilesMigrated: 0, errors: [] }
    }

    // Migrate each profile
    for (const profile of localProfiles) {
      try {
        await migrateProfile(profile, databaseService)
        profilesMigrated++
      } catch (error) {
        const errorMsg = `Failed to migrate profile ${profile.name}: ${error}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    console.log(`Migration completed. ${profilesMigrated} profiles migrated successfully.`)

    return {
      success: errors.length === 0,
      profilesMigrated,
      errors,
    }
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`
    console.error(errorMsg)
    errors.push(errorMsg)

    return {
      success: false,
      profilesMigrated,
      errors,
    }
  }
}

/**
 * Backup localStorage data to a JSON file
 */
export function backupLocalStorageData(): string {
  const backup: any = {
    profiles: getLocalStorageProfiles(),
    profileData: {},
    timestamp: new Date().toISOString(),
  }

  // Get data for each profile
  for (const profile of backup.profiles) {
    const data = getProfileDataFromLocalStorage(profile.id)
    if (data) {
      backup.profileData[profile.id] = data
    }
  }

  return JSON.stringify(backup, null, 2)
}

/**
 * Clear localStorage after successful migration
 */
export function clearLocalStorageData(): void {
  const profiles = getLocalStorageProfiles()

  // Remove profiles list
  localStorage.removeItem('profiles')

  // Remove each profile's data
  for (const profile of profiles) {
    localStorage.removeItem(`profile_${profile.id}`)
  }

  // Remove active profile
  localStorage.removeItem('activeProfile')

  console.log('localStorage data cleared')
}
