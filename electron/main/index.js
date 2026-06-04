const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const Store = require('electron-store')
const { spawn } = require('child_process')
const fs = require('fs')

const store = new Store()
let mainWindow = null
let backendProcess = null
const isDev = !app.isPackaged

// ─── CREATE WINDOW ──────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })

  setupMenu()
}

// ─── MENU ────────────────────────────────────────────────────────────────────

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-project') },
        { label: 'Open Project', accelerator: 'CmdOrCtrl+O', click: () => openProject() },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { type: 'separator' },
        { label: 'Export Audio', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow?.webContents.send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => mainWindow?.webContents.send('menu:redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Beat Maker', accelerator: 'F1', click: () => mainWindow?.webContents.send('menu:view', 'beatmaker') },
        { label: 'Voice Editor', accelerator: 'F2', click: () => mainWindow?.webContents.send('menu:view', 'voice') },
        { label: 'DJ Mixer', accelerator: 'F3', click: () => mainWindow?.webContents.send('menu:view', 'dj') },
        { label: 'Timeline', accelerator: 'F4', click: () => mainWindow?.webContents.send('menu:view', 'timeline') },
        { label: 'MIDI Editor', accelerator: 'F5', click: () => mainWindow?.webContents.send('menu:view', 'midi') },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Documentation', click: () => shell.openExternal('https://docs.musiccreator.app') },
        { label: 'Report Bug', click: () => shell.openExternal('https://github.com/musiccreator/issues') },
        { type: 'separator' },
        { label: 'About', click: () => showAbout() }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC HANDLERS ────────────────────────────────────────────────────────────

ipcMain.handle('dialog:open-file', async (_, opts) => {
  const result = await dialog.showOpenDialog(mainWindow, opts)
  return result
})

ipcMain.handle('dialog:save-file', async (_, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, opts)
  return result
})

ipcMain.handle('store:get', (_, key) => store.get(key))
ipcMain.handle('store:set', (_, key, val) => store.set(key, val))
ipcMain.handle('store:delete', (_, key) => store.delete(key))

ipcMain.handle('fs:read', (_, filePath) => {
  try { return fs.readFileSync(filePath) } catch { return null }
})

ipcMain.handle('fs:write', (_, filePath, data) => {
  try { fs.writeFileSync(filePath, data); return true } catch { return false }
})

ipcMain.handle('fs:list-dir', (_, dirPath) => {
  try { return fs.readdirSync(dirPath) } catch { return [] }
})

ipcMain.handle('app:get-path', (_, name) => app.getPath(name))
ipcMain.handle('app:get-version', () => app.getVersion())

ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

// ─── BACKEND PROCESS ─────────────────────────────────────────────────────────

function startBackend() {
  const backendPath = path.join(__dirname, '../../backend')
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  backendProcess = spawn(pythonCmd, ['-m', 'uvicorn', 'app.main:app', '--port', '8000', '--host', '127.0.0.1'], {
    cwd: backendPath,
    stdio: 'pipe'
  })

  backendProcess.stdout?.on('data', (d) => console.log('[Backend]', d.toString()))
  backendProcess.stderr?.on('data', (d) => console.error('[Backend Error]', d.toString()))
  backendProcess.on('close', (code) => console.log('[Backend] exited with code', code))
}

function openProject() {
  dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [{ name: 'Music Creator Project', extensions: ['mcp'] }]
  }).then(result => {
    if (!result.canceled && result.filePaths[0]) {
      mainWindow?.webContents.send('project:open', result.filePaths[0])
    }
  })
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Music Creator',
    message: 'Music Creator v1.0.0',
    detail: 'Professional DAW for Everyone\nBuilt with Electron + React + Python'
  })
}

// ─── APP LIFECYCLE ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  if (!isDev) startBackend()
  app.on('activate', () => { if (!mainWindow) createWindow() })
})

app.on('window-all-closed', () => {
  backendProcess?.kill()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  backendProcess?.kill()
})
