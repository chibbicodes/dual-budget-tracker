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
   * Get all categories for a profile
   */
  getCategories(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getCategories(profileId, budgetType)
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
   * Get transactions for a profile
   */
  getTransactions(profileId: string, options?: any) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getTransactions(profileId, options)
    }
    return []
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
   * Get projects for a profile
   */
  getProjects(profileId: string, budgetType?: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjects(profileId, budgetType)
    }
    return []
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
   * Get project statuses for a profile
   */
  getProjectStatuses(profileId: string) {
    if (window.electronAPI?.database) {
      return window.electronAPI.database.getProjectStatuses(profileId)
    }
    return []
  }
}

// Export singleton instance
export const databaseService = new DatabaseClient()
