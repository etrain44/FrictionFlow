const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const window = new BrowserWindow({
    width: 480,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#f6f4ef',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  window.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('import-frictionflow-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import FrictionFlow sync file',
    defaultPath: app.getPath('downloads'),
    properties: ['openFile'],
    filters: [{ name: 'FrictionFlow sync', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return { error: 'Could not read that file. Make sure it is a FrictionFlow export.' };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
