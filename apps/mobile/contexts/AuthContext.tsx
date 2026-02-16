import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthChange, isFirebaseConfigured, type AuthUser } from '@dual-budget/shared'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isFirebaseReady: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isFirebaseReady: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isFirebaseReady = isFirebaseConfigured()

  useEffect(() => {
    if (!isFirebaseReady) {
      setIsLoading(false)
      return
    }
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser)
      setIsLoading(false)
    })
    return unsubscribe
  }, [isFirebaseReady])

  return (
    <AuthContext.Provider value={{ user, isLoading, isFirebaseReady }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
