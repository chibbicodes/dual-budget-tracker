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
    getIncomeSources: (profileId, budgetType) => ipcRenderer.invoke('db:getIncomeSources', profileId, budgetType),
    getProjects: (profileId, budgetType) => ipcRenderer.invoke('db:getProjects', profileId, budgetType),
    getProjectTypes: (profileId, budgetType) => ipcRenderer.invoke('db:getProjectTypes', profileId, budgetType),
    getProjectStatuses: (profileId) => ipcRenderer.invoke('db:getProjectStatuses', profileId),
  },
})
