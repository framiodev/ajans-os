'use strict';
// Uygulama içi güncelleyici. electron-updater'ı sarar; durumu tek yerde tutar.
// Test edilebilsin diye autoUpdater ve app dışarıdan verilir.

const HOUR = 60 * 60 * 1000;

function createUpdater({
  autoUpdater,
  currentVersion,
  isPackaged,
  log = () => {},
  intervalMs = 4 * HOUR,
  startDelayMs = 15000,
  now = () => Date.now(),
  schedule = { setTimeout, setInterval }
}) {
  const state = {
    status: isPackaged ? 'idle' : 'dev', // dev | idle | checking | uptodate | downloading | ready | error
    current: currentVersion,
    latest: null,
    percent: 0,
    error: null,
    checkedAt: null
  };
  const timers = [];

  const set = (patch) => Object.assign(state, patch);

  if (isPackaged) {
    autoUpdater.autoDownload = true;
    // Kullanıcı "yeniden başlat" demese bile uygulama kapanırken kurulur.
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

    autoUpdater.on('checking-for-update', () => set({ status: 'checking', error: null }));
    autoUpdater.on('update-available', (info) => {
      log(`Yeni sürüm bulundu: ${info?.version}`);
      set({ status: 'downloading', latest: info?.version || null, percent: 0, checkedAt: now() });
    });
    autoUpdater.on('update-not-available', () => {
      set({ status: 'uptodate', latest: currentVersion, percent: 0, checkedAt: now() });
    });
    autoUpdater.on('download-progress', (p) => {
      set({ status: 'downloading', percent: Math.round(p?.percent || 0) });
    });
    autoUpdater.on('update-downloaded', (info) => {
      log(`Güncelleme indirildi: ${info?.version}`);
      set({ status: 'ready', latest: info?.version || state.latest, percent: 100, checkedAt: now() });
    });
    autoUpdater.on('error', (err) => {
      log(`Güncelleme hatası: ${err?.message || err}`);
      set({ status: 'error', error: String(err?.message || err).slice(0, 300), checkedAt: now() });
    });
  }

  async function check() {
    if (!isPackaged) return getState();
    // İndirme sürerken ya da hazırken yeni kontrol başlatma.
    if (state.status === 'checking' || state.status === 'downloading' || state.status === 'ready') return getState();
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      // 'error' olayı da tetiklenir; olay gelmediyse durumu biz yazalım.
      if (state.status !== 'error') set({ status: 'error', error: String(err?.message || err).slice(0, 300), checkedAt: now() });
    }
    return getState();
  }

  function install() {
    if (state.status !== 'ready') return { ok: false, message: 'Henüz indirilmiş bir güncelleme yok.' };
    // isSilent=false: kurulum penceresi görünsün; isForceRunAfter=true: kurulumdan sonra uygulama açılsın.
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { ok: true, message: 'Güncelleme kuruluyor, uygulama yeniden başlayacak.' };
  }

  function start() {
    if (!isPackaged) return;
    const first = schedule.setTimeout(() => { check(); }, startDelayMs);
    const loop = schedule.setInterval(() => { check(); }, intervalMs);
    first.unref?.();
    loop.unref?.();
    timers.push(first, loop);
  }

  function stop() {
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers.length = 0;
  }

  function getState() {
    return { ...state };
  }

  return { getState, check, install, start, stop };
}

module.exports = { createUpdater };
