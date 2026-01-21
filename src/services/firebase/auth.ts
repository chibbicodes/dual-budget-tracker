import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import { auth } from './config'

/**
 * Firebase Authentication Service
 * Handles user signup, login, logout, and session management
 */

export interface AuthUser {
  uid: string
  email: string | null
  displayName: string | null
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthUser> {
  if (!auth) {
    throw new Error('Firebase not configured')
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email, password)

  // Update display name if provided
  if (displayName && userCredential.user) {
    await updateProfile(userCredential.user, { displayName })
  }

  return {
    uid: userCredential.user.uid,
    email: userCredential.user.email,
    displayName: displayName || userCredential.user.displayName,
  }
}

/**
 * Sign in an existing user with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (!auth) {
    throw new Error('Firebase not configured')
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password)

  return {
    uid: userCredential.user.uid,
    email: userCredential.user.email,
    displayName: userCredential.user.displayName,
  }
}

/**
 * Sign out the current user
 */
export async function logOut(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase not configured')
  }

  await signOut(auth)
}

/**
 * Get the currently signed-in user
 */
export function getCurrentUser(): User | null {
  if (!auth) {
    return null
  }
  return auth.currentUser
}

/**
 * Listen to authentication state changes
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  if (!auth) {
    return () => {}
  }

  return onAuthStateChanged(auth, (user) => {
    if (user) {
      callback({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
      })
    } else {
      callback(null)
    }
  })
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase not configured')
  }

  await sendPasswordResetEmail(auth, email)
}

/**
 * Update user's password (requires recent authentication)
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (!auth || !auth.currentUser || !auth.currentUser.email) {
    throw new Error('No user signed in')
  }

  // Re-authenticate user before password change
  const credential = EmailAuthProvider.credential(
    auth.currentUser.email,
    currentPassword
  )
  await reauthenticateWithCredential(auth.currentUser, credential)

  // Update password
  await updatePassword(auth.currentUser, newPassword)
}

/**
 * Update user's display name
 */
export async function updateDisplayName(displayName: string): Promise<void> {
  if (!auth || !auth.currentUser) {
    throw new Error('No user signed in')
  }

  await updateProfile(auth.currentUser, { displayName })
}

/**
 * Check if user is signed in
 */
export function isSignedIn(): boolean {
  return !!getCurrentUser()
}
