/**
 * Database client for renderer process
 * Uses IPC to communicate with database service in main process
 */

class DatabaseClient {
  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (window.electronAPI?.database) {
      await window.electronAPI.database.initialize()
    }
  }

  /**
   * Get all profiles
   */
  getAllProfiles() {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getAllProfiles()
    }
    return []
  }

  /**
   * Get a profile by ID
   */
  getProfile(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProfile(id)
    }
    return null
  }

  /**
   * Create a new profile
   */
  createProfile(profile: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createProfile(profile)
    }
    return null
  }

  /**
   * Update a profile
   */
  updateProfile(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateProfile(id, updates)
    }
    return null
  }

  /**
   * Update profile last accessed time
   */
  updateProfileLastAccessed(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateProfileLastAccessed(id)
    }
  }

  /**
   * Delete a profile
   */
  deleteProfile(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteProfile(id)
    }
  }

  /**
   * Get settings for a profile
   */
  getSettings(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getSettings(profileId)
    }
    return null
  }

  /**
   * Update settings for a profile
   */
  updateSettings(profileId: string, settings: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateSettings(profileId, settings)
    }
    return null
  }

  /**
   * Get all accounts for a profile
   */
  getAccounts(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getAccounts(profileId, budgetType)
    }
    return []
  }

  /**
   * Get all accounts for a profile including soft-deleted (for sync)
   */
  getAccountsForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getAccountsForSync(profileId)
    }
    return []
  }

  /**
   * Get an account by ID
   */
  getAccount(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getAccount(id)
    }
    return null
  }

  /**
   * Create a new account
   */
  createAccount(account: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createAccount(account)
    }
    return null
  }

  /**
   * Update an account
   */
  updateAccount(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateAccount(id, updates)
    }
    return null
  }

  /**
   * Delete an account
   */
  deleteAccount(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteAccount(id)
    }
  }

  /**
   * Get account by ID including soft-deleted (for sync)
   */
  getAccountForSync(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getAccountForSync(id)
    }
    return null
  }

  /**
   * Update account including deleted_at (for sync)
   */
  updateAccountForSync(id: string, data: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateAccountForSync(id, data)
    }
  }

  /**
   * Create account with deleted_at (for sync)
   */
  createAccountForSync(account: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createAccountForSync(account)
    }
  }

  /**
   * Get all categories for a profile
   */
  getCategories(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getCategories(profileId, budgetType)
    }
    return []
  }

  /**
   * Get all categories for a profile including soft-deleted (for sync)
   */
  getCategoriesForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getCategoriesForSync(profileId)
    }
    return []
  }

  /**
   * Get a category by ID
   */
  getCategory(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getCategory(id)
    }
    return null
  }

  /**
   * Create a new category
   */
  createCategory(category: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createCategory(category)
    }
    return null
  }

  /**
   * Update a category
   */
  updateCategory(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateCategory(id, updates)
    }
    return null
  }

  /**
   * Delete a category
   */
  deleteCategory(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteCategory(id)
    }
  }

  /**
   * Get category by ID including soft-deleted (for sync)
   */
  getCategoryForSync(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getCategoryForSync(id)
    }
    return null
  }

  /**
   * Update category including deleted_at (for sync)
   */
  updateCategoryForSync(id: string, data: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateCategoryForSync(id, data)
    }
  }

  /**
   * Create category with deleted_at (for sync)
   */
  createCategoryForSync(category: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createCategoryForSync(category)
    }
  }

  /**
   * Get transactions for a profile
   */
  getTransactions(profileId: string, options?: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getTransactions(profileId, options)
    }
    return []
  }

  /**
   * Get all transactions for a profile including soft-deleted (for sync)
   */
  getTransactionsForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getTransactionsForSync(profileId)
    }
    return []
  }

  /**
   * Get a transaction by ID
   */
  getTransaction(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getTransaction(id)
    }
    return null
  }

  /**
   * Create a new transaction
   */
  createTransaction(transaction: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createTransaction(transaction)
    }
    return null
  }

  /**
   * Update a transaction
   */
  updateTransaction(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateTransaction(id, updates)
    }
    return null
  }

  /**
   * Delete a transaction
   */
  deleteTransaction(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteTransaction(id)
    }
  }

  /**
   * Get transaction by ID including soft-deleted (for sync)
   */
  getTransactionForSync(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getTransactionForSync(id)
    }
    return null
  }

  /**
   * Get income sources for a profile
   */
  getIncomeSources(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getIncomeSources(profileId, budgetType)
    }
    return []
  }

  /**
   * Get all income sources for a profile including soft-deleted (for sync)
   */
  getIncomeSourcesForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getIncomeSourcesForSync(profileId)
    }
    return []
  }

  /**
   * Get an income source by ID
   */
  getIncomeSource(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getIncomeSource(id)
    }
    return null
  }

  /**
   * Create a new income source
   */
  createIncomeSource(source: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createIncomeSource(source)
    }
    return null
  }

  /**
   * Update an income source
   */
  updateIncomeSource(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateIncomeSource(id, updates)
    }
    return null
  }

  /**
   * Delete an income source
   */
  deleteIncomeSource(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteIncomeSource(id)
    }
  }

  /**
   * Get income source by ID including soft-deleted (for sync)
   */
  getIncomeSourceForSync(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getIncomeSourceForSync(id)
    }
    return null
  }

  /**
   * Get projects for a profile
   */
  getProjects(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjects(profileId, budgetType)
    }
    return []
  }

  /**
   * Get all projects for a profile including soft-deleted (for sync)
   */
  getProjectsForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectsForSync(profileId)
    }
    return []
  }

  /**
   * Get a project by ID
   */
  getProject(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProject(id)
    }
    return null
  }

  /**
   * Create a new project
   */
  createProject(project: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createProject(project)
    }
    return null
  }

  /**
   * Update a project
   */
  updateProject(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateProject(id, updates)
    }
    return null
  }

  /**
   * Delete a project
   */
  deleteProject(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteProject(id)
    }
  }

  /**
   * Get project by ID including soft-deleted (for sync)
   */
  getProjectForSync(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectForSync(id)
    }
    return null
  }

  /**
   * Get project types for a profile
   */
  getProjectTypes(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectTypes(profileId, budgetType)
    }
    return []
  }

  /**
   * Get all project types for a profile including soft-deleted (for sync)
   */
  getProjectTypesForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectTypesForSync(profileId)
    }
    return []
  }

  /**
   * Get a project type by ID
   */
  getProjectType(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectType(id)
    }
    return null
  }

  /**
   * Create a new project type
   */
  createProjectType(projectType: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createProjectType(projectType)
    }
    return null
  }

  /**
   * Update a project type
   */
  updateProjectType(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateProjectType(id, updates)
    }
    return null
  }

  /**
   * Delete a project type
   */
  deleteProjectType(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteProjectType(id)
    }
  }

  /**
   * Get project statuses for a profile
   */
  getProjectStatuses(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectStatuses(profileId)
    }
    return []
  }

  /**
   * Get all project statuses for a profile including soft-deleted (for sync)
   */
  getProjectStatusesForSync(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectStatusesForSync(profileId)
    }
    return []
  }

  /**
   * Get a project status by ID
   */
  getProjectStatus(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectStatus(id)
    }
    return null
  }

  /**
   * Create a new project status
   */
  createProjectStatus(status: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.createProjectStatus(status)
    }
    return null
  }

  /**
   * Update a project status
   */
  updateProjectStatus(id: string, updates: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.updateProjectStatus(id, updates)
    }
    return null
  }

  /**
   * Delete a project status
   */
  deleteProjectStatus(id: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.deleteProjectStatus(id)
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseClient()
