const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createUpdater } = require('./updater.cjs');
const path = require('node:path');
const fs = require('node:fs');
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

function logLine(msg) {
  try {
    const file = path.join(app.getPath('userData'), 'ajansos.log');
    fs.appendFileSync(file, `${new Date().toISOString()} ${msg}\n`);
  } catch {}
}

async function waitForServer(url, retries = 30) {
  let last = 'bağlantı kurulamadı';
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return { ok: true };
      last = `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`;
    } catch (e) {
      last = e.cause?.code || e.message;
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return { ok: false, detail: last };
}

async function startBackend() {
  process.env.PORT = String(PORT);
  process.env.AJANSOS_DATA_DIR = path.join(app.getPath('userData'), 'AjansOSData');
  const serverPath = path.join(__dirname, '..', 'backend', 'server.mjs');
  const mod = await import(pathToFileURL(serverPath).href);
  await mod.serverReady; // port dolu/yasaklıysa gerçek hata burada fırlar
}

async function createWindow() {
  logLine(`başlatılıyor v${app.getVersion()} (${app.isPackaged ? 'kurulu' : 'geliştirme'})`);
  try {
    await startBackend();
  } catch (e) {
    logLine(`sunucu hatası: ${e.code || ''} ${e.message}`);
    const hint = e.code === 'EADDRINUSE'
      ? `Port ${PORT} başka bir uygulama tarafından kullanılıyor. AjansOS'un eski bir kopyası arka planda açık olabilir; Görev Yöneticisi'nden kapatıp yeniden deneyin.`
      : e.code === 'EACCES'
        ? `Windows port ${PORT}'ü kullanıma kapatmış (ayrılmış port aralığı).`
        : e.message;
    dialog.showErrorBox('AjansOS başlatılamadı', `${hint}\n\nTeknik ayrıntı: ${e.code || ''} ${e.message}\nKayıt: ${path.join(app.getPath('userData'), 'ajansos.log')}`);
    app.quit();
    return;
  }
  const ready = await waitForServer(`${APP_ORIGIN}/api/health`);
  if (!ready.ok) {
    logLine(`sağlık kontrolü başarısız: ${ready.detail}`);
    dialog.showErrorBox('AjansOS başlatılamadı', `Yerel sunucu beklenen yanıtı vermedi.\n\nTeknik ayrıntı: ${ready.detail}\nKayıt: ${path.join(app.getPath('userData'), 'ajansos.log')}`);
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
