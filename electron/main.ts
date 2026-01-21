import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Import database service (runs in main process only)
import('../src/services/database/databaseService.js').then(({ databaseService }) => {
  // Initialize database when app is ready
  app.whenReady().then(async () => {
    try {
      await databaseService.initialize()
      console.log('Database initialized successfully')

      // Check for and run migration from localStorage
      const { migrateFromLocalStorage, hasLocalStorageData } = await import('../src/services/database/migration.js')
      if (hasLocalStorageData()) {
        console.log('Migrating localStorage data to SQLite...')
        const result = await migrateFromLocalStorage()
        if (result.success) {
          console.log(`Migration completed: ${result.profilesMigrated} profiles migrated`)
        } else {
          console.error('Migration had errors:', result.errors)
        }
      }
    } catch (error) {
      console.error('Failed to initialize database:', error)
    }
  })

  // Database IPC handlers
  ipcMain.handle('db:initialize', async () => {
    await databaseService.initialize()
  })

  ipcMain.handle('db:getAllProfiles', () => {
    return databaseService.getAllProfiles()
  })

  ipcMain.handle('db:getProfile', (_event, id: string) => {
    return databaseService.getProfile(id)
  })

  ipcMain.handle('db:createProfile', (_event, profile: any) => {
    return databaseService.createProfile(profile)
  })

  ipcMain.handle('db:updateProfile', (_event, id: string, updates: any) => {
    return databaseService.updateProfile(id, updates)
  })

  ipcMain.handle('db:updateProfileLastAccessed', (_event, id: string) => {
    return databaseService.updateProfileLastAccessed(id)
  })

  ipcMain.handle('db:deleteProfile', (_event, id: string) => {
    return databaseService.deleteProfile(id)
  })

  ipcMain.handle('db:getSettings', (_event, profileId: string) => {
    return databaseService.getSettings(profileId)
  })

  ipcMain.handle('db:updateSettings', (_event, profileId: string, settings: any) => {
    return databaseService.updateSettings(profileId, settings)
  })

  ipcMain.handle('db:getAccounts', (_event, profileId: string, budgetType?: string) => {
    return databaseService.getAccounts(profileId, budgetType)
  })

  ipcMain.handle('db:getAccount', (_event, id: string) => {
    return databaseService.getAccount(id)
  })

  ipcMain.handle('db:createAccount', (_event, account: any) => {
    return databaseService.createAccount(account)
  })

  ipcMain.handle('db:updateAccount', (_event, id: string, updates: any) => {
    return databaseService.updateAccount(id, updates)
  })

  ipcMain.handle('db:deleteAccount', (_event, id: string) => {
    return databaseService.deleteAccount(id)
  })

  ipcMain.handle('db:getCategories', (_event, profileId: string, budgetType?: string) => {
    return databaseService.getCategories(profileId, budgetType)
  })

  ipcMain.handle('db:getCategory', (_event, id: string) => {
    return databaseService.getCategory(id)
  })

  ipcMain.handle('db:createCategory', (_event, category: any) => {
    return databaseService.createCategory(category)
  })

  ipcMain.handle('db:updateCategory', (_event, id: string, updates: any) => {
    return databaseService.updateCategory(id, updates)
  })

  ipcMain.handle('db:deleteCategory', (_event, id: string) => {
    return databaseService.deleteCategory(id)
  })

  ipcMain.handle('db:getTransactions', (_event, profileId: string, options?: any) => {
    return databaseService.getTransactions(profileId, options)
  })

  ipcMain.handle('db:getIncomeSources', (_event, profileId: string, budgetType?: string) => {
    return databaseService.getIncomeSources(profileId, budgetType)
  })

  ipcMain.handle('db:getProjects', (_event, profileId: string, budgetType?: string) => {
    return databaseService.getProjects(profileId, budgetType)
  })

  ipcMain.handle('db:getProjectTypes', (_event, profileId: string, budgetType?: string) => {
    return databaseService.getProjectTypes(profileId, budgetType)
  })

  ipcMain.handle('db:getProjectStatuses', (_event, profileId: string) => {
    return databaseService.getProjectStatuses(profileId)
  })
}).catch(error => {
  console.error('Failed to load database service:', error)
})

let mainWindow: BrowserWindow | null = null

const createWindow = () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hiddenInset', // macOS native look
    trafficLightPosition: { x: 15, y: 15 },
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Open DevTools in development
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Create native menu with keyboard shortcuts
const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Dual Budget Tracker',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow?.webContents.send('navigate', '/settings')
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Logout',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => {
            mainWindow?.webContents.send('logout')
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow?.webContents.send('navigate', '/')
          },
        },
        {
          label: 'Accounts',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow?.webContents.send('navigate', '/accounts')
          },
        },
        {
          label: 'Budget',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow?.webContents.send('navigate', '/budget')
          },
        },
        {
          label: 'Transactions',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow?.webContents.send('navigate', '/transactions')
          },
        },
        {
          label: 'Projects',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow?.webContents.send('navigate', '/projects')
          },
        },
        { type: 'separator' },
        {
          label: 'Switch to Household',
          accelerator: 'CmdOrCtrl+H',
          click: () => {
            mainWindow?.webContents.send('switch-view', 'household')
          },
        },
        {
          label: 'Switch to Business',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            mainWindow?.webContents.send('switch-view', 'business')
          },
        },
        {
          label: 'Switch to Combined',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            mainWindow?.webContents.send('switch-view', 'combined')
          },
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/chibbicodes/dual-budget-tracker')
          },
        },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// App lifecycle
app.whenReady().then(() => {
  createWindow()
  createMenu()

  app.on('activate', () => {
    // On macOS, re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On macOS, apps stay active until Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for communication with renderer
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})
