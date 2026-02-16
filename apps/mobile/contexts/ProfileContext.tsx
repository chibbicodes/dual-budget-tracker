import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import type { Profile } from '@dual-budget/shared'
import { databaseService } from '../services/database'

interface ProfileContextType {
  profiles: Profile[]
  activeProfile: Profile | null
  isLoading: boolean
  createProfile: (name: string, description?: string) => Promise<Profile>
  switchProfile: (profileId: string) => Promise<void>
  updateProfile: (profileId: string, updates: Partial<Pick<Profile, 'name' | 'description'>>) => void
  deleteProfile: (profileId: string) => Promise<void>
  logout: () => void
  refreshProfiles: () => void
}

const ProfileContext = createContext<ProfileContextType>({} as ProfileContextType)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadProfiles = useCallback(async () => {
    try {
      const dbProfiles = await databaseService.getAllProfiles()
      const mapped: Profile[] = dbProfiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        passwordHash: p.password_hash,
        passwordHint: p.password_hint,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        lastAccessedAt: p.last_accessed_at,
      }))
      setProfiles(mapped)
      return mapped
    } catch (e) {
      console.error('Failed to load profiles:', e)
      return []
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      const loaded = await loadProfiles()
      const savedId = await SecureStore.getItemAsync('active-profile-id')
      const match = loaded.find((p) => p.id === savedId) || loaded[0]
      if (match) {
        setActiveProfile(match)
      }
      setIsLoading(false)
    })()
  }, [loadProfiles])

  const createProfile = useCallback(async (name: string, description?: string) => {
    const result = await databaseService.createProfile({ id: crypto.randomUUID(), name, description })
    const profile: Profile = {
      id: result.id,
      name: result.name,
      description: result.description,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      lastAccessedAt: result.last_accessed_at,
    }
    await loadProfiles()
    return profile
  }, [loadProfiles])

  const switchProfile = useCallback(async (profileId: string) => {
    const p = profiles.find((pr) => pr.id === profileId)
    if (p) {
      setActiveProfile(p)
      await SecureStore.setItemAsync('active-profile-id', profileId)
    }
  }, [profiles])

  const updateProfile = useCallback((profileId: string, updates: Partial<Pick<Profile, 'name' | 'description'>>) => {
    databaseService.updateProfile(profileId, updates)
    loadProfiles()
  }, [loadProfiles])

  const deleteProfile = useCallback(async (profileId: string) => {
    await databaseService.deleteProfile(profileId)
    if (activeProfile?.id === profileId) {
      setActiveProfile(null)
      await SecureStore.deleteItemAsync('active-profile-id')
    }
    await loadProfiles()
  }, [activeProfile, loadProfiles])

  const logout = useCallback(() => {
    setActiveProfile(null)
    SecureStore.deleteItemAsync('active-profile-id')
  }, [])

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        isLoading,
        createProfile,
        switchProfile,
        updateProfile,
        deleteProfile,
        logout,
        refreshProfiles: loadProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  return useContext(ProfileContext)
}
