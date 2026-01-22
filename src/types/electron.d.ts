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
        getTransaction: (id: string) => Promise<any>
        createTransaction: (transaction: any) => Promise<any>
        updateTransaction: (id: string, updates: any) => Promise<any>
        deleteTransaction: (id: string) => Promise<void>
        getIncomeSources: (profileId: string, budgetType?: string) => Promise<any[]>
        getIncomeSource: (id: string) => Promise<any>
        createIncomeSource: (source: any) => Promise<any>
        updateIncomeSource: (id: string, updates: any) => Promise<any>
        deleteIncomeSource: (id: string) => Promise<void>
        getProjects: (profileId: string, budgetType?: string) => Promise<any[]>
        getProject: (id: string) => Promise<any>
        createProject: (project: any) => Promise<any>
        updateProject: (id: string, updates: any) => Promise<any>
        deleteProject: (id: string) => Promise<void>
        getProjectTypes: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjectType: (id: string) => Promise<any>
        createProjectType: (projectType: any) => Promise<any>
        updateProjectType: (id: string, updates: any) => Promise<any>
        deleteProjectType: (id: string) => Promise<void>
        getProjectStatuses: (profileId: string) => Promise<any[]>
        getProjectStatus: (id: string) => Promise<any>
        createProjectStatus: (status: any) => Promise<any>
        updateProjectStatus: (id: string, updates: any) => Promise<any>
        deleteProjectStatus: (id: string) => Promise<void>
      }
    }
  }
}

export {}
