import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthUser, onAuthChange } from '../services/firebase/auth'
import { isFirebaseConfigured } from '../services/firebase/config'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  isConfigured: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isConfigured: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isConfigured] = useState(() => isFirebaseConfigured())

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }

    // Listen to auth state changes
    const unsubscribe = onAuthChange((authUser) => {
      setUser(authUser)
      setLoading(false)
    })

    return unsubscribe
  }, [isConfigured])

  return (
    <AuthContext.Provider value={{ user, loading, isConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}
