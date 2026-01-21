import type { Profile, ProfileMetadata, AppData } from '../types'
import { StorageService } from './storage'

const PROFILE_METADATA_KEY = 'dual-budget-tracker-profiles'
const PROFILE_DATA_PREFIX = 'dual-budget-tracker-profile-'
const CURRENT_VERSION = '1.0.0'

/**
 * Profile management service
 * Handles creating, switching, and managing multiple budget profiles
 */
export class ProfileService {
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
   */
  static loadMetadata(): ProfileMetadata {
    try {
      const stored = localStorage.getItem(PROFILE_METADATA_KEY)
      if (!stored) {
        // Initialize with default empty metadata
        return {
          profiles: [],
          activeProfileId: null,
          version: CURRENT_VERSION,
        }
      }

      const metadata: ProfileMetadata = JSON.parse(stored)
      return metadata
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
   * Save profile metadata
   */
  static saveMetadata(metadata: ProfileMetadata): void {
    try {
      localStorage.setItem(PROFILE_METADATA_KEY, JSON.stringify(metadata))
    } catch (error) {
      console.error('Error saving profile metadata:', error)
      throw new Error('Failed to save profile metadata')
    }
  }

  /**
   * Create a new profile
   */
  static async createProfile(name: string, description?: string, password?: string, passwordHint?: string): Promise<Profile> {
    const metadata = this.loadMetadata()

    // Generate unique ID
    const id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const now = new Date().toISOString()

    // Hash password if provided
    let passwordHash: string | undefined
    if (password && password.trim()) {
      passwordHash = await this.hashPassword(password)
    }

    const newProfile: Profile = {
      id,
      name,
      description,
      passwordHash,
      passwordHint: passwordHint?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    }

    // Add to metadata
    metadata.profiles.push(newProfile)

    // If this is the first profile, set it as active
    if (metadata.profiles.length === 1) {
      metadata.activeProfileId = id
    }

    this.saveMetadata(metadata)

    // Initialize empty data for this profile
    const emptyData = StorageService.getDefaultData()
    this.saveProfileData(id, emptyData)

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
    const metadata = this.loadMetadata()
    const profile = metadata.profiles.find((p) => p.id === profileId)

    if (!profile) {
      throw new Error('Profile not found')
    }

    // Check password if profile is protected
    if (profile.passwordHash) {
      if (!password) {
        throw new Error('Password required')
      }
      const isValid = await this.verifyPassword(password, profile.passwordHash)
      if (!isValid) {
        throw new Error('Invalid password')
      }
    }

    // Update last accessed time
    profile.lastAccessedAt = new Date().toISOString()
    profile.updatedAt = new Date().toISOString()

    // Set as active
    metadata.activeProfileId = profileId

    this.saveMetadata(metadata)
  }

  /**
   * Logout - clear active profile
   */
  static logout(): void {
    const metadata = this.loadMetadata()
    metadata.activeProfileId = null
    this.saveMetadata(metadata)
  }

  /**
   * Update profile information
   */
  static updateProfile(
    profileId: string,
    updates: Partial<Pick<Profile, 'name' | 'description'>>
  ): void {
    const metadata = this.loadMetadata()
    const profile = metadata.profiles.find((p) => p.id === profileId)

    if (!profile) {
      throw new Error('Profile not found')
    }

    if (updates.name !== undefined) profile.name = updates.name
    if (updates.description !== undefined) profile.description = updates.description
    profile.updatedAt = new Date().toISOString()

    this.saveMetadata(metadata)
  }

  /**
   * Delete a profile
   */
  static deleteProfile(profileId: string): void {
    const metadata = this.loadMetadata()

    const profileIndex = metadata.profiles.findIndex((p) => p.id === profileId)
    if (profileIndex === -1) {
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

    // Remove profile from metadata
    metadata.profiles.splice(profileIndex, 1)

    // Delete profile data from storage
    this.deleteProfileData(profileId)

    this.saveMetadata(metadata)
  }

  /**
   * Load data for a specific profile
   */
  static loadProfileData(profileId: string): AppData | null {
    try {
      const key = `${PROFILE_DATA_PREFIX}${profileId}`
      const stored = localStorage.getItem(key)

      if (!stored) return null

      const data: AppData = JSON.parse(stored)

      // Ensure new fields exist (migration for backward compatibility)
      if (!data.income) data.income = []
      if (!data.monthlyBudgets) data.monthlyBudgets = []
      if (!data.projectStatuses) data.projectStatuses = []
      if (!data.projectTypes) data.projectTypes = []
      if (!data.projects) data.projects = []

      return data
    } catch (error) {
      console.error('Error loading profile data:', error)
      return null
    }
  }

  /**
   * Save data for a specific profile
   */
  static saveProfileData(profileId: string, data: AppData): void {
    try {
      const key = `${PROFILE_DATA_PREFIX}${profileId}`
      const dataToSave = {
        ...data,
        version: CURRENT_VERSION,
      }
      localStorage.setItem(key, JSON.stringify(dataToSave))

      // Update profile's last accessed time
      const metadata = this.loadMetadata()
      const profile = metadata.profiles.find((p) => p.id === profileId)
      if (profile) {
        profile.lastAccessedAt = new Date().toISOString()
        profile.updatedAt = new Date().toISOString()
        this.saveMetadata(metadata)
      }
    } catch (error) {
      console.error('Error saving profile data:', error)
      throw new Error('Failed to save profile data')
    }
  }

  /**
   * Delete data for a specific profile
   */
  private static deleteProfileData(profileId: string): void {
    try {
      const key = `${PROFILE_DATA_PREFIX}${profileId}`
      localStorage.removeItem(key)
    } catch (error) {
      console.error('Error deleting profile data:', error)
    }
  }

  /**
   * Export profile data as JSON
   */
  static exportProfile(profileId: string): string {
    const profile = this.getAllProfiles().find((p) => p.id === profileId)
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
   */
  static async importProfile(jsonString: string, profileName?: string): Promise<Profile> {
    try {
      const importedData = JSON.parse(jsonString)

      // Create new profile
      const name = profileName || importedData.profile?.name || `Imported Profile ${Date.now()}`
      const description = importedData.profile?.description || 'Imported from file'

      const newProfile = await this.createProfile(name, description)

      // Import data into new profile
      if (importedData.data) {
        this.saveProfileData(newProfile.id, importedData.data)
      }

      return newProfile
    } catch (error) {
      console.error('Error importing profile:', error)
      throw new Error('Failed to import profile. Invalid JSON format.')
    }
  }

  /**
   * Migrate old single-profile data to new profile system
   * This is called once to migrate existing users' data
   */
  static async migrateOldData(): Promise<boolean> {
    try {
      const metadata = this.loadMetadata()

      // If profiles already exist, no need to migrate
      if (metadata.profiles.length > 0) {
        return false
      }

      // Try to load old data
      const oldData = StorageService.load()
      if (!oldData) {
        return false
      }

      // Create a default profile with the old data
      const profile = await this.createProfile('My Budget', 'Migrated from previous version')
      this.saveProfileData(profile.id, oldData)

      // Clear old storage key
      localStorage.removeItem('dual-budget-tracker-data')

      return true
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
    const metadata = this.loadMetadata()
    const profile = metadata.profiles.find((p) => p.id === profileId)

    if (!profile) {
      throw new Error('Profile not found')
    }

    // If profile already has a password, verify current password
    if (profile.passwordHash) {
      if (!currentPassword) {
        throw new Error('Current password is required')
      }
      const isValid = await this.verifyPassword(currentPassword, profile.passwordHash)
      if (!isValid) {
        throw new Error('Current password is incorrect')
      }
    }

    // Validate new password
    if (!newPassword || !newPassword.trim()) {
      throw new Error('New password cannot be empty')
    }

    // Hash the new password
    profile.passwordHash = await this.hashPassword(newPassword.trim())
    profile.passwordHint = passwordHint?.trim() || undefined
    profile.updatedAt = new Date().toISOString()

    this.saveMetadata(metadata)
  }

  /**
   * Remove password from a profile
   * @param profileId - The profile to update
   * @param currentPassword - Current password (required for verification)
   */
  static async removePassword(profileId: string, currentPassword: string): Promise<void> {
    const metadata = this.loadMetadata()
    const profile = metadata.profiles.find((p) => p.id === profileId)

    if (!profile) {
      throw new Error('Profile not found')
    }

    if (!profile.passwordHash) {
      throw new Error('Profile does not have a password')
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, profile.passwordHash)
    if (!isValid) {
      throw new Error('Password is incorrect')
    }

    // Remove password and hint
    profile.passwordHash = undefined
    profile.passwordHint = undefined
    profile.updatedAt = new Date().toISOString()

    this.saveMetadata(metadata)
  }
}

export default ProfileService
