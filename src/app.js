const path = require('path');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { getDynastyFiles, getSaveDirectory } = require('./franchise/franchiseLoader');
const { FranchiseSession } = require('./franchise/franchiseSession');
const { createMainWindow } = require('./ui/mainWindow');

const projectRoot = path.resolve(__dirname, '..');
const session = new FranchiseSession(projectRoot);

function registerIpcHandlers() {
  ipcMain.handle('app:get-info', async () => ({
    dynastyFiles: getDynastyFiles(),
    saveDirectory: getSaveDirectory()
  }));

  ipcMain.handle('app:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select CFB27 Saves Directory'
    });
    
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    
    const selectedDirectory = result.filePaths[0];
    return {
      dynastyFiles: getDynastyFiles(selectedDirectory),
      saveDirectory: selectedDirectory
    };
  });

  ipcMain.handle('dynasty:load', async (_event, dynastyName, customSaveDirectory) => session.load(dynastyName, customSaveDirectory));
  ipcMain.handle('candidate:update-interest', async (_event, payload) => session.updateInterest(payload));
  ipcMain.handle('candidate:move', async (_event, payload) => session.moveCandidate(payload));
  ipcMain.handle('candidate:replace-coach', async (_event, payload) => session.replaceCoach(payload));
  ipcMain.handle('dynasty:save', async () => session.save());
}

app.setName('CFB27 Coaching Carousel Editor');
registerIpcHandlers();

app.whenReady().then(() => {
  createMainWindow(projectRoot);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(projectRoot);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
