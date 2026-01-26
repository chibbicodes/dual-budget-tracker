import { app, BrowserWindow, Menu, shell, ipcMain } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load better-sqlite3 using require from project root (where node_modules is)
// In dev mode, process.cwd() is the project root where node_modules is located
// createRequire needs a file path in that directory
const require = createRequire(path.join(process.cwd(), 'index.js'))
const Database = require('better-sqlite3')

// Import database service (runs in main process only)
// Pass Database constructor to avoid bundling issues
let databaseServicePromise: Promise<any> | null = null
let databaseService: any = null

// Start loading database service immediately
databaseServicePromise = import('./services/database/databaseService.js').then(module => {
  databaseService = module.createDatabaseService(Database)
  return databaseService
}).catch(error => {
  console.error('Failed to load database service:', error)
  throw error
})

// Register IPC handlers BEFORE app.whenReady()
// Handlers will await the database service to be loaded
ipcMain.handle('db:initialize', async () => {
  await databaseServicePromise
  await databaseService.initialize()
})

ipcMain.handle('db:getAllProfiles', async () => {
  await databaseServicePromise
  return databaseService.getAllProfiles()
})

ipcMain.handle('db:getProfile', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getProfile(id)
})

ipcMain.handle('db:createProfile', async (_event, profile: any) => {
  await databaseServicePromise
  return databaseService.createProfile(profile)
})

ipcMain.handle('db:updateProfile', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateProfile(id, updates)
})

ipcMain.handle('db:updateProfileLastAccessed', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.updateProfileLastAccessed(id)
})

ipcMain.handle('db:deleteProfile', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteProfile(id)
})

ipcMain.handle('db:getSettings', async (_event, profileId: string) => {
  await databaseServicePromise
  return databaseService.getSettings(profileId)
})

ipcMain.handle('db:updateSettings', async (_event, profileId: string, settings: any) => {
  await databaseServicePromise
  return databaseService.updateSettings(profileId, settings)
})

ipcMain.handle('db:getAccounts', async (_event, profileId: string, budgetType?: string) => {
  await databaseServicePromise
  return databaseService.getAccounts(profileId, budgetType)
})

ipcMain.handle('db:getAccountsForSync', async (_event, profileId: string) => {
  await databaseServicePromise
  return databaseService.getAccountsForSync(profileId)
})

ipcMain.handle('db:getAccount', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getAccount(id)
})

ipcMain.handle('db:createAccount', async (_event, account: any) => {
  await databaseServicePromise
  return databaseService.createAccount(account)
})

ipcMain.handle('db:updateAccount', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateAccount(id, updates)
})

ipcMain.handle('db:deleteAccount', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteAccount(id)
})

ipcMain.handle('db:getAccountForSync', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getAccountForSync(id)
})

ipcMain.handle('db:updateAccountForSync', async (_event, id: string, data: any) => {
  await databaseServicePromise
  return databaseService.updateAccountForSync(id, data)
})

ipcMain.handle('db:createAccountForSync', async (_event, account: any) => {
  await databaseServicePromise
  return databaseService.createAccountForSync(account)
})

ipcMain.handle('db:getCategories', async (_event, profileId: string, budgetType?: string) => {
  await databaseServicePromise
  return databaseService.getCategories(profileId, budgetType)
})

ipcMain.handle('db:getCategoriesForSync', async (_event, profileId: string) => {
  await databaseServicePromise
  return databaseService.getCategoriesForSync(profileId)
})

ipcMain.handle('db:getCategory', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getCategory(id)
})

ipcMain.handle('db:createCategory', async (_event, category: any) => {
  await databaseServicePromise
  return databaseService.createCategory(category)
})

ipcMain.handle('db:updateCategory', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateCategory(id, updates)
})

ipcMain.handle('db:deleteCategory', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteCategory(id)
})

ipcMain.handle('db:getCategoryForSync', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getCategoryForSync(id)
})

ipcMain.handle('db:updateCategoryForSync', async (_event, id: string, data: any) => {
  await databaseServicePromise
  return databaseService.updateCategoryForSync(id, data)
})

ipcMain.handle('db:createCategoryForSync', async (_event, category: any) => {
  await databaseServicePromise
  return databaseService.createCategoryForSync(category)
})

ipcMain.handle('db:getTransactions', async (_event, profileId: string, options?: any) => {
  await databaseServicePromise
  return databaseService.getTransactions(profileId, options)
})

ipcMain.handle('db:getIncomeSources', async (_event, profileId: string, budgetType?: string) => {
  await databaseServicePromise
  return databaseService.getIncomeSources(profileId, budgetType)
})

ipcMain.handle('db:getProjects', async (_event, profileId: string, budgetType?: string) => {
  await databaseServicePromise
  return databaseService.getProjects(profileId, budgetType)
})

ipcMain.handle('db:getProjectTypes', async (_event, profileId: string, budgetType?: string) => {
  await databaseServicePromise
  return databaseService.getProjectTypes(profileId, budgetType)
})

ipcMain.handle('db:getProjectStatuses', async (_event, profileId: string) => {
  await databaseServicePromise
  return databaseService.getProjectStatuses(profileId)
})

// Transaction CRUD operations
ipcMain.handle('db:getTransaction', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getTransaction(id)
})

ipcMain.handle('db:createTransaction', async (_event, transaction: any) => {
  await databaseServicePromise
  return databaseService.createTransaction(transaction)
})

ipcMain.handle('db:updateTransaction', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateTransaction(id, updates)
})

ipcMain.handle('db:deleteTransaction', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteTransaction(id)
})

// Income Source CRUD operations
ipcMain.handle('db:getIncomeSource', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getIncomeSource(id)
})

ipcMain.handle('db:createIncomeSource', async (_event, source: any) => {
  await databaseServicePromise
  return databaseService.createIncomeSource(source)
})

ipcMain.handle('db:updateIncomeSource', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateIncomeSource(id, updates)
})

ipcMain.handle('db:deleteIncomeSource', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteIncomeSource(id)
})

// Project CRUD operations
ipcMain.handle('db:getProject', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getProject(id)
})

ipcMain.handle('db:createProject', async (_event, project: any) => {
  await databaseServicePromise
  return databaseService.createProject(project)
})

ipcMain.handle('db:updateProject', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateProject(id, updates)
})

ipcMain.handle('db:deleteProject', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteProject(id)
})

// Project Type CRUD operations
ipcMain.handle('db:getProjectType', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getProjectType(id)
})

ipcMain.handle('db:createProjectType', async (_event, projectType: any) => {
  await databaseServicePromise
  return databaseService.createProjectType(projectType)
})

ipcMain.handle('db:updateProjectType', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateProjectType(id, updates)
})

ipcMain.handle('db:deleteProjectType', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteProjectType(id)
})

// Project Status CRUD operations
ipcMain.handle('db:getProjectStatus', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.getProjectStatus(id)
})

ipcMain.handle('db:createProjectStatus', async (_event, status: any) => {
  await databaseServicePromise
  return databaseService.createProjectStatus(status)
})

ipcMain.handle('db:updateProjectStatus', async (_event, id: string, updates: any) => {
  await databaseServicePromise
  return databaseService.updateProjectStatus(id, updates)
})

ipcMain.handle('db:deleteProjectStatus', async (_event, id: string) => {
  await databaseServicePromise
  return databaseService.deleteProjectStatus(id)
})

// Initialize database when app is ready
app.whenReady().then(async () => {
  try {
    await databaseServicePromise
    await databaseService.initialize()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }
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
