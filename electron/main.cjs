const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
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

  // GitHub Releases Otomatik Güncelleme Kontrolü
  global.triggerAjansUpdateCheck = async () => {
    if (!app.isPackaged) return { ok: true, message: 'Geliştirme modunda otomatik güncelleme kapalı.' };
    try {
      const res = await autoUpdater.checkForUpdates();
      const latest = res?.updateInfo?.version;
      if (latest && latest !== app.getVersion()) {
        return { ok: true, message: `Yeni sürüm bulundu (v${latest}). Arka planda indiriliyor, bitince kurulum penceresi açılacak...` };
      }
      return { ok: true, message: `Uygulama güncel (v${app.getVersion()}).` };
    } catch (e) {
      return { ok: false, message: 'Güncelleme kontrol hatası: ' + e.message };
    }
  };

  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-downloaded', (info) => {
      dialog
        .showMessageBox(mainWindow, {
          type: 'info',
          title: 'Yeni Sürüm Hazır',
          message: `FramioMedia AjansOS v${info.version} indirildi.`,
          detail: 'Güncellemeyi uygulamak için uygulamayı şimdi yeniden başlatmak ister misiniz?',
          buttons: ['Şimdi Güncelle', 'Daha Sonra']
        })
        .then((res) => {
          if (res.response === 0) autoUpdater.quitAndInstall();
        });
    });
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
}

if (app.requestSingleInstanceLock()) app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
