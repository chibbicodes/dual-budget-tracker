import { initializeApp, FirebaseApp } from 'firebase/app'
import { getAuth, Auth } from 'firebase/auth'
import { getFirestore, Firestore } from 'firebase/firestore'

/**
 * Firebase configuration — populated by the host app (desktop or mobile)
 * via initializeFirebase() before any Firebase operations.
 */
export interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId?: string
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let configured = false

/**
 * Initialize Firebase with config provided by the host app.
 * Must be called once at app startup.
 */
export function initializeFirebase(config: FirebaseConfig): void {
  if (configured) return

  if (!config.apiKey || !config.authDomain || !config.projectId) {
    console.warn('Firebase not configured — cloud sync will be disabled')
    return
  }

  try {
    app = initializeApp(config)
    auth = getAuth(app)
    db = getFirestore(app)
    configured = true
    console.log('Firebase initialized successfully')
  } catch (error) {
    console.error('Failed to initialize Firebase:', error)
  }
}

/**
 * Check if Firebase is configured and initialized
 */
export function isFirebaseConfigured(): boolean {
  return configured
}

export { app, auth, db }
