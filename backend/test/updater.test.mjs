import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createUpdater } = require('../../electron/updater.cjs');

function fakeAutoUpdater({ checkImpl } = {}) {
  const au = new EventEmitter();
  au.checks = 0;
  au.installs = 0;
  au.checkForUpdates = async () => { au.checks++; return checkImpl ? checkImpl(au) : undefined; };
  au.quitAndInstall = () => { au.installs++; };
  return au;
}
const noTimers = { setTimeout: () => ({}), setInterval: () => ({}) };

test('geliştirme modunda kontrol yapılmaz', async () => {
  const au = fakeAutoUpdater();
  const u = createUpdater({ autoUpdater: au, currentVersion: '1.3.0', isPackaged: false, schedule: noTimers });
  assert.equal(u.getState().status, 'dev');
  await u.check();
  assert.equal(au.checks, 0);
});

test('yeni sürüm: indiriliyor -> ilerleme -> hazır -> kurulum', async () => {
  const au = fakeAutoUpdater({ checkImpl: (a) => { a.emit('checking-for-update'); a.emit('update-available', { version: '1.4.0' }); } });
  const u = createUpdater({ autoUpdater: au, currentVersion: '1.3.0', isPackaged: true, schedule: noTimers });
  assert.equal(au.autoInstallOnAppQuit, true);
  await u.check();
  assert.equal(u.getState().status, 'downloading');
  assert.equal(u.getState().latest, '1.4.0');
  au.emit('download-progress', { percent: 41.6 });
  assert.equal(u.getState().percent, 42);
  assert.equal(u.install().ok, false); // henüz hazır değil
  au.emit('update-downloaded', { version: '1.4.0' });
  assert.equal(u.getState().status, 'ready');
  assert.equal(u.install().ok, true);
  await new Promise(r => setImmediate(r));
  assert.equal(au.installs, 1);
});

test('güncel ve hata durumları', async () => {
  const au = fakeAutoUpdater({ checkImpl: (a) => a.emit('update-not-available', {}) });
  const u = createUpdater({ autoUpdater: au, currentVersion: '1.3.0', isPackaged: true, schedule: noTimers });
  await u.check();
  assert.equal(u.getState().status, 'uptodate');

  const bad = fakeAutoUpdater({ checkImpl: () => { throw new Error('ağ yok'); } });
  const u2 = createUpdater({ autoUpdater: bad, currentVersion: '1.3.0', isPackaged: true, schedule: noTimers });
  await u2.check();
  assert.equal(u2.getState().status, 'error');
  assert.match(u2.getState().error, /ağ yok/);
  // hatadan sonra bir sonraki kontrol yeniden denenir
  bad.checkForUpdates = async () => { bad.emit('update-not-available', {}); };
  await u2.check();
  assert.equal(u2.getState().status, 'uptodate');
});

test('indirme sürerken ya da hazırken yeni kontrol başlatılmaz', async () => {
  const au = fakeAutoUpdater({ checkImpl: (a) => a.emit('update-available', { version: '1.4.0' }) });
  const u = createUpdater({ autoUpdater: au, currentVersion: '1.3.0', isPackaged: true, schedule: noTimers });
  await u.check();
  await u.check();
  assert.equal(au.checks, 1);
});

test('start: ilk kontrol ve periyodik kontrol planlanır', () => {
  const calls = [];
  const schedule = {
    setTimeout: (fn, ms) => { calls.push(['t', ms]); return {}; },
    setInterval: (fn, ms) => { calls.push(['i', ms]); return {}; }
  };
  const u = createUpdater({ autoUpdater: fakeAutoUpdater(), currentVersion: '1.3.0', isPackaged: true, schedule, intervalMs: 1000, startDelayMs: 50 });
  u.start();
  assert.deepEqual(calls, [['t', 50], ['i', 1000]]);
});
