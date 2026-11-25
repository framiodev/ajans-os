/* AjansOS UXP köprüsü: backend'e WebSocket ile bağlanır, şemalı işlemleri Photoshop'ta uygular. */
const photoshop = require('photoshop');
const uxp = require('uxp');
const { app, core, action, constants } = photoshop;
const fsx = uxp.storage.localFileSystem;
const PLUGIN_VERSION = '0.3.0';
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
const rgbDesc = hex => { const c = rgb(hex); return { _obj: 'RGBColor', red: c.red, grain: c.green, blue: c.blue }; };
const px = v => ({ _unit: 'pixelsUnit', _value: v });
function boundsOf(layer) { const b = layer.bounds; return { left: num(b.left), top: num(b.top), right: num(b.right), bottom: num(b.bottom) }; }
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return { red: (n >> 16) & 255, green: (n >> 8) & 255, blue: n & 255 }; }
function modal(name, fn) { return core.executeAsModal(fn, { commandName: name }); }
function activeDoc() { const d = app.activeDocument; if (!d) throw new Error('Açık belge yok'); return d; }
// UXP, verilen yolu kendisi yüzde-kodlar; önceden kodlarsak "Ali%20Kaan" -> "Ali%2520Kaan" olur.
// Bu yüzden önce ham yolu dene, olmazsa kodlu biçime düş.
function toUrls(p) {
  const path = String(p).replace(/\\/g, '/').replace(/^\/+/, '');
  const raw = 'file:/' + path;
  const enc = 'file:/' + encodeURI(path);
  return raw === enc ? [raw] : [raw, enc];
}
async function entryAt(p, create) {
  let lastErr;
  for (const url of toUrls(p)) {
    try {
      return create ? await fsx.createEntryWithUrl(url, { overwrite: true }) : await fsx.getEntryWithUrl(url);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function kindOf(layer) {
  const k = String(layer.kind || '').toLowerCase();
  if (k.indexOf('text') >= 0) return 'text';
  if (k.indexOf('group') >= 0) return 'group';
  if (k.indexOf('smart') >= 0) return 'smartObject';
  if (k.indexOf('solid') >= 0) return 'solid';
  return k.indexOf('pixel') >= 0 ? 'pixel' : (k || 'other');
}

function fontList() { try { return Array.from(app.fonts || []); } catch (e) { return []; } }
function resolveFont(name, weight) {
  if (!name) return { ps: undefined, found: undefined, weightFound: undefined };
  const fonts = fontList();
  if (!fonts.length) return { ps: name, found: undefined, weightFound: undefined };
  const exact = fonts.find(f => f.postScriptName === name);
  if (exact) return { ps: exact.postScriptName, found: true, weightFound: weight ? undefined : true };
  const fam = fonts.filter(f => f.family === name || f.name === name);
  if (fam.length) {
    const st = f => String(f.style || '');
    let pick, weightFound = true;
    if (weight === 'bold') {
      pick = fam.find(f => /^bold$/i.test(st(f))) || fam.find(f => /bold/i.test(st(f)) && !/semi|demi|extra|black|italic|oblique/i.test(st(f)));
      if (!pick) weightFound = false;
    }
    pick = pick || fam.find(f => /^(regular|roman|normal)$/i.test(st(f))) || fam[0];
    return { ps: pick.postScriptName, found: true, weightFound };
  }
  return { ps: undefined, found: false, weightFound: undefined };
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

// Dikdörtgen/yuvarlak köşeli/elips şekil katmanı (batchPlay). Kenarlık katman efektiyle verilir.
async function makeShape(kind, a, warnings) {
  await modal('AjansOS: şekil', async () => {
    const shape = kind === 'ellipse'
      ? { _obj: 'ellipse', top: px(a.y), left: px(a.x), bottom: px(a.y + a.h), right: px(a.x + a.w) }
      : { _obj: 'rectangle', unitValueQuadVersion: 1, top: px(a.y), left: px(a.x), bottom: px(a.y + a.h), right: px(a.x + a.w),
          topRight: px(a.radius || 0), topLeft: px(a.radius || 0), bottomLeft: px(a.radius || 0), bottomRight: px(a.radius || 0) };
    await action.batchPlay([{
      _obj: 'make', _target: [{ _ref: 'contentLayer' }],
      using: { _obj: 'contentLayer', type: { _obj: 'solidColorLayer', color: rgbDesc(a.color) }, shape },
      _options: { dialogOptions: 'dontDisplay' }
    }], {});
    const layer = activeDoc().activeLayers[0];
    layer.name = a.name;
    if (a.opacity !== undefined && a.opacity < 100) layer.opacity = a.opacity;
    if (a.stroke) {
      try {
        await action.batchPlay([{
          _obj: 'set',
          _target: [{ _ref: 'property', _property: 'layerEffects' }, { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
          to: { _obj: 'layerEffects', scale: { _unit: 'percentUnit', _value: 100 },
            frameFX: { _obj: 'frameFX', enabled: true, present: true, showInDialog: true,
              style: { _enum: 'frameStyle', _value: 'insetFrame' }, paintType: { _enum: 'frameFill', _value: 'solidColor' },
              mode: { _enum: 'blendMode', _value: 'normal' }, opacity: { _unit: 'percentUnit', _value: 100 },
              size: px(a.stroke.width), color: rgbDesc(a.stroke.color), overprint: false } },
          _options: { dialogOptions: 'dontDisplay' }
        }], {});
      } catch (e) { warnings.push('kenarlık uygulanamadı'); }
    }
  });
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
    const entry = await entryAt(a.path, false);
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
    const d = activeDoc(), f = resolveFont(a.font, a.weight);
    const warnings = [];
    let created;
    await modal('AjansOS: metin', async () => {
      created = await d.createTextLayer({
        contents: String(a.contents).replace(/\n/g, '\r'),
        fontSize: a.size,
        textColor: solidColor(a.color),
        position: { x: a.x, y: (a.y !== undefined ? a.y : 0) + a.size },
        ...(f.ps ? { fontName: f.ps } : {})
      });
      created.name = a.name;
      const cs = created.textItem.characterStyle;
      if (a.tracking !== undefined) { try { cs.tracking = a.tracking; } catch (e) { warnings.push('tracking uygulanamadı'); } }
      if (a.leading !== undefined) { try { cs.autoLeading = false; cs.leading = a.leading; } catch (e) { warnings.push('satır aralığı uygulanamadı'); } }
      if (a.weight === 'bold' && f.weightFound === false) warnings.push('kalın stil bulunamadı, normal kullanıldı');
      // Gerçek ölçüye göre yerleştir: üst kenar ve hizalama
      const b = boundsOf(created);
      let top = a.y;
      if (a.afterLayer !== undefined) top = boundsOf(findLayer(a.afterLayer)).bottom + (a.gap || 0);
      const ax = a.align === 'right' ? b.right : a.align === 'center' ? (b.left + b.right) / 2 : b.left;
      const dx = a.x - ax, dy = top - b.top;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) await created.translate(dx, dy);
    });
    const nb = boundsOf(created);
    return { name: a.name, bounds: nb, fontUsed: f.ps || 'varsayılan', fontFound: f.found, warnings };
  },

  async 'shape.rect'(a) {
    const warnings = [];
    let y = a.y;
    if (a.afterLayer !== undefined) y = boundsOf(findLayer(a.afterLayer)).bottom + (a.gap || 0);
    await makeShape('rect', { ...a, y }, warnings);
    return { name: a.name, bounds: boundsOf(findLayer(a.name)), warnings };
  },

  async 'shape.ellipse'(a) {
    const warnings = [];
    await makeShape('ellipse', a, warnings);
    return { name: a.name, bounds: boundsOf(findLayer(a.name)), warnings };
  },

  async 'shape.behindText'(a) {
    const warnings = [];
    const t = findLayer(a.textLayer);
    const b = boundsOf(t);
    let w = (b.right - b.left) + a.padX * 2;
    let x = b.left - a.padX;
    if (a.minW && w < a.minW) { x -= (a.minW - w) / 2; w = a.minW; }
    const h = (b.bottom - b.top) + a.padY * 2;
    const radius = a.radius === undefined ? 0 : Math.min(a.radius, h / 2);
    await makeShape('rect', { name: a.name, x, y: b.top - a.padY, w, h, color: a.color, radius, opacity: a.opacity, stroke: a.stroke }, warnings);
    // Metnin hemen altına al (z-sırası)
    await modal('AjansOS: sırala', async () => {
      const shape = findLayer(a.name);
      shape.move(findLayer(a.textLayer), constants.ElementPlacement.PLACEAFTER);
    });
    return { name: a.name, bounds: boundsOf(findLayer(a.name)), warnings };
  },

  // Tüm kanvası kaplayan, saydamlığı değişen renk geçişi (okunurluk için karartma / scrim).
  // angle: 90 = alttan üste. UNVERIFIED: yön eşlemesi PS 28'de yetenek testiyle doğrulanır.
  async 'shape.gradient'(a) {
    const c = rgb(a.color);
    const o0 = a.opacityStart === undefined ? 0 : a.opacityStart, o1 = a.opacityEnd === undefined ? 80 : a.opacityEnd;
    const stop = (loc, op) => ({ _obj: 'transferSpec', opacity: { _unit: 'percentUnit', _value: op }, location: Math.round(loc * 40.96), midpoint: 50 });
    const col = loc => ({ _obj: 'colorStop', color: { _obj: 'RGBColor', red: c.red, grain: c.green, blue: c.blue }, type: { _enum: 'colorStopType', _value: 'userStop' }, location: Math.round(loc * 40.96), midpoint: 50 });
    await modal('AjansOS: geçiş', async () => {
      await action.batchPlay([{
        _obj: 'make', _target: [{ _ref: 'contentLayer' }],
        using: { _obj: 'contentLayer', type: {
          _obj: 'gradientLayer', angle: { _unit: 'angleUnit', _value: a.angle === undefined ? 90 : a.angle },
          type: { _enum: 'gradientType', _value: 'linear' },
          gradient: { _obj: 'gradientClassEvent', name: 'AjansOS', gradientForm: { _enum: 'gradientForm', _value: 'customStops' }, interfaceIconFrameDimmed: 4096,
            colors: [col(0), col(100)], transparency: [stop(0, o0), stop(100, o1)] } } },
        _options: { dialogOptions: 'dontDisplay' }
      }], {});
      activeDoc().activeLayers[0].name = a.name;
    });
    return { name: a.name, bounds: boundsOf(findLayer(a.name)), warnings: [] };
  },

  // Ok: gövde + iki kanat (döndürülmüş ince dikdörtgenler), tek grupta. UNVERIFIED: layer.rotate PS 28'de.
  async 'shape.arrow'(a) {
    const warnings = [];
    const t = a.thickness || 8, len = a.w;
    const dir = a.direction === 'left' ? -1 : 1;
    const tipX = dir === 1 ? a.x + len : a.x;
    await makeShape('rect', { name: a.name + '_Govde', x: a.x, y: a.y, w: len, h: t, color: a.color, radius: Math.round(t / 2) }, warnings);
    const wing = Math.round(len * 0.3);
    for (const [suffix, ang] of [['_KanatA', 40], ['_KanatB', -40]]) {
      await makeShape('rect', { name: a.name + suffix, x: tipX - wing + (dir === 1 ? 0 : 0), y: a.y + t / 2 - t / 2, w: wing, h: t, color: a.color, radius: Math.round(t / 2) }, warnings);
      await modal('AjansOS: ok kanadı', async () => {
        const l = findLayer(a.name + suffix);
        const b = boundsOf(l);
        // kanadın ucu okun ucunda kalsın: dönme merkezi uç noktası
        const pivot = dir === 1 ? constants.AnchorPosition.MIDDLERIGHT : constants.AnchorPosition.MIDDLELEFT;
        await l.rotate(dir === 1 ? ang : -ang, pivot);
      });
    }
    await modal('AjansOS: ok grubu', async () => {
      const doc = activeDoc();
      const layers = ['_Govde', '_KanatA', '_KanatB'].map(sfx => findLayer(a.name + sfx));
      const g = await doc.createLayerGroup({ name: a.name, fromLayers: layers });
      if (g) g.name = a.name;
    });
    return { name: a.name, bounds: boundsOf(findLayer(a.name)), warnings };
  },

  // Katmana gölge (katman stili, tahribatsız). UNVERIFIED: layerEffects.dropShadow tanımı.
  async 'layer.shadow'(a) {
    const c = rgb(a.color || '#000000');
    const target = findLayer(a.name);
    await modal('AjansOS: gölge', async () => {
      await action.batchPlay([{
        _obj: 'select', _target: [{ _ref: 'layer', _id: target.id }], makeVisible: false, _options: { dialogOptions: 'dontDisplay' }
      }, {
        _obj: 'set', _target: [{ _ref: 'property', _property: 'layerEffects' }, { _ref: 'layer', _enum: 'ordinal', _value: 'targetEnum' }],
        to: { _obj: 'layerEffects', scale: { _unit: 'percentUnit', _value: 100 },
          dropShadow: { _obj: 'dropShadow', enabled: true, present: true, showInDialog: true,
            mode: { _enum: 'blendMode', _value: 'multiply' }, color: { _obj: 'RGBColor', red: c.red, grain: c.green, blue: c.blue },
            opacity: { _unit: 'percentUnit', _value: a.opacity === undefined ? 45 : a.opacity }, useGlobalAngle: false,
            localLightingAngle: { _unit: 'angleUnit', _value: a.angle === undefined ? 120 : a.angle },
            distance: px(a.distance === undefined ? 12 : a.distance), chokeMatte: px(0), blur: px(a.blur === undefined ? 24 : a.blur),
            noise: { _unit: 'percentUnit', _value: 0 }, antiAlias: false, transferSpec: { _obj: 'shapeCurveType', name: 'Linear' } } },
        _options: { dialogOptions: 'dontDisplay' }
      }], {});
    });
    return { name: a.name, warnings: [] };
  },

  // Konuyu seçip katmana maske yapar (arka planı gizler). UNVERIFIED: autoCutout PS 28'de batchPlay ile.
  async 'mask.subject'(a) {
    const target = findLayer(a.name);
    await modal('AjansOS: konu maskesi', async () => {
      await action.batchPlay([
        { _obj: 'select', _target: [{ _ref: 'layer', _id: target.id }], makeVisible: false, _options: { dialogOptions: 'dontDisplay' } },
        { _obj: 'autoCutout', sampleAllLayers: false, _options: { dialogOptions: 'dontDisplay' } },
        { _obj: 'make', new: { _class: 'channel' }, at: { _ref: 'channel', _enum: 'channel', _value: 'mask' }, using: { _enum: 'userMaskEnabled', _value: 'revealSelection' }, _options: { dialogOptions: 'dontDisplay' } },
        { _obj: 'set', _target: [{ _ref: 'channel', _property: 'selection' }], to: { _enum: 'ordinal', _value: 'none' }, _options: { dialogOptions: 'dontDisplay' } }
      ], {});
    });
    return { name: a.name, warnings: [] };
  },

  async 'layer.image'(a) {
    const entry = await entryAt(a.path, false);
    const token = fsx.createSessionToken(entry);
    await modal('AjansOS: görsel', async () => {
      await action.batchPlay([{
        _obj: 'placeEvent', null: { _path: token, _kind: 'local' },
        freeTransformCenterState: { _enum: 'quadCenterState', _value: 'QCSAverage' },
        offset: { _obj: 'offset', horizontal: px(0), vertical: px(0) },
        _options: { dialogOptions: 'dontDisplay' }
      }], {});
      const layer = activeDoc().activeLayers[0];
      layer.name = a.name;
      // kapla (cover): kutuyu tamamen doldur, ortala
      let b = boundsOf(layer);
      const pct = Math.max(a.w / (b.right - b.left), a.h / (b.bottom - b.top)) * 100;
      await layer.scale(pct, pct);
      b = boundsOf(layer);
      await layer.translate(a.x + a.w / 2 - (b.left + b.right) / 2, a.y + a.h / 2 - (b.top + b.bottom) / 2);
    });
    return { name: a.name, bounds: boundsOf(findLayer(a.name)) };
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
    const layers = [];
    for (const n of a.layers) {
      try { layers.push(findLayer(n)); } catch (e) { if (!a.skipMissing) throw e; }
    }
    if (!layers.length) return { name: a.name, count: 0, skipped: true };
    await modal('AjansOS: grup', async () => {
      const g = await d.createLayerGroup({ name: a.name, fromLayers: layers });
      if (g && g.name !== a.name) g.name = a.name;
    });
    return { name: a.name, count: layers.length };
  },

  async 'doc.save'(a) {
    const d = activeDoc();
    const psd = await entryAt(a.psdPath, true);
    let png = null;
    if (a.pngPath) png = await entryAt(a.pngPath, true);
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
let reconnectTimer = null;

function connect() {
  const port = ($('port').value || '4190').trim();
  const token = $('token').value.trim();
  if (!token) { setStatus('Anahtar gerekli', 'err'); return; }
  store('ajansos.port', port); store('ajansos.token', token);
  wantConnected = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  // Eski bağlantının olayları yenisini bozmasın: önce dinleyicileri sök, sonra kapat.
  const old = ws;
  if (old) {
    old.onopen = old.onmessage = old.onclose = old.onerror = null;
    try { old.close(); } catch (e) {}
  }
  setStatus('Bağlanıyor…');
  const sock = new WebSocket('ws://localhost:' + port + '/ps?token=' + encodeURIComponent(token));
  ws = sock;
  sock.onopen = () => {
    if (ws !== sock) return;
    retry = 0;
    sock.send(JSON.stringify({ type: 'hello', plugin: PLUGIN_VERSION, photoshop: psVersion(), uxp: String(uxp.versions.uxp) }));
    setStatus('Bağlı — Photoshop ' + psVersion(), 'ok');
    log('Bağlandı');
  };
  sock.onmessage = async ev => {
    let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (msg.type !== 'req') return;
    log(msg.op);
    const res = await handle(msg);
    if (ws === sock) sock.send(JSON.stringify(res));
  };
  sock.onclose = () => {
    if (ws !== sock) return; // yerini yeni bağlantı almış
    setStatus('Bağlantı kapandı', 'err');
    if (wantConnected && !reconnectTimer) {
      retry = Math.min(retry + 1, 6);
      reconnectTimer = setTimeout(() => { reconnectTimer = null; if (wantConnected) connect(); }, 1000 * retry);
    }
  };
  sock.onerror = () => { log('Bağlantı hatası (uygulama açık mı, port ve anahtar doğru mu?)'); };
}

$('port').value = load('ajansos.port', '4190');
$('token').value = load('ajansos.token', '');
$('connect').addEventListener('click', connect);
$('token').addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
if ($('token').value) connect();
