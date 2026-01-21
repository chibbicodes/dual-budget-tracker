import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get app data path for future SQLite usage
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Listen for navigation commands from menu
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on('navigate', (_event, path) => callback(path))
  },

  // Listen for view switching commands from menu
  onSwitchView: (callback: (view: string) => void) => {
    ipcRenderer.on('switch-view', (_event, view) => callback(view))
  },

  // Listen for logout command from menu
  onLogout: (callback: () => void) => {
    ipcRenderer.on('logout', () => callback())
  },
})

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getAppPath: () => Promise<string>
      onNavigate: (callback: (path: string) => void) => void
      onSwitchView: (callback: (view: string) => void) => void
      onLogout: (callback: () => void) => void
    }
  }
}
