import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  onSnapshot,
  Timestamp,
  DocumentData,
} from 'firebase/firestore'
import { db } from './config'
import { getCurrentUser } from './auth'

/**
 * Firestore Sync Service
 * Syncs local SQLite data to Firestore for cloud storage and multi-device access
 */

export interface SyncableRecord {
  id: string
  profileId: string
  updatedAt?: string
  [key: string]: any
}

/**
 * Get user's Firestore root collection
 */
function getUserCollection(collectionName: string) {
  const user = getCurrentUser()
  if (!user || !db) {
    throw new Error('User not authenticated or Firestore not initialized')
  }
  return collection(db, 'users', user.uid, collectionName)
}

/**
 * Convert SQLite timestamp to Firestore Timestamp
 */
function toFirestoreTimestamp(dateString?: string): Timestamp {
  if (!dateString) {
    return Timestamp.now()
  }
  return Timestamp.fromDate(new Date(dateString))
}

/**
 * Convert Firestore Timestamp to ISO string
 */
function fromFirestoreTimestamp(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString()
}

/**
 * Sync a single record to Firestore
 */
export async function syncRecordToCloud(
  collectionName: string,
  record: SyncableRecord
): Promise<void> {
  try {
    const userCollection = getUserCollection(collectionName)
    const recordRef = doc(userCollection, record.id)

    // Convert dates to Firestore Timestamps
    const firestoreData: DocumentData = {
      ...record,
      updatedAt: toFirestoreTimestamp(record.updatedAt),
      syncedAt: Timestamp.now(),
    }

    await setDoc(recordRef, firestoreData, { merge: true })
    console.log(`Synced ${collectionName}/${record.id} to cloud`)
  } catch (error) {
    console.error(`Failed to sync ${collectionName}/${record.id}:`, error)
    throw error
  }
}

/**
 * Sync multiple records to Firestore
 */
export async function syncRecordsToCloud(
  collectionName: string,
  records: SyncableRecord[]
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0

  for (const record of records) {
    try {
      await syncRecordToCloud(collectionName, record)
      success++
    } catch (error) {
      failed++
    }
  }

  return { success, failed }
}

/**
 * Get a single record from Firestore
 */
export async function getRecordFromCloud(
  collectionName: string,
  recordId: string
): Promise<SyncableRecord | null> {
  try {
    const userCollection = getUserCollection(collectionName)
    const recordRef = doc(userCollection, recordId)
    const snapshot = await getDoc(recordRef)

    if (!snapshot.exists()) {
      return null
    }

    const data = snapshot.data()
    return {
      ...data,
      id: snapshot.id,
      updatedAt: data.updatedAt
        ? fromFirestoreTimestamp(data.updatedAt)
        : undefined,
    } as SyncableRecord
  } catch (error) {
    console.error(`Failed to get ${collectionName}/${recordId}:`, error)
    throw error
  }
}

/**
 * Get all records for a profile from Firestore
 */
export async function getRecordsFromCloud(
  collectionName: string,
  profileId: string
): Promise<SyncableRecord[]> {
  try {
    const userCollection = getUserCollection(collectionName)
    const q = query(
      userCollection,
      where('profileId', '==', profileId),
      orderBy('updatedAt', 'desc')
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        ...data,
        id: doc.id,
        updatedAt: data.updatedAt
          ? fromFirestoreTimestamp(data.updatedAt)
          : undefined,
      } as SyncableRecord
    })
  } catch (error) {
    console.error(`Failed to get ${collectionName} records:`, error)
    throw error
  }
}

/**
 * Delete a record from Firestore
 */
export async function deleteRecordFromCloud(
  collectionName: string,
  recordId: string
): Promise<void> {
  try {
    const userCollection = getUserCollection(collectionName)
    const recordRef = doc(userCollection, recordId)
    await deleteDoc(recordRef)
    console.log(`Deleted ${collectionName}/${recordId} from cloud`)
  } catch (error) {
    console.error(`Failed to delete ${collectionName}/${recordId}:`, error)
    throw error
  }
}

/**
 * Delete all records for a profile from a Firestore collection
 */
export async function deleteAllRecordsFromCloud(
  collectionName: string,
  profileId: string
): Promise<number> {
  try {
    const userCollection = getUserCollection(collectionName)
    const q = query(
      userCollection,
      where('profileId', '==', profileId)
    )

    const snapshot = await getDocs(q)
    let deletedCount = 0

    for (const docSnapshot of snapshot.docs) {
      await deleteDoc(docSnapshot.ref)
      deletedCount++
    }

    console.log(`Deleted ${deletedCount} ${collectionName} records from cloud for profile ${profileId}`)
    return deletedCount
  } catch (error) {
    console.error(`Failed to delete ${collectionName} records from cloud:`, error)
    throw error
  }
}

/**
 * Listen to real-time changes for a collection
 */
export function subscribeToCollection(
  collectionName: string,
  profileId: string,
  onUpdate: (records: SyncableRecord[]) => void,
  onError?: (error: Error) => void
): () => void {
  try {
    const userCollection = getUserCollection(collectionName)
    const q = query(
      userCollection,
      where('profileId', '==', profileId),
      orderBy('updatedAt', 'desc')
    )

    return onSnapshot(
      q,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => {
          const data = doc.data()
          return {
            ...data,
            id: doc.id,
            updatedAt: data.updatedAt
              ? fromFirestoreTimestamp(data.updatedAt)
              : undefined,
          } as SyncableRecord
        })
        onUpdate(records)
      },
      (error) => {
        console.error(`Snapshot error for ${collectionName}:`, error)
        if (onError) {
          onError(error)
        }
      }
    )
  } catch (error) {
    console.error(`Failed to subscribe to ${collectionName}:`, error)
    if (onError) {
      onError(error as Error)
    }
    return () => {}
  }
}

/**
 * Check if a record needs syncing (local is newer than cloud)
 */
export async function needsSync(
  collectionName: string,
  record: SyncableRecord
): Promise<boolean> {
  try {
    const cloudRecord = await getRecordFromCloud(collectionName, record.id)

    if (!cloudRecord) {
      // Record doesn't exist in cloud, needs sync
      return true
    }

    if (!record.updatedAt || !cloudRecord.updatedAt) {
      // Can't compare, sync to be safe
      return true
    }

    // Compare timestamps - sync if local is newer
    return new Date(record.updatedAt) > new Date(cloudRecord.updatedAt)
  } catch (error) {
    console.error('Error checking sync status:', error)
    return true // Sync on error to be safe
  }
}

/**
 * Sync all records of a type for a profile
 */
export async function syncAllRecordsToCloud(
  collectionName: string,
  records: SyncableRecord[]
): Promise<{ synced: number; skipped: number; failed: number }> {
  let synced = 0
  let skipped = 0
  let failed = 0

  for (const record of records) {
    try {
      const needs = await needsSync(collectionName, record)
      if (needs) {
        await syncRecordToCloud(collectionName, record)
        synced++
      } else {
        skipped++
      }
    } catch (error) {
      failed++
      console.error(`Failed to sync ${collectionName}/${record.id}:`, error)
    }
  }

  return { synced, skipped, failed }
}
