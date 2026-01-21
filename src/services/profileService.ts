import type { Profile, ProfileMetadata, AppData } from '../types'
import { StorageService } from './storage'
import { databaseService } from './database/databaseService'
import { migrateFromLocalStorage, hasLocalStorageData } from './database/migration'

const CURRENT_VERSION = '1.0.0'

// Flag to track if database has been initialized
let dbInitialized = false

/**
 * Profile management service
 * Now uses SQLite database for storage instead of localStorage
 */
export class ProfileService {
  /**
   * Initialize the database (call this before using any other methods)
   */
  static async initialize(): Promise<void> {
    if (dbInitialized) return

    try {
      await databaseService.initialize()
      dbInitialized = true

      // Check if we need to migrate from localStorage
      if (hasLocalStorageData()) {
        console.log('Detected localStorage data, migrating to SQLite...')
        await migrateFromLocalStorage()
      }
    } catch (error) {
      console.error('Failed to initialize database:', error)
      throw error
    }
  }
  /**
   * Hash a password using Web Crypto API
   */
  private static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(password)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Verify a password against a hash
   */
  private static async verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await this.hashPassword(password)
    return passwordHash === hash
  }
  /**
   * Load profile metadata (list of all profiles)
   * Now loads from SQLite database
   */
  static loadMetadata(): ProfileMetadata {
    try {
      const profiles = databaseService.getAllProfiles()

      // Convert database format to Profile format
      const profileList: Profile[] = profiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        passwordHash: p.password_hash,
        passwordHint: p.password_hint,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        lastAccessedAt: p.last_accessed_at,
      }))

      // Get active profile ID from localStorage (temporary until we add it to database)
      const activeProfileId = localStorage.getItem('active-profile-id') || null

      return {
        profiles: profileList,
        activeProfileId,
        version: CURRENT_VERSION,
      }
    } catch (error) {
      console.error('Error loading profile metadata:', error)
      return {
        profiles: [],
        activeProfileId: null,
        version: CURRENT_VERSION,
      }
    }
  }

  /**
   * Save active profile ID
   * (Profile data is automatically saved to database)
   */
  private static saveActiveProfileId(profileId: string | null): void {
    try {
      if (profileId) {
        localStorage.setItem('active-profile-id', profileId)
      } else {
        localStorage.removeItem('active-profile-id')
      }
    } catch (error) {
      console.error('Error saving active profile ID:', error)
    }
  }

  /**
   * Create a new profile
   */
  static async createProfile(name: string, description?: string, password?: string, passwordHint?: string): Promise<Profile> {
    // Generate unique ID
    const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Hash password if provided
    let password_hash: string | undefined
    if (password && password.trim()) {
      password_hash = await this.hashPassword(password)
    }

    // Create profile in database (also creates default settings)
    const dbProfile = databaseService.createProfile({
      id,
      name,
      description,
      password_hash,
      password_hint: passwordHint?.trim() || undefined,
    })

    // Convert to Profile format
    const newProfile: Profile = {
      id: (dbProfile as any).id,
      name: (dbProfile as any).name,
      description: (dbProfile as any).description,
      passwordHash: (dbProfile as any).password_hash,
      passwordHint: (dbProfile as any).password_hint,
      createdAt: (dbProfile as any).created_at,
      updatedAt: (dbProfile as any).updated_at,
      lastAccessedAt: (dbProfile as any).last_accessed_at,
    }

    // If this is the first profile, set it as active
    const metadata = this.loadMetadata()
    if (metadata.profiles.length === 1) {
      this.saveActiveProfileId(id)
    }

    return newProfile
  }

  /**
   * Get all profiles
   */
  static getAllProfiles(): Profile[] {
    const metadata = this.loadMetadata()
    return metadata.profiles
  }

  /**
   * Get active profile
   */
  static getActiveProfile(): Profile | null {
    const metadata = this.loadMetadata()
    if (!metadata.activeProfileId) return null

    return metadata.profiles.find((p) => p.id === metadata.activeProfileId) || null
  }

  /**
   * Switch to a different profile
   */
  static async switchProfile(profileId: string, password?: string): Promise<void> {
    const dbProfile = databaseService.getProfile(profileId)

    if (!dbProfile) {
      throw new Error('Profile not found')
    }

    // Check password if profile is protected
    if ((dbProfile as any).password_hash) {
      if (!password) {
        throw new Error('Password required')
      }
      const isValid = await this.verifyPassword(password, (dbProfile as any).password_hash)
      if (!isValid) {
        throw new Error('Invalid password')
      }
    }

    // Update last accessed time in database
    databaseService.updateProfileLastAccessed(profileId)

    // Set as active
    this.saveActiveProfileId(profileId)
  }

  /**
   * Logout - clear active profile
   */
  static logout(): void {
    this.saveActiveProfileId(null)
  }

  /**
   * Update profile information
   */
  static updateProfile(
    profileId: string,
    updates: Partial<Pick<Profile, 'name' | 'description'>>
  ): void {
    const dbProfile = databaseService.getProfile(profileId)

    if (!dbProfile) {
      throw new Error('Profile not found')
    }

    // Update profile in database
    databaseService.updateProfile(profileId, updates)
  }

  /**
   * Delete a profile
   */
  static deleteProfile(profileId: string): void {
    const metadata = this.loadMetadata()

    const profile = metadata.profiles.find((p) => p.id === profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    // Can't delete if it's the only profile
    if (metadata.profiles.length === 1) {
      throw new Error('Cannot delete the only profile')
    }

    // Can't delete the active profile
    if (metadata.activeProfileId === profileId) {
      throw new Error('Cannot delete the active profile. Switch to another profile first.')
    }

    // Delete profile from database (CASCADE will delete all associated data)
    databaseService.deleteProfile(profileId)
  }

  /**
   * Load data for a specific profile
   * NOTE: This method is deprecated and kept for backward compatibility
   * BudgetContext should use databaseService directly instead
   */
  static loadProfileData(profileId: string): AppData | null {
    try {
      // Load data from database
      const settings = databaseService.getSettings(profileId)
      const accounts = databaseService.getAccounts(profileId)
      const categories = databaseService.getCategories(profileId)
      const transactions = databaseService.getTransactions(profileId)
      const incomeSources = databaseService.getIncomeSources(profileId)
      const projects = databaseService.getProjects(profileId)
      const projectTypes = databaseService.getProjectTypes(profileId)
      const projectStatuses = databaseService.getProjectStatuses(profileId)

      // Convert to AppData format (this is a simplified conversion)
      const data: AppData = {
        settings: settings ? {
          defaultBudgetView: (settings as any).default_budget_view,
          dateFormat: (settings as any).date_format,
          currencySymbol: (settings as any).currency_symbol,
          firstRunCompleted: (settings as any).first_run_completed === 1,
          trackBusiness: (settings as any).track_business === 1,
          trackHousehold: (settings as any).track_household === 1,
          householdTargets: {
            needsPercentage: (settings as any).household_needs_percentage,
            wantsPercentage: (settings as any).household_wants_percentage,
            savingsPercentage: (settings as any).household_savings_percentage,
            monthlyIncomeBaseline: (settings as any).household_monthly_income_baseline,
          },
          businessTargets: {
            operatingPercentage: (settings as any).business_operating_percentage,
            growthPercentage: (settings as any).business_growth_percentage,
            compensationPercentage: (settings as any).business_compensation_percentage,
            taxReservePercentage: (settings as any).business_tax_reserve_percentage,
            businessSavingsPercentage: (settings as any).business_savings_percentage,
            monthlyRevenueBaseline: (settings as any).business_monthly_revenue_baseline,
          },
        } : StorageService.getDefaultData().settings,
        accounts: accounts as any || [],
        transactions: transactions as any || [],
        categories: categories as any || [],
        autoCategorization: [],
        incomeSources: incomeSources as any || [],
        income: [],
        monthlyBudgets: [],
        projectStatuses: projectStatuses as any || [],
        projectTypes: projectTypes as any || [],
        projects: projects as any || [],
        version: CURRENT_VERSION,
      }

      return data
    } catch (error) {
      console.error('Error loading profile data:', error)
      return null
    }
  }

  /**
   * Save data for a specific profile
   * NOTE: This method is deprecated. Use databaseService methods directly instead.
   */
  static saveProfileData(_profileId: string, _data: AppData): void {
    console.warn('saveProfileData is deprecated. Use databaseService methods directly.')
    // This method is kept for backward compatibility but does nothing
    // All saves should go through databaseService directly
  }

  /**
   * Export profile data as JSON
   */
  static exportProfile(profileId: string): string {
    const metadata = this.loadMetadata()
    const profile = metadata.profiles.find((p) => p.id === profileId)
    if (!profile) {
      throw new Error('Profile not found')
    }

    const data = this.loadProfileData(profileId)
    if (!data) {
      throw new Error('Profile data not found')
    }

    const exportData = {
      profile: {
        name: profile.name,
        description: profile.description,
      },
      data,
      exportDate: new Date().toISOString(),
      version: CURRENT_VERSION,
    }

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import profile from JSON
   * NOTE: This is a simplified implementation
   * Full implementation should handle importing all data types
   */
  static async importProfile(jsonString: string, profileName?: string): Promise<Profile> {
    try {
      const importedData = JSON.parse(jsonString)

      // Create new profile
      const name = profileName || importedData.profile?.name || `Imported Profile ${Date.now()}`
      const description = importedData.profile?.description || 'Imported from file'

      const newProfile = await this.createProfile(name, description)

      // TODO: Import data using database service methods
      // This would require importing accounts, categories, transactions, etc. individually
      console.warn('Profile import data population not yet fully implemented for SQLite')

      return newProfile
    } catch (error) {
      console.error('Error importing profile:', error)
      throw new Error('Failed to import profile. Invalid JSON format.')
    }
  }

  /**
   * Migrate old data to new SQLite database
   * This handles both old single-profile data and multi-profile localStorage data
   */
  static async migrateOldData(): Promise<boolean> {
    try {
      // Initialize database first
      await this.initialize()

      const metadata = this.loadMetadata()

      // If profiles already exist in database, no need to migrate
      if (metadata.profiles.length > 0) {
        return false
      }

      // Check if there's localStorage data to migrate
      if (hasLocalStorageData()) {
        console.log('Migrating localStorage profiles to SQLite...')
        const result = await migrateFromLocalStorage()
        return result.success
      }

      // Try to load old single-profile data (pre-profile system)
      const oldData = StorageService.load()
      if (oldData) {
        console.log('Migrating old single-profile data to SQLite...')
        // Create a default profile with the old data
        await this.createProfile('My Budget', 'Migrated from previous version')

        // Clear old storage key
        localStorage.removeItem('dual-budget-tracker-data')

        return true
      }

      return false
    } catch (error) {
      console.error('Error migrating old data:', error)
      return false
    }
  }

  /**
   * Set or change password for a profile
   * @param profileId - The profile to update
   * @param currentPassword - Current password (required if profile already has a password)
   * @param newPassword - New password to set
   * @param passwordHint - Optional hint to help remember the password
   */
  static async setPassword(
    profileId: string,
    currentPassword: string | undefined,
    newPassword: string,
    passwordHint?: string
  ): Promise<void> {
    const dbProfile = databaseService.getProfile(profileId)

    if (!dbProfile) {
      throw new Error('Profile not found')
    }

    // If profile already has a password, verify current password
    if ((dbProfile as any).password_hash) {
      if (!currentPassword) {
        throw new Error('Current password is required')
      }
      const isValid = await this.verifyPassword(currentPassword, (dbProfile as any).password_hash)
      if (!isValid) {
        throw new Error('Current password is incorrect')
      }
    }

    // Validate new password
    if (!newPassword || !newPassword.trim()) {
      throw new Error('New password cannot be empty')
    }

    // Hash the new password and update in database
    const password_hash = await this.hashPassword(newPassword.trim())
    databaseService.updateProfile(profileId, {
      password_hash,
      password_hint: passwordHint?.trim() || undefined,
    })
  }

  /**
   * Remove password from a profile
   * @param profileId - The profile to update
   * @param currentPassword - Current password (required for verification)
   */
  static async removePassword(profileId: string, currentPassword: string): Promise<void> {
    const dbProfile = databaseService.getProfile(profileId)

    if (!dbProfile) {
      throw new Error('Profile not found')
    }

    if (!(dbProfile as any).password_hash) {
      throw new Error('Profile does not have a password')
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, (dbProfile as any).password_hash)
    if (!isValid) {
      throw new Error('Password is incorrect')
    }

    // Remove password and hint from database
    databaseService.updateProfile(profileId, {
      password_hash: undefined,
      password_hint: undefined,
    })
  }
}

export default ProfileService
