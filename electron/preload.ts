const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app data path for future SQLite usage
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Listen for navigation commands from menu
  onNavigate: (callback) => {
    const handler = (_event, path) => callback(path)
    ipcRenderer.on('navigate', handler)
    return () => ipcRenderer.removeListener('navigate', handler)
  },

  // Listen for view switching commands from menu
  onSwitchView: (callback) => {
    const handler = (_event, view) => callback(view)
    ipcRenderer.on('switch-view', handler)
    return () => ipcRenderer.removeListener('switch-view', handler)
  },

  // Listen for logout command from menu
  onLogout: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('logout', handler)
    return () => ipcRenderer.removeListener('logout', handler)
  },

  // Database operations
  database: {
    initialize: () => ipcRenderer.invoke('db:initialize'),
    getAllProfiles: () => ipcRenderer.invoke('db:getAllProfiles'),
    getProfile: (id) => ipcRenderer.invoke('db:getProfile', id),
    createProfile: (profile) => ipcRenderer.invoke('db:createProfile', profile),
    updateProfile: (id, updates) => ipcRenderer.invoke('db:updateProfile', id, updates),
    updateProfileLastAccessed: (id) => ipcRenderer.invoke('db:updateProfileLastAccessed', id),
    deleteProfile: (id) => ipcRenderer.invoke('db:deleteProfile', id),
    getSettings: (profileId) => ipcRenderer.invoke('db:getSettings', profileId),
    updateSettings: (profileId, settings) => ipcRenderer.invoke('db:updateSettings', profileId, settings),
    getAccounts: (profileId, budgetType) => ipcRenderer.invoke('db:getAccounts', profileId, budgetType),
    getAccountsForSync: (profileId) => ipcRenderer.invoke('db:getAccountsForSync', profileId),
    getAccount: (id) => ipcRenderer.invoke('db:getAccount', id),
    createAccount: (account) => ipcRenderer.invoke('db:createAccount', account),
    updateAccount: (id, updates) => ipcRenderer.invoke('db:updateAccount', id, updates),
    deleteAccount: (id) => ipcRenderer.invoke('db:deleteAccount', id),
    getAccountForSync: (id) => ipcRenderer.invoke('db:getAccountForSync', id),
    updateAccountForSync: (id, data) => ipcRenderer.invoke('db:updateAccountForSync', id, data),
    createAccountForSync: (account) => ipcRenderer.invoke('db:createAccountForSync', account),
    getCategories: (profileId, budgetType) => ipcRenderer.invoke('db:getCategories', profileId, budgetType),
    getCategoriesForSync: (profileId) => ipcRenderer.invoke('db:getCategoriesForSync', profileId),
    getCategory: (id) => ipcRenderer.invoke('db:getCategory', id),
    createCategory: (category) => ipcRenderer.invoke('db:createCategory', category),
    updateCategory: (id, updates) => ipcRenderer.invoke('db:updateCategory', id, updates),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),
    getCategoryForSync: (id) => ipcRenderer.invoke('db:getCategoryForSync', id),
    updateCategoryForSync: (id, data) => ipcRenderer.invoke('db:updateCategoryForSync', id, data),
    createCategoryForSync: (category) => ipcRenderer.invoke('db:createCategoryForSync', category),
    getTransactions: (profileId, options) => ipcRenderer.invoke('db:getTransactions', profileId, options),
    getTransactionsForSync: (profileId) => ipcRenderer.invoke('db:getTransactionsForSync', profileId),
    getTransaction: (id) => ipcRenderer.invoke('db:getTransaction', id),
    getTransactionForSync: (id) => ipcRenderer.invoke('db:getTransactionForSync', id),
    createTransaction: (transaction) => ipcRenderer.invoke('db:createTransaction', transaction),
    updateTransaction: (id, updates) => ipcRenderer.invoke('db:updateTransaction', id, updates),
    deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
    getIncomeSources: (profileId, budgetType) => ipcRenderer.invoke('db:getIncomeSources', profileId, budgetType),
    getIncomeSourcesForSync: (profileId) => ipcRenderer.invoke('db:getIncomeSourcesForSync', profileId),
    getIncomeSource: (id) => ipcRenderer.invoke('db:getIncomeSource', id),
    getIncomeSourceForSync: (id) => ipcRenderer.invoke('db:getIncomeSourceForSync', id),
    createIncomeSource: (source) => ipcRenderer.invoke('db:createIncomeSource', source),
    updateIncomeSource: (id, updates) => ipcRenderer.invoke('db:updateIncomeSource', id, updates),
    deleteIncomeSource: (id) => ipcRenderer.invoke('db:deleteIncomeSource', id),
    getProjects: (profileId, budgetType) => ipcRenderer.invoke('db:getProjects', profileId, budgetType),
    getProjectsForSync: (profileId) => ipcRenderer.invoke('db:getProjectsForSync', profileId),
    getProject: (id) => ipcRenderer.invoke('db:getProject', id),
    getProjectForSync: (id) => ipcRenderer.invoke('db:getProjectForSync', id),
    createProject: (project) => ipcRenderer.invoke('db:createProject', project),
    updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
    deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
    getProjectTypes: (profileId, budgetType) => ipcRenderer.invoke('db:getProjectTypes', profileId, budgetType),
    getProjectTypesForSync: (profileId) => ipcRenderer.invoke('db:getProjectTypesForSync', profileId),
    getProjectType: (id) => ipcRenderer.invoke('db:getProjectType', id),
    createProjectType: (projectType) => ipcRenderer.invoke('db:createProjectType', projectType),
    updateProjectType: (id, updates) => ipcRenderer.invoke('db:updateProjectType', id, updates),
    deleteProjectType: (id) => ipcRenderer.invoke('db:deleteProjectType', id),
    getProjectStatuses: (profileId) => ipcRenderer.invoke('db:getProjectStatuses', profileId),
    getProjectStatusesForSync: (profileId) => ipcRenderer.invoke('db:getProjectStatusesForSync', profileId),
    getProjectStatus: (id) => ipcRenderer.invoke('db:getProjectStatus', id),
    createProjectStatus: (status) => ipcRenderer.invoke('db:createProjectStatus', status),
    updateProjectStatus: (id, updates) => ipcRenderer.invoke('db:updateProjectStatus', id, updates),
    deleteProjectStatus: (id) => ipcRenderer.invoke('db:deleteProjectStatus', id),
  },
})
