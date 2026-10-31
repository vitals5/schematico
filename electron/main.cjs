// electron/main.cjs
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { migrateMacroSettings } = require('./settings-migration.cjs');
const { createMacroLibrary } = require('./macro-library.cjs');
const macroLibrary = () => createMacroLibrary(path.join(app.getPath('userData'), 'macro-library.json'));
const brandIcon = path.join(__dirname, app.isPackaged
  ? '../dist/branding/icon-256.png' : '../public/branding/icon-256.png');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Schematico',
    icon: brandIcon,
    backgroundColor: '#12161f',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.removeMenu();
  Menu.setApplicationMenu(null);

  const isDev = !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !process.env.ELECTRON_PROD_TEST) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for native desktop file operations
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Projekt-Datei auswählen',
    filters: [
      { name: 'Schematico- & Projektdateien', extensions: ['zw1', 'zip', 'edz', 'xml', 'json', 'elk', '001', '002', '003'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || filePaths.length === 0) return null;
  const files = filePaths.map(fp => ({
    path: fp,
    name: path.basename(fp),
    buffer: Array.from(fs.readFileSync(fp))
  }));
  return {
    path: files[0].path,
    name: files[0].name,
    buffer: files[0].buffer,
    files
  };
});

ipcMain.handle('dialog:saveFile', async (_event, { filePath: targetPath, defaultName, filters, data }) => {
  let finalPath = targetPath;
  if (!finalPath) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: filters || [{ name: 'Dateien', extensions: ['*'] }]
    });
    if (canceled || !filePath) return null;
    finalPath = filePath;
  }
  fs.writeFileSync(finalPath, Buffer.from(data));
  return finalPath;
});

ipcMain.handle('macroLibrary:getFolder', () => macroLibrary().getFolder());
ipcMain.handle('macroLibrary:setFolder', (_event, folder) => macroLibrary().setFolder(folder));
ipcMain.handle('macroLibrary:chooseFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ordner für externe Makros auswählen', defaultPath: await macroLibrary().getFolder() || undefined,
    properties: ['openDirectory']
  });
  return canceled || !filePaths.length ? null : macroLibrary().setFolder(filePaths[0]);
});
ipcMain.handle('macroLibrary:list', () => macroLibrary().list());
ipcMain.handle('macroLibrary:read', (_event, relativePath) => macroLibrary().read(relativePath));

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('de.schematico.cae');
  migrateMacroSettings(app.getPath('appData'),app.getPath('userData'));
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
