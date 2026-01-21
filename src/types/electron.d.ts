// Type definitions for Electron API exposed to renderer process
declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>
      onNavigate: (callback: (path: string) => void) => void
      onSwitchView: (callback: (view: string) => void) => void
      onLogout: (callback: () => void) => void
      database?: {
        initialize: () => Promise<void>
        getAllProfiles: () => Promise<any[]>
        getProfile: (id: string) => Promise<any>
        createProfile: (profile: any) => Promise<any>
        updateProfile: (id: string, updates: any) => Promise<any>
        updateProfileLastAccessed: (id: string) => Promise<void>
        deleteProfile: (id: string) => Promise<void>
        getSettings: (profileId: string) => Promise<any>
        updateSettings: (profileId: string, settings: any) => Promise<any>
        getAccounts: (profileId: string, budgetType?: string) => Promise<any[]>
        getAccount: (id: string) => Promise<any>
        createAccount: (account: any) => Promise<any>
        updateAccount: (id: string, updates: any) => Promise<any>
        deleteAccount: (id: string) => Promise<void>
        getCategories: (profileId: string, budgetType?: string) => Promise<any[]>
        getCategory: (id: string) => Promise<any>
        createCategory: (category: any) => Promise<any>
        updateCategory: (id: string, updates: any) => Promise<any>
        deleteCategory: (id: string) => Promise<void>
        getTransactions: (profileId: string, options?: any) => Promise<any[]>
        getIncomeSources: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjects: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjectTypes: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjectStatuses: (profileId: string) => Promise<any[]>
      }
    }
  }
}

export {}
