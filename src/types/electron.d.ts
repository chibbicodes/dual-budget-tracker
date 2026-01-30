// Type definitions for Electron API exposed to renderer process
declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>
      onNavigate: (callback: (path: string) => void) => (() => void)
      onSwitchView: (callback: (view: string) => void) => (() => void)
      onLogout: (callback: () => void) => (() => void)
      database?: {
        initialize: () => Promise<void>
        getAllProfiles: () => Promise<any[]>
        getProfile: (id: string) => Promise<any>
        createProfile: (profile: any) => Promise<any>
        updateProfile: (id: string, updates: any) => Promise<any>
        updateProfileLastAccessed: (id: string) => Promise<void>
        deleteProfile: (id: string) => Promise<void>
        clearProfileData: (profileId: string) => Promise<void>
        getSettings: (profileId: string) => Promise<any>
        updateSettings: (profileId: string, settings: any) => Promise<any>
        // Account operations
        getAccounts: (profileId: string, budgetType?: string) => Promise<any[]>
        getAccountsForSync: (profileId: string) => Promise<any[]>
        getAccount: (id: string) => Promise<any>
        getAccountForSync: (id: string) => Promise<any>
        createAccount: (account: any) => Promise<any>
        createAccountForSync: (account: any) => Promise<any>
        updateAccount: (id: string, updates: any) => Promise<any>
        updateAccountForSync: (id: string, data: any) => Promise<any>
        deleteAccount: (id: string) => Promise<void>
        // Category operations
        getCategories: (profileId: string, budgetType?: string) => Promise<any[]>
        getCategoriesForSync: (profileId: string) => Promise<any[]>
        getCategory: (id: string) => Promise<any>
        getCategoryForSync: (id: string) => Promise<any>
        createCategory: (category: any) => Promise<any>
        createCategoryForSync: (category: any) => Promise<any>
        updateCategory: (id: string, updates: any) => Promise<any>
        updateCategoryForSync: (id: string, data: any) => Promise<any>
        deleteCategory: (id: string) => Promise<void>
        // Transaction operations
        getTransactions: (profileId: string, options?: any) => Promise<any[]>
        getTransactionsForSync: (profileId: string) => Promise<any[]>
        getTransaction: (id: string) => Promise<any>
        getTransactionForSync: (id: string) => Promise<any>
        createTransaction: (transaction: any) => Promise<any>
        updateTransaction: (id: string, updates: any) => Promise<any>
        deleteTransaction: (id: string) => Promise<void>
        // Income source operations
        getIncomeSources: (profileId: string, budgetType?: string) => Promise<any[]>
        getIncomeSourcesForSync: (profileId: string) => Promise<any[]>
        getIncomeSource: (id: string) => Promise<any>
        getIncomeSourceForSync: (id: string) => Promise<any>
        createIncomeSource: (source: any) => Promise<any>
        updateIncomeSource: (id: string, updates: any) => Promise<any>
        deleteIncomeSource: (id: string) => Promise<void>
        // Project operations
        getProjects: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjectsForSync: (profileId: string) => Promise<any[]>
        getProject: (id: string) => Promise<any>
        getProjectForSync: (id: string) => Promise<any>
        createProject: (project: any) => Promise<any>
        updateProject: (id: string, updates: any) => Promise<any>
        deleteProject: (id: string) => Promise<void>
        // Project type operations
        getProjectTypes: (profileId: string, budgetType?: string) => Promise<any[]>
        getProjectTypesForSync: (profileId: string) => Promise<any[]>
        getProjectType: (id: string) => Promise<any>
        createProjectType: (projectType: any) => Promise<any>
        updateProjectType: (id: string, updates: any) => Promise<any>
        deleteProjectType: (id: string) => Promise<void>
        // Project status operations
        getProjectStatuses: (profileId: string) => Promise<any[]>
        getProjectStatusesForSync: (profileId: string) => Promise<any[]>
        getProjectStatus: (id: string) => Promise<any>
        createProjectStatus: (status: any) => Promise<any>
        updateProjectStatus: (id: string, updates: any) => Promise<any>
        deleteProjectStatus: (id: string) => Promise<void>
        // Monthly budget operations
        getMonthlyBudgets: (profileId: string, month?: string, budgetType?: string) => Promise<any[]>
        upsertMonthlyBudget: (budget: any) => Promise<any>
      }
    }
  }
}

export {}
