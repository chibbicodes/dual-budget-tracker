import { useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native'
import { useRouter, Stack } from 'expo-router'
import { signIn, signUp, resetPassword } from '@dual-budget/shared'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../contexts/AuthContext'
import { Spacing, FontSize, BorderRadius } from '../constants/theme'

type AuthMode = 'signin' | 'signup'

export default function AuthScreen() {
  const router = useRouter()
  const { colors } = useTheme()
  const { user, isFirebaseReady } = useAuth()

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSignIn = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address.')
      return
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter your password.')
      return
    }

    setIsLoading(true)
    try {
      await signIn(email.trim(), password)
      Alert.alert('Success', 'You are now signed in. Cloud sync is enabled.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (error: any) {
      const message = error?.message || 'Failed to sign in. Please check your credentials.'
      Alert.alert('Sign In Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [email, password, router])

  const handleSignUp = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address.')
      return
    }
    if (!password) {
      Alert.alert('Validation Error', 'Please enter a password.')
      return
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.')
      return
    }

    setIsLoading(true)
    try {
      await signUp(email.trim(), password)
      Alert.alert(
        'Account Created',
        'Your account has been created and you are now signed in. Cloud sync is enabled.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } catch (error: any) {
      const message = error?.message || 'Failed to create account. Please try again.'
      Alert.alert('Sign Up Error', message)
    } finally {
      setIsLoading(false)
    }
  }, [email, password, confirmPassword, router])

  const handleResetPassword = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Email Required', 'Please enter your email address first, then tap Forgot Password.')
      return
    }

    Alert.alert(
      'Reset Password',
      `Send a password reset email to ${email.trim()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setIsLoading(true)
            try {
              await resetPassword(email.trim())
              Alert.alert(
                'Email Sent',
                'Check your inbox for the password reset link.'
              )
            } catch (error: any) {
              const message = error?.message || 'Failed to send reset email.'
              Alert.alert('Error', message)
            } finally {
              setIsLoading(false)
            }
          },
        },
      ]
    )
  }, [email])

  const handleSubmit = useCallback(() => {
    if (mode === 'signin') {
      handleSignIn()
    } else {
      handleSignUp()
    }
  }, [mode, handleSignIn, handleSignUp])

  if (!isFirebaseReady) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Cloud Sync' }} />
        <View style={[styles.messageCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.messageTitle, { color: colors.text }]}>
            Cloud Sync Not Available
          </Text>
          <Text style={[styles.messageText, { color: colors.textSecondary }]}>
            Firebase is not configured for this app. Your data is stored locally on this device.
            To enable cloud sync, configure Firebase in the app settings.
          </Text>
        </View>
      </View>
    )
  }

  if (user) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Cloud Sync' }} />
        <View style={[styles.messageCard, { backgroundColor: colors.surface }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user.displayName || user.email || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.messageTitle, { color: colors.text }]}>
            Signed In
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user.email}
          </Text>
          {user.displayName && (
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.displayName}
            </Text>
          )}
          <Text style={[styles.messageText, { color: colors.textSecondary }]}>
            Cloud sync is active. Your data will be synced across devices.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.signOutButton,
              { backgroundColor: colors.dangerLight, borderColor: colors.danger },
              pressed && styles.buttonPressed,
            ]}
            onPress={() => {
              Alert.alert(
                'Sign Out',
                'Are you sure you want to sign out? Cloud sync will be paused.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        const { logOut } = await import('@dual-budget/shared')
                        await logOut()
                      } catch (error) {
                        Alert.alert('Error', 'Failed to sign out.')
                      }
                    },
                  },
                ]
              )
            }}
          >
            <Text style={[styles.signOutButtonText, { color: colors.danger }]}>
              Sign Out
            </Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Cloud Sync' }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {mode === 'signin'
              ? 'Sign in to enable cloud sync across your devices.'
              : 'Create an account to sync your budget data across devices.'}
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={[styles.toggleContainer, { backgroundColor: colors.surface }]}>
          <Pressable
            style={[
              styles.toggleButton,
              styles.toggleButtonLeft,
              mode === 'signin' && { backgroundColor: colors.primary },
              mode !== 'signin' && { borderColor: colors.border },
            ]}
            onPress={() => setMode('signin')}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'signin' ? styles.toggleTextActive : { color: colors.textSecondary },
              ]}
            >
              Sign In
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleButton,
              styles.toggleButtonRight,
              mode === 'signup' && { backgroundColor: colors.primary },
              mode !== 'signup' && { borderColor: colors.border },
            ]}
            onPress={() => setMode('signup')}
          >
            <Text
              style={[
                styles.toggleText,
                mode === 'signup' ? styles.toggleTextActive : { color: colors.textSecondary },
              ]}
            >
              Sign Up
            </Text>
          </Pressable>
        </View>

        {/* Email */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="you@example.com"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        </View>

        {/* Password */}
        <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            placeholder="Enter password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </View>

        {/* Confirm Password (sign up only) */}
        {mode === 'signup' && (
          <View style={[styles.fieldContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
            />
          </View>
        )}

        {/* Submit Button */}
        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: colors.primary },
            pressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </Text>
          )}
        </Pressable>

        {/* Forgot Password (sign in only) */}
        {mode === 'signin' && (
          <Pressable
            style={styles.forgotPasswordButton}
            onPress={handleResetPassword}
            disabled={isLoading}
          >
            <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>
              Forgot Password?
            </Text>
          </Pressable>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  toggleButtonLeft: {
    borderTopLeftRadius: BorderRadius.md,
    borderBottomLeftRadius: BorderRadius.md,
  },
  toggleButtonRight: {
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  fieldContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    fontSize: FontSize.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  submitButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginTop: Spacing.sm,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  forgotPasswordText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  messageCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  messageTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  messageText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  userEmail: {
    fontSize: FontSize.md,
    marginBottom: Spacing.xs,
  },
  userName: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '100%',
  },
  signOutButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  bottomPadding: {
    height: Spacing.xxl,
  },
})
