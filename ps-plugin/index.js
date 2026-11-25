/* AjansOS UXP köprüsü: backend'e WebSocket ile bağlanır, şemalı işlemleri Photoshop'ta uygular. */
const photoshop = require('photoshop');
const uxp = require('uxp');
const { app, core, action, constants } = photoshop;
const fsx = uxp.storage.localFileSystem;
const PLUGIN_VERSION = '0.1.2';
// Photoshop 28'de app.version boş gelebiliyor; sırayla farklı kaynaklardan oku.
function psVersion() {
  try {
    const v = app.version || (uxp.host && uxp.host.version) || (photoshop.versions && photoshop.versions.photoshop);
    return v ? String(v) : 'bilinmiyor';
  } catch { return 'bilinmiyor'; }
}

const $ = id => document.getElementById(id);
let ws = null, wantConnected = false, retry = 0;

function log(msg) {
  const el = $('log');
  el.textContent = (new Date().toLocaleTimeString() + ' ' + msg + '\n' + el.textContent).slice(0, 1500);
}
function setStatus(text, cls) { const s = $('status'); s.textContent = text; s.className = cls || ''; }
function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function load(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }

// ---------- yardımcılar ----------
const num = v => (v && typeof v === 'object') ? Number(v._value !== undefined ? v._value : (v.value !== undefined ? v.value : v)) : Number(v);
// DOM çağrıları (createTextLayer) düz nesne değil SolidColor örneği ister.
function solidColor(hex) {
  const c = new app.SolidColor();
  const { red, green, blue } = rgb(hex);
  c.rgb.red = red; c.rgb.green = green; c.rgb.blue = blue;
  return c;
}
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return { red: (n >> 16) & 255, green: (n >> 8) & 255, blue: n & 255 }; }
function modal(name, fn) { return core.executeAsModal(fn, { commandName: name }); }
function activeDoc() { const d = app.activeDocument; if (!d) throw new Error('Açık belge yok'); return d; }
function toUrl(p) { return 'file:/' + encodeURI(String(p).replace(/\\/g, '/').replace(/^\/+/, '')); }

function kindOf(layer) {
  const k = String(layer.kind || '').toLowerCase();
  if (k.indexOf('text') >= 0) return 'text';
  if (k.indexOf('group') >= 0) return 'group';
  if (k.indexOf('smart') >= 0) return 'smartObject';
  if (k.indexOf('solid') >= 0) return 'solid';
  return k.indexOf('pixel') >= 0 ? 'pixel' : (k || 'other');
}

function fontList() { try { return Array.from(app.fonts || []); } catch (e) { return []; } }
function resolveFont(name) {
  if (!name) return { ps: undefined, found: undefined };
  const fonts = fontList();
  if (!fonts.length) return { ps: name, found: undefined };
  const exact = fonts.find(f => f.postScriptName === name);
  if (exact) return { ps: exact.postScriptName, found: true };
  const fam = fonts.filter(f => f.family === name || f.name === name);
  if (fam.length) {
    const reg = fam.find(f => /regular|roman|normal/i.test(f.style || '')) || fam[0];
    return { ps: reg.postScriptName, found: true };
  }
  return { ps: undefined, found: false };
}

function walk(layers) {
  return Array.from(layers).map(l => {
    const kind = kindOf(l);
    const b = l.bounds;
    const node = {
      id: l.id, name: l.name, kind, visible: l.visible, opacity: num(l.opacity),
      bounds: b ? { left: num(b.left), top: num(b.top), right: num(b.right), bottom: num(b.bottom) } : null
    };
    if (kind === 'text') {
      try {
        const ti = l.textItem, cs = ti.characterStyle;
        const font = cs.font;
        const fonts = fontList();
        node.text = {
          contents: ti.contents, size: num(cs.size), font,
          fontAvailable: fonts.length ? fonts.some(f => f.postScriptName === font) : undefined
        };
      } catch (e) { node.text = { error: String(e.message || e) }; }
    }
    if (kind === 'group') node.children = walk(l.layers);
    return node;
  });
}

function findLayer(name, layers) {
  const out = [];
  (function rec(ls) { for (const l of ls) { if (l.name === name) out.push(l); if (kindOf(l) === 'group') rec(l.layers); } })(layers || activeDoc().layers);
  if (out.length === 0) throw new Error('Katman bulunamadı: ' + name);
  if (out.length > 1) throw new Error('Birden fazla katman aynı ada sahip: ' + name);
  return out[0];
}

// ---------- işlemler ----------
const handlers = {
  async ping() { return { pong: true, photoshop: psVersion(), hasDoc: !!app.activeDocument }; },

  async 'doc.snapshot'() {
    const d = activeDoc();
    return {
      doc: { name: d.name, width: num(d.width), height: num(d.height), resolution: num(d.resolution), mode: String(d.mode) },
      layers: walk(d.layers)
    };
  },

  async 'doc.create'(a) {
    await modal('AjansOS: belge oluştur', async () => {
      const opts = { width: a.width, height: a.height, resolution: a.resolution || 72, mode: 'RGBColorMode', fill: 'white' };
      try { await app.documents.add(Object.assign({ name: a.name }, opts)); }
      catch (e) { await app.documents.add(opts); }
    });
    const d = activeDoc();
    return { name: d.name, width: num(d.width), height: num(d.height) };
  },

  async 'doc.open'(a) {
    const entry = await fsx.getEntryWithUrl(toUrl(a.path));
    await modal('AjansOS: aç', async () => { await app.open(entry); });
    return { name: activeDoc().name };
  },

  async 'layer.solid'(a) {
    const d = activeDoc(), c = rgb(a.color);
    await modal('AjansOS: dolgu', async () => {
      await action.batchPlay([{
        _obj: 'make', _target: [{ _ref: 'contentLayer' }],
        using: { _obj: 'contentLayer', type: { _obj: 'solidColorLayer', color: { _obj: 'RGBColor', red: c.red, grain: c.green, blue: c.blue } } }
      }], { synchronousExecution: true });
      d.activeLayers[0].name = a.name;
    });
    return { name: a.name };
  },

  async 'layer.text'(a) {
    const d = activeDoc(), f = resolveFont(a.font);
    let created;
    await modal('AjansOS: metin', async () => {
      created = await d.createTextLayer({
        contents: String(a.contents).replace(/\n/g, '\r'),
        fontSize: a.size,
        textColor: solidColor(a.color),
        position: { x: a.x, y: a.y },
        ...(f.ps ? { fontName: f.ps } : {})
      });
      created.name = a.name;
    });
    return { name: a.name, fontUsed: f.ps || 'varsayılan', fontFound: f.found };
  },

  async 'layer.setText'(a) {
    const l = findLayer(a.name);
    if (kindOf(l) !== 'text') throw new Error('Katman metin değil: ' + a.name);
    const before = l.textItem.contents;
    await modal('AjansOS: metni değiştir', async () => { l.textItem.contents = String(a.contents).replace(/\n/g, '\r'); });
    const after = findLayer(a.name).textItem.contents;
    if (after === before && before !== a.contents) throw new Error('Metin değişmedi: ' + a.name);
    return { name: a.name, before, after };
  },

  async 'layer.setTextSize'(a) {
    const l = findLayer(a.name);
    if (kindOf(l) !== 'text') throw new Error('Katman metin değil: ' + a.name);
    const before = num(l.textItem.characterStyle.size);
    await modal('AjansOS: punto', async () => { l.textItem.characterStyle.size = a.size; });
    const after = num(findLayer(a.name).textItem.characterStyle.size);
    if (Math.abs(after - a.size) > 0.5) throw new Error('Punto uygulanamadı: ' + a.name + ' (' + before + ' → ' + after + ')');
    return { name: a.name, before, after };
  },

  async 'layer.rename'(a) {
    const l = findLayer(a.from);
    await modal('AjansOS: yeniden adlandır', async () => { l.name = a.to; });
    return { name: a.to };
  },

  async 'group.create'(a) {
    const d = activeDoc();
    const layers = a.layers.map(n => findLayer(n));
    await modal('AjansOS: grup', async () => {
      const g = await d.createLayerGroup({ name: a.name, fromLayers: layers });
      if (g && g.name !== a.name) g.name = a.name;
    });
    return { name: a.name, count: layers.length };
  },

  async 'doc.save'(a) {
    const d = activeDoc();
    const psd = await fsx.createEntryWithUrl(toUrl(a.psdPath), { overwrite: true });
    let png = null;
    if (a.pngPath) png = await fsx.createEntryWithUrl(toUrl(a.pngPath), { overwrite: true });
    await modal('AjansOS: kaydet', async () => {
      await d.saveAs.psd(psd, { alphaChannels: true, embedColorProfile: true }, true);
      if (png) await d.saveAs.png(png, { compression: 6 }, true);
    });
    return { psd: a.psdPath, png: a.pngPath || null };
  }
};

async function handle(msg) {
  const fn = handlers[msg.op];
  if (!fn) return { type: 'result', id: msg.id, ok: false, error: 'Eklenti bu işlemi bilmiyor: ' + msg.op };
  try {
    return { type: 'result', id: msg.id, ok: true, result: await fn(msg.args || {}) };
  } catch (e) {
    return { type: 'result', id: msg.id, ok: false, error: String((e && e.message) || e) };
  }
}

// ---------- bağlantı ----------
function connect() {
  const port = ($('port').value || '4190').trim();
  const token = $('token').value.trim();
  if (!token) { setStatus('Anahtar gerekli', 'err'); return; }
  store('ajansos.port', port); store('ajansos.token', token);
  wantConnected = true;
  try { if (ws) ws.close(); } catch (e) {}
  setStatus('Bağlanıyor…');
  ws = new WebSocket('ws://localhost:' + port + '/ps?token=' + encodeURIComponent(token));
  ws.onopen = () => {
    retry = 0;
    ws.send(JSON.stringify({ type: 'hello', plugin: PLUGIN_VERSION, photoshop: psVersion(), uxp: String(uxp.versions.uxp) }));
    setStatus('Bağlı — Photoshop ' + psVersion(), 'ok');
    log('Bağlandı');
  };
  ws.onmessage = async ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.type !== 'req') return;
    log(msg.op);
    ws.send(JSON.stringify(await handle(msg)));
  };
  ws.onclose = () => {
    setStatus('Bağlantı kapandı', 'err');
    if (wantConnected) { retry = Math.min(retry + 1, 6); setTimeout(() => { if (wantConnected) connect(); }, 1000 * retry); }
  };
  ws.onerror = () => { log('Bağlantı hatası (uygulama açık mı, port ve anahtar doğru mu?)'); };
}

$('port').value = load('ajansos.port', '4190');
$('token').value = load('ajansos.token', '');
$('connect').addEventListener('click', connect);
$('token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
if ($('token').value) connect();
