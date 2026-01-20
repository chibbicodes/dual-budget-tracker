import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import type { Profile, ProfileContextState } from '../types'
import ProfileService from '../services/profileService'

const ProfileContext = createContext<ProfileContextState | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Initialize profiles on mount
  useEffect(() => {
    initializeProfiles()
  }, [])

  const initializeProfiles = () => {
    setIsLoading(true)

    try {
      // Try to migrate old data if this is first time using profile system
      ProfileService.migrateOldData()

      // Load profiles
      const loadedProfiles = ProfileService.getAllProfiles()
      setProfiles(loadedProfiles)

      // Load active profile
      const active = ProfileService.getActiveProfile()
      setActiveProfile(active)

      // If no profiles exist, don't create one yet - let the UI handle it
      // This allows the ProfileSelector to show the "Create Profile" screen
    } catch (error) {
      console.error('Error initializing profiles:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createProfile = async (name: string, description?: string): Promise<Profile> => {
    try {
      const newProfile = ProfileService.createProfile(name, description)

      // Refresh profiles list
      const updatedProfiles = ProfileService.getAllProfiles()
      setProfiles(updatedProfiles)

      // Set as active profile
      setActiveProfile(newProfile)

      return newProfile
    } catch (error) {
      console.error('Error creating profile:', error)
      throw error
    }
  }

  const switchProfile = async (profileId: string): Promise<void> => {
    try {
      ProfileService.switchProfile(profileId)

      // Update active profile
      const profile = ProfileService.getActiveProfile()
      setActiveProfile(profile)

      // Refresh profiles list (to update lastAccessedAt)
      const updatedProfiles = ProfileService.getAllProfiles()
      setProfiles(updatedProfiles)

      // Force a page reload to ensure clean state
      // This is important because BudgetContext needs to reload data for new profile
      window.location.reload()
    } catch (error) {
      console.error('Error switching profile:', error)
      throw error
    }
  }

  const updateProfile = (
    profileId: string,
    updates: Partial<Pick<Profile, 'name' | 'description'>>
  ): void => {
    try {
      ProfileService.updateProfile(profileId, updates)

      // Refresh profiles list
      const updatedProfiles = ProfileService.getAllProfiles()
      setProfiles(updatedProfiles)

      // Update active profile if it was updated
      if (activeProfile?.id === profileId) {
        const updated = updatedProfiles.find((p) => p.id === profileId)
        if (updated) {
          setActiveProfile(updated)
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  const deleteProfile = async (profileId: string): Promise<void> => {
    try {
      ProfileService.deleteProfile(profileId)

      // Refresh profiles list
      const updatedProfiles = ProfileService.getAllProfiles()
      setProfiles(updatedProfiles)
    } catch (error) {
      console.error('Error deleting profile:', error)
      throw error
    }
  }

  const refreshProfiles = (): void => {
    const updatedProfiles = ProfileService.getAllProfiles()
    setProfiles(updatedProfiles)

    const active = ProfileService.getActiveProfile()
    setActiveProfile(active)
  }

  const value: ProfileContextState = {
    profiles,
    activeProfile,
    isLoading,
    createProfile,
    switchProfile,
    updateProfile,
    deleteProfile,
    refreshProfiles,
  }

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
