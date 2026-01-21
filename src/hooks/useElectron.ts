import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBudget } from '../contexts/BudgetContext'
import { useProfile } from '../contexts/ProfileContext'
import type { BudgetViewType } from '../types'

/**
 * Custom hook to handle Electron IPC events
 * Enables keyboard shortcuts and menu navigation
 */
export function useElectron() {
  const navigate = useNavigate()
  const { setCurrentView } = useBudget()
  const { logout } = useProfile()

  useEffect(() => {
    // Check if running in Electron
    if (!window.electronAPI) {
      return
    }

    // Handle navigation from menu shortcuts
    window.electronAPI.onNavigate((path: string) => {
      navigate(path)
    })

    // Handle budget view switching from menu shortcuts
    window.electronAPI.onSwitchView((view: string) => {
      setCurrentView(view as BudgetViewType)
    })

    // Handle logout from menu
    window.electronAPI.onLogout(() => {
      if (confirm('Are you sure you want to logout? You will be returned to the profile selection screen.')) {
        logout()
      }
    })
  }, [navigate, setCurrentView, logout])
}
