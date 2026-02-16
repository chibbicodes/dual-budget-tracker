import { useState, useCallback, useRef, useEffect } from 'react'
import * as SecureStore from 'expo-secure-store'
import { createSyncService, type SyncProgress, type DatabaseAdapter, type StorageAdapter } from '@dual-budget/shared'
import { databaseService } from '../services/database'
import { useAuth } from '../contexts/AuthContext'

/**
 * SecureStore-backed StorageAdapter for mobile (replaces localStorage on desktop)
 */
class MobileStorageAdapter implements StorageAdapter {
  private cache: Record<string, string | null> = {}

  getItem(key: string): string | null {
    return this.cache[key] ?? null
  }

  setItem(key: string, value: string): void {
    this.cache[key] = value
    SecureStore.setItemAsync(key, value).catch(console.error)
  }

  async loadFromStore() {
    try {
      this.cache['lastSyncedAt'] = await SecureStore.getItemAsync('lastSyncedAt')
      this.cache['autoSyncEnabled'] = await SecureStore.getItemAsync('autoSyncEnabled')
    } catch {
      // Ignore errors on initial load
    }
  }
}

const storageAdapter = new MobileStorageAdapter()
const syncService = createSyncService(databaseService as unknown as DatabaseAdapter, storageAdapter)

export function useSync() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<SyncProgress>({ status: 'idle', message: '' })
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    storageAdapter.loadFromStore().then(() => {
      setLastSyncedAt(storageAdapter.getItem('lastSyncedAt'))
    })
  }, [])

  useEffect(() => {
    const unsub = syncService.onSyncProgress((p) => {
      setProgress(p)
      if (p.status === 'success') {
        setLastSyncedAt(new Date().toISOString())
      }
    })
    return unsub
  }, [])

  const syncNow = useCallback(async (profileId: string) => {
    if (!user) return
    try {
      await syncService.syncProfile(profileId)
    } catch (e) {
      console.error('Sync failed:', e)
    }
  }, [user])

  const startAutoSync = useCallback((profileId: string, intervalMinutes = 5) => {
    syncService.startAutoSync(profileId, intervalMinutes)
  }, [])

  const stopAutoSync = useCallback(() => {
    syncService.stopAutoSync()
  }, [])

  const enableRealtimeSync = useCallback((profileId: string, onUpdate: () => void) => {
    if (unsubRef.current) unsubRef.current()
    unsubRef.current = syncService.enableRealtimeSync(profileId, onUpdate)
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [])

  return {
    progress,
    lastSyncedAt,
    isSyncing: progress.status === 'syncing',
    syncNow,
    startAutoSync,
    stopAutoSync,
    enableRealtimeSync,
    isAutoSyncEnabled: syncService.getAutoSyncEnabled(),
    setAutoSyncEnabled: (enabled: boolean) => syncService.setAutoSyncEnabled(enabled),
  }
}
