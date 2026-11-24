import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { attachWebSocket } from '../services/ps/wsServer.mjs';
import { PsBridge } from '../services/ps/bridge.mjs';

async function setup({ token = 'tok' } = {}) {
  const bridge = new PsBridge();
  const server = http.createServer((_, res) => res.end('x'));
  attachWebSocket(server, { path: '/ps', verify: (_req, url) => url.searchParams.get('token') === token, onConnection: c => bridge.attach(c) });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return { bridge, server, port, close: () => server.close() };
}

// Sahte UXP eklentisi: hello gönderir, istekleri handler ile yanıtlar.
function fakePlugin(port, handler, token = 'tok') {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ps?token=${token}`);
  const opened = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws error')); });
  ws.onmessage = async ev => {
    const m = JSON.parse(ev.data);
    if (m.type !== 'req') return;
    try { ws.send(JSON.stringify({ type: 'result', id: m.id, ok: true, result: await handler(m.op, m.args) })); }
    catch (e) { ws.send(JSON.stringify({ type: 'result', id: m.id, ok: false, error: e.message })); }
  };
  return { ws, opened, hello: () => ws.send(JSON.stringify({ type: 'hello', plugin: '0.1.0', photoshop: '27.0.0', uxp: '9' })) };
}
const until = async (fn, ms = 2000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('zaman aşımı'); await new Promise(r => setTimeout(r, 10)); } };

test('istek/yanıt turu ve durum', async () => {
  const s = await setup();
  const p = fakePlugin(s.port, (op, args) => ({ echoed: op, args }));
  await p.opened; p.hello();
  await until(() => s.bridge.status().connected);
  assert.equal(s.bridge.status().photoshop, '27.0.0');
  const r = await s.bridge.request('doc.create', { name: 'a', width: 1080, height: 1350 });
  assert.equal(r.echoed, 'doc.create');
  p.ws.close(); s.close();
});

test('yanlış token reddedilir', async () => {
  const s = await setup();
  const p = fakePlugin(s.port, () => ({}), 'yanlis');
  await assert.rejects(p.opened);
  s.close();
});

test('bağlı değilken ve geçersiz parametrede açık hata', async () => {
  const b = new PsBridge();
  await assert.rejects(b.request('ping'), /bağlı değil/);
  await assert.rejects(b.request('rm -rf', {}), /Bilinmeyen işlem/);
  await assert.rejects(b.request('layer.text', { name: 'x' }), /Geçersiz parametre/);
  await assert.rejects(b.request('doc.save', { psdPath: '/tmp/x.exe' }), /Geçersiz parametre/);
});

test('eklenti hatası iletilir; zaman aşımı; kopunca bekleyen iptal', async () => {
  const s = await setup();
  let mode = 'err';
  const p = fakePlugin(s.port, async () => { if (mode === 'err') throw new Error('Katman yok'); await new Promise(() => {}); });
  await p.opened; p.hello();
  await until(() => s.bridge.status().connected);
  await assert.rejects(s.bridge.request('ping'), /Katman yok/);
  mode = 'hang';
  await assert.rejects(s.bridge.request('ping', {}, { timeoutMs: 100 }), /yanıt vermedi/);
  const pending = s.bridge.request('ping', {}, { timeoutMs: 5000 });
  setTimeout(() => p.ws.close(), 50);
  await assert.rejects(pending, /koptu/);
  s.close();
});

test('runOps ilk hatada durur ve adımı bildirir; istekler sıralı', async () => {
  const s = await setup();
  const order = [];
  const p = fakePlugin(s.port, async op => { order.push(op); if (op === 'layer.solid') throw new Error('boom'); return op; });
  await p.opened; p.hello();
  await until(() => s.bridge.status().connected);
  await assert.rejects(s.bridge.runOps([
    { op: 'ping', args: {} }, { op: 'layer.solid', args: { name: 'BG', color: '#112233' } }, { op: 'ping', args: {} }
  ]), /Adım 2\/3 \(layer.solid\): boom/);
  assert.deepEqual(order, ['ping', 'layer.solid']);
  p.ws.close(); s.close();
});
