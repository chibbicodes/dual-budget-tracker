const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app data path for future SQLite usage
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Listen for navigation commands from menu
  onNavigate: (callback) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path))
  },

  // Listen for view switching commands from menu
  onSwitchView: (callback) => {
    ipcRenderer.on('switch-view', (_event, view) => callback(view))
  },

  // Listen for logout command from menu
  onLogout: (callback) => {
    ipcRenderer.on('logout', () => callback())
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
    getAccount: (id) => ipcRenderer.invoke('db:getAccount', id),
    createAccount: (account) => ipcRenderer.invoke('db:createAccount', account),
    updateAccount: (id, updates) => ipcRenderer.invoke('db:updateAccount', id, updates),
    deleteAccount: (id) => ipcRenderer.invoke('db:deleteAccount', id),
    getCategories: (profileId, budgetType) => ipcRenderer.invoke('db:getCategories', profileId, budgetType),
    getCategory: (id) => ipcRenderer.invoke('db:getCategory', id),
    createCategory: (category) => ipcRenderer.invoke('db:createCategory', category),
    updateCategory: (id, updates) => ipcRenderer.invoke('db:updateCategory', id, updates),
    deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),
    getTransactions: (profileId, options) => ipcRenderer.invoke('db:getTransactions', profileId, options),
    getTransaction: (id) => ipcRenderer.invoke('db:getTransaction', id),
    createTransaction: (transaction) => ipcRenderer.invoke('db:createTransaction', transaction),
    updateTransaction: (id, updates) => ipcRenderer.invoke('db:updateTransaction', id, updates),
    deleteTransaction: (id) => ipcRenderer.invoke('db:deleteTransaction', id),
    getIncomeSources: (profileId, budgetType) => ipcRenderer.invoke('db:getIncomeSources', profileId, budgetType),
    getIncomeSource: (id) => ipcRenderer.invoke('db:getIncomeSource', id),
    createIncomeSource: (source) => ipcRenderer.invoke('db:createIncomeSource', source),
    updateIncomeSource: (id, updates) => ipcRenderer.invoke('db:updateIncomeSource', id, updates),
    deleteIncomeSource: (id) => ipcRenderer.invoke('db:deleteIncomeSource', id),
    getProjects: (profileId, budgetType) => ipcRenderer.invoke('db:getProjects', profileId, budgetType),
    getProject: (id) => ipcRenderer.invoke('db:getProject', id),
    createProject: (project) => ipcRenderer.invoke('db:createProject', project),
    updateProject: (id, updates) => ipcRenderer.invoke('db:updateProject', id, updates),
    deleteProject: (id) => ipcRenderer.invoke('db:deleteProject', id),
    getProjectTypes: (profileId, budgetType) => ipcRenderer.invoke('db:getProjectTypes', profileId, budgetType),
    getProjectType: (id) => ipcRenderer.invoke('db:getProjectType', id),
    createProjectType: (projectType) => ipcRenderer.invoke('db:createProjectType', projectType),
    updateProjectType: (id, updates) => ipcRenderer.invoke('db:updateProjectType', id, updates),
    deleteProjectType: (id) => ipcRenderer.invoke('db:deleteProjectType', id),
    getProjectStatuses: (profileId) => ipcRenderer.invoke('db:getProjectStatuses', profileId),
    getProjectStatus: (id) => ipcRenderer.invoke('db:getProjectStatus', id),
    createProjectStatus: (status) => ipcRenderer.invoke('db:createProjectStatus', status),
    updateProjectStatus: (id, updates) => ipcRenderer.invoke('db:updateProjectStatus', id, updates),
    deleteProjectStatus: (id) => ipcRenderer.invoke('db:deleteProjectStatus', id),
  },
})
