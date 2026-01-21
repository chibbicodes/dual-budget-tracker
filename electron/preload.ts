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
})
