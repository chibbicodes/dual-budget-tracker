/**
 * Mobile Firebase initialization
 * Calls initializeFirebase() from the shared package with
 * environment-specific config values.
 *
 * Import this file once in the root _layout.tsx before any Firebase usage.
 */

import { initializeFirebase } from '@dual-budget/shared'
import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra ?? {}

initializeFirebase({
  apiKey: extra.firebaseApiKey ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: extra.firebaseAuthDomain ?? process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: extra.firebaseProjectId ?? process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: extra.firebaseStorageBucket ?? process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: extra.firebaseMessagingSenderId ?? process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: extra.firebaseAppId ?? process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
})
