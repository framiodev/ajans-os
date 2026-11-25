const { app, BrowserWindow, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const { createUpdater } = require('./updater.cjs');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
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

// Node'un http modülüyle denetle (fetch'e göre proxy/AV kaynaklı takılmalardan etkilenmez).
function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 2500, agent: false }, (res) => {
      let body = '';
      res.on('data', (c) => { if (body.length < 200) body += c; });
      res.on('end', () => resolve(res.statusCode === 200 ? { ok: true } : { ok: false, detail: `HTTP ${res.statusCode}: ${body.slice(0, 120)}` }));
    });
    req.on('timeout', () => req.destroy(new Error('zaman aşımı')));
    req.on('error', (e) => resolve({ ok: false, detail: [e.code, e.syscall, e.address, e.message].filter(Boolean).join(' ') }));
  });
}

async function waitForServer(url, retries = 30) {
  let last = { ok: false, detail: 'bağlantı kurulamadı' };
  for (let i = 0; i < retries; i++) {
    last = await probe(url);
    if (last.ok) return last;
    await new Promise(r => setTimeout(r, 300));
  }
  return last;
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
    // Sunucu dinliyor (serverReady çözüldü); sağlık kontrolü takıldıysa yine de arayüzü açmayı dene.
    logLine(`sağlık kontrolü başarısız, yine de açılıyor: ${ready.detail}`);
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

  try {
    await mainWindow.loadURL(APP_ORIGIN);
  } catch (e) {
    logLine(`arayüz yüklenemedi: ${e.code || ''} ${e.message}`);
    dialog.showErrorBox('AjansOS başlatılamadı', `Arayüz yüklenemedi.\n\nSağlık kontrolü: ${ready.ok ? 'tamam' : ready.detail}\nArayüz: ${e.code || ''} ${e.message}\nKayıt: ${path.join(app.getPath('userData'), 'ajansos.log')}`);
    app.quit();
    return;
  }

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
