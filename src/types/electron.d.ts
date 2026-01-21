// Type definitions for Electron API exposed to renderer process
declare global {
  interface Window {
    electronAPI?: {
      getAppPath: () => Promise<string>
      onNavigate: (callback: (path: string) => void) => void
      onSwitchView: (callback: (view: string) => void) => void
      onLogout: (callback: () => void) => void
    }
  }
}

export {}
