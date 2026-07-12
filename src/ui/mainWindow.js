const path = require('path');
const { BrowserWindow } = require('electron');

function createMainWindow(projectRoot) {
  const window = new BrowserWindow({
    backgroundColor: '#f7f8fa',
    height: 860,
    minHeight: 720,
    minWidth: 1180,
    show: false,
    title: 'CFB27 Coaching Carousel Editor',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(projectRoot, 'src', 'preload.js')
    },
    width: 1360
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.loadFile(path.join(projectRoot, 'src', 'ui', 'index.html'));
  return window;
}

module.exports = {
  createMainWindow
};
