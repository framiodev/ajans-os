const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createUpdater } = require('./updater.cjs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let mainWindow = null;
const PORT = 4190;
const APP_ORIGIN = `http://127.0.0.1:${PORT}`;

// Tek örnek: ikinci kopya aynı veritabanını ve portu bozmasın.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function waitForServer(url, retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function startBackend() {
  process.env.PORT = String(PORT);
  process.env.AJANSOS_DATA_DIR = path.join(app.getPath('userData'), 'AjansOSData');
  const serverPath = path.join(__dirname, '..', 'backend', 'server.mjs');
  await import(pathToFileURL(serverPath).href);
}

async function createWindow() {
  try {
    await startBackend();
  } catch (e) {
    dialog.showErrorBox('AjansOS başlatılamadı', `Sunucu açılamadı (port ${PORT} dolu olabilir): ${e.message}`);
    app.quit();
    return;
  }
  const ready = await waitForServer(`${APP_ORIGIN}/api/health`);
  if (!ready) {
    dialog.showErrorBox('AjansOS başlatılamadı', 'Yerel sunucu yanıt vermedi. Uygulamayı kapatıp yeniden açın.');
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'FramioMedia — AjansOS Studio',
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  // Uygulama penceresi başka bir adrese gitmesin.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN)) event.preventDefault();
  });

  await mainWindow.loadURL(APP_ORIGIN);

  // GitHub Releases üzerinden uygulama içi güncelleme (açılışta + 4 saatte bir).
  const updater = createUpdater({
    autoUpdater,
    currentVersion: app.getVersion(),
    isPackaged: app.isPackaged,
    log: (m) => console.log('[updater]', m)
  });
  global.ajansUpdater = updater;
  updater.start();
}

if (app.requestSingleInstanceLock()) app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
