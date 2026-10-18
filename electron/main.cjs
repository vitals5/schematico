// electron/main.cjs
const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { migrateMacroSettings } = require('./settings-migration.cjs');
const { createMacroLibrary } = require('./macro-library.cjs');
const macroLibrary = () => createMacroLibrary(path.join(app.getPath('userData'), 'macro-library.json'));

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Schematico',
    backgroundColor: '#12161f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev && !process.env.ELECTRON_PROD_TEST) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Neues Projekt',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new')
        },
        {
          label: 'Projekt öffnen...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
              title: 'Projekt öffnen',
              filters: [
                { name: 'Schematico- & Projektdateien', extensions: ['zw1', 'edz', 'xml', 'json', 'elk'] },
                { name: 'Projekt-Archiv (*.zw1)', extensions: ['zw1'] },
                { name: 'Artikel-/Makro-Paket (*.edz)', extensions: ['edz'] },
                { name: 'Projekt-XML (*.xml)', extensions: ['xml'] },
                { name: 'Schematico Projekt (*.json)', extensions: ['json'] },
                { name: 'Alle Dateien', extensions: ['*'] }
              ],
              properties: ['openFile']
            });
            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              const fileBuffer = fs.readFileSync(filePath);
              mainWindow?.webContents.send('menu:fileOpened', {
                path: filePath,
                name: path.basename(filePath),
                data: Array.from(fileBuffer)
              });
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Projekt speichern',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save')
        },
        {
          label: 'Exportieren als Projekt-Archiv (.zw1)...',
          click: () => mainWindow?.webContents.send('menu:exportZw1')
        },
        {
          label: 'Exportieren als Projekt-XML...',
          click: () => mainWindow?.webContents.send('menu:exportXml')
        },
        {
          label: 'PDF exportieren (Smart PDF)...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:exportPdf')
        },
        { type: 'separator' },
        {
          label: 'Drucken...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow?.webContents.print()
        },
        { type: 'separator' },
        {
          label: 'Beenden',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { label: 'Rückgängig', role: 'undo' },
        { label: 'Wiederholen', role: 'redo' },
        { type: 'separator' },
        { label: 'Ausschneiden', role: 'cut' },
        { label: 'Kopieren', role: 'copy' },
        { label: 'Einfügen', role: 'paste' },
        { label: 'Löschen', role: 'delete' },
        { type: 'separator' },
        {
          label: 'Bauteil um 90° drehen',
          accelerator: 'R',
          click: () => mainWindow?.webContents.send('menu:rotate')
        }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Neu laden', role: 'reload' },
        { label: 'Entwicklertools', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' },
        { label: 'Normalgröße', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Über Schematico',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Über Schematico',
              message: 'Schematico '+app.getVersion()+' (Windows)',
              detail: 'Professionelle Schematico-Software mit Projektarchiv-Unterstützung (.zw1, .edz, .xml) und normgerechter Schaltungsplanung nach DIN EN 81346 / IEC 60617.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers for native Windows file operations
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Projekt-Datei auswählen',
    filters: [
      { name: 'Schematico- & Projektdateien', extensions: ['zw1', 'edz', 'xml', 'json', 'elk'] },
      { name: 'Alle Dateien', extensions: ['*'] }
    ],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return null;
  const filePath = filePaths[0];
  const data = fs.readFileSync(filePath);
  return {
    path: filePath,
    name: path.basename(filePath),
    buffer: Array.from(data)
  };
});

ipcMain.handle('dialog:saveFile', async (_event, { defaultName, filters, data }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters || [{ name: 'Dateien', extensions: ['*'] }]
  });
  if (canceled || !filePath) return false;
  fs.writeFileSync(filePath, Buffer.from(data));
  return true;
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
