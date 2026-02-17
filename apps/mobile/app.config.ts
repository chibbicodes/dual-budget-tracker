import { ExpoConfig, ConfigContext } from 'expo/config'

// Load .env file if dotenv is available
try {
  const dotenv = require('dotenv')
  const path = require('path')
  dotenv.config({ path: path.resolve(__dirname, '.env') })
} catch {
  // dotenv not available, rely on extra values below
}

const firebaseConfig = {
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDULdDpQnah2qFt2i0F24KG5ZsUJtQEtpE',
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'dual-budget-tracker.firebaseapp.com',
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'dual-budget-tracker',
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'dual-budget-tracker.firebasestorage.app',
  firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '741150918971',
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:741150918971:web:4b942ea16b1cc76a5e4f1e',
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Dual Budget Tracker',
  slug: 'dual-budget-tracker',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'dualbudget',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.chibbicodes.dualbudgettracker',
  },
  plugins: ['expo-router', 'expo-sqlite', 'expo-secure-store'],
  experiments: {
    typedRoutes: true,
  },
  extra: firebaseConfig,
})
