// Initialize Firebase before anything else
import '../services/firebaseInit'

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useColorScheme } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ProfileProvider } from '../contexts/ProfileContext'
import { BudgetProvider } from '../contexts/BudgetContext'
import { AuthProvider } from '../contexts/AuthContext'

export default function RootLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <BudgetProvider>
              <StatusBar style={isDark ? 'light' : 'dark'} />
              <Stack
                screenOptions={{
                  headerStyle: {
                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                  },
                  headerTintColor: isDark ? '#f9fafb' : '#1f2937',
                  headerTitleStyle: { fontWeight: '600' },
                  contentStyle: {
                    backgroundColor: isDark ? '#111827' : '#f3f4f6',
                  },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="transaction/add"
                  options={{
                    title: 'Add Transaction',
                    presentation: 'modal',
                  }}
                />
                <Stack.Screen
                  name="transaction/[id]"
                  options={{ title: 'Transaction Details' }}
                />
                <Stack.Screen
                  name="budget/[bucketId]"
                  options={{ title: 'Bucket Details' }}
                />
                <Stack.Screen
                  name="budget/archive"
                  options={{ title: 'Budget Archive' }}
                />
                <Stack.Screen
                  name="category/manage"
                  options={{ title: 'Manage Categories' }}
                />
                <Stack.Screen
                  name="category/[id]"
                  options={{ title: 'Category Details' }}
                />
                <Stack.Screen
                  name="accounts"
                  options={{ title: 'Accounts' }}
                />
                <Stack.Screen
                  name="auth"
                  options={{
                    title: 'Cloud Sync',
                    presentation: 'modal',
                  }}
                />
              </Stack>
            </BudgetProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
