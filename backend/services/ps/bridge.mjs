import crypto from 'node:crypto';

const COLOR = /^#[0-9a-fA-F]{6}$/;
const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const str = (v, max = 2000) => typeof v === 'string' && v.length > 0 && v.length <= max;
const name = v => str(v, 120);
const opt = (v, fn) => v === undefined || fn(v);
const stroke = v => v === undefined || (v && typeof v === 'object' && COLOR.test(v.color || '') && num(v.width, 0.5, 64));

// Eklentiye gönderilebilecek tek işlem listesi. Serbest betik yok: her işlem şemalıdır.
export const OPS = {
  ping: () => true,
  'doc.snapshot': () => true,
  'doc.create': a => name(a.name) && num(a.width, 16, 8000) && num(a.height, 16, 8000) && (a.resolution === undefined || num(a.resolution, 36, 600)),
  'doc.open': a => str(a.path, 500) && /\.psd$/i.test(a.path),
  'doc.save': a => str(a.psdPath, 500) && /\.psd$/i.test(a.psdPath) && (a.pngPath === undefined || (str(a.pngPath, 500) && /\.png$/i.test(a.pngPath))),
  'layer.solid': a => name(a.name) && COLOR.test(a.color || ''),
  // y mutlak üst kenar; afterLayer verilirse o katmanın alt kenarı + gap (gerçek Photoshop ölçüsüyle).
  'layer.text': a => name(a.name) && str(a.contents, 600) && num(a.x, -8000, 8000) && num(a.size, 4, 800) && COLOR.test(a.color || '')
    && (a.afterLayer !== undefined ? name(a.afterLayer) && opt(a.gap, v => num(v, -2000, 2000)) : num(a.y, -8000, 8000))
    && opt(a.font, v => str(v, 120)) && opt(a.weight, v => v === 'regular' || v === 'bold')
    && opt(a.tracking, v => num(v, -200, 1000)) && opt(a.leading, v => num(v, 4, 2000))
    && opt(a.align, v => v === 'left' || v === 'center' || v === 'right') && opt(a.maxWidth, v => num(v, 16, 8000)),
  'shape.rect': a => name(a.name) && num(a.w, 1, 8000) && num(a.h, 1, 8000) && num(a.x, -8000, 8000) && COLOR.test(a.color || '')
    && (a.afterLayer !== undefined ? name(a.afterLayer) && opt(a.gap, v => num(v, -2000, 2000)) : num(a.y, -8000, 8000))
    && opt(a.radius, v => num(v, 0, 4000)) && opt(a.opacity, v => num(v, 0, 100)) && stroke(a.stroke),
  'shape.ellipse': a => name(a.name) && num(a.w, 1, 8000) && num(a.h, 1, 8000) && num(a.x, -8000, 8000) && num(a.y, -8000, 8000)
    && COLOR.test(a.color || '') && opt(a.opacity, v => num(v, 0, 100)) && stroke(a.stroke),
  // Metin katmanının gerçek ölçüsüne göre arkasına şekil çizer (etiket, buton).
  'shape.behindText': a => name(a.name) && name(a.textLayer) && COLOR.test(a.color || '')
    && num(a.padX, 0, 1000) && num(a.padY, 0, 1000) && opt(a.minW, v => num(v, 1, 8000))
    && opt(a.radius, v => num(v, 0, 4000)) && opt(a.opacity, v => num(v, 0, 100)) && stroke(a.stroke),
  // Görsel yerleştirir (kapla/cover). Yalnızca isteğe bağlı adım olarak kullanılır.
  'layer.image': a => name(a.name) && str(a.path, 500) && /\.(png|jpe?g|webp)$/i.test(a.path)
    && num(a.x, -8000, 8000) && num(a.y, -8000, 8000) && num(a.w, 1, 8000) && num(a.h, 1, 8000),
  // Kanvası kaplayan renk geçişi (scrim). angle: 90 = alttan üste.
  'shape.gradient': a => name(a.name) && COLOR.test(a.color || '') && opt(a.angle, v => num(v, -360, 360))
    && opt(a.opacityStart, v => num(v, 0, 100)) && opt(a.opacityEnd, v => num(v, 0, 100)),
  'shape.arrow': a => name(a.name) && num(a.w, 8, 2000) && num(a.x, -8000, 8000) && num(a.y, -8000, 8000)
    && COLOR.test(a.color || '') && opt(a.thickness, v => num(v, 1, 200)) && opt(a.direction, v => v === 'left' || v === 'right'),
  'layer.shadow': a => name(a.name) && opt(a.color, v => COLOR.test(v)) && opt(a.opacity, v => num(v, 0, 100))
    && opt(a.blur, v => num(v, 0, 250)) && opt(a.distance, v => num(v, 0, 250)) && opt(a.angle, v => num(v, -360, 360)),
  'mask.subject': a => name(a.name),
  'layer.setText': a => name(a.name) && str(a.contents, 600),
  'layer.setTextSize': a => name(a.name) && num(a.size, 4, 800),
  'layer.rename': a => name(a.from) && name(a.to),
  'group.create': a => name(a.name) && Array.isArray(a.layers) && a.layers.length <= 50 && a.layers.every(name) && opt(a.skipMissing, v => typeof v === 'boolean')
};

export class PsBridge {
  constructor() {
    this.conn = null;
    this.info = null;
    this.pending = new Map();
    this.chain = Promise.resolve();
    this.lastSeen = 0;
  }

  attach(conn) {
    if (this.conn && this.conn !== conn) this.conn.close();
    this.conn = conn;
    this.info = null;
    this.lastSeen = Date.now();
    conn.on('message', text => this.#onMessage(conn, text));
    conn.on('close', () => {
      if (this.conn === conn) {
        this.conn = null;
        this.info = null;
        for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(new Error('Photoshop bağlantısı koptu')); }
        this.pending.clear();
      }
    });
  }

  status() {
    return { connected: !!(this.conn && this.info), ...(this.info || {}), lastSeen: this.lastSeen || null };
  }

  #onMessage(conn, text) {
    if (conn !== this.conn) return;
    this.lastSeen = Date.now();
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.type === 'hello') {
      this.info = { plugin: String(msg.plugin || ''), photoshop: String(msg.photoshop || ''), uxp: String(msg.uxp || '') };
    } else if (msg.type === 'result' && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.result);
      else p.reject(new Error(String(msg.error || 'Bilinmeyen Photoshop hatası').slice(0, 500)));
    }
  }

  // İşlemler tek tek (sıralı) çalışır: Photoshop aynı anda tek belge değişikliği kaldırır.
  request(op, args = {}, { timeoutMs = 30000 } = {}) {
    const run = () => this.#send(op, args, timeoutMs);
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  #send(op, args, timeoutMs) {
    const validate = OPS[op];
    if (!validate) return Promise.reject(new Error(`Bilinmeyen işlem: ${op}`));
    if (!validate(args || {})) return Promise.reject(new Error(`Geçersiz parametre: ${op}`));
    if (!this.conn || !this.info) return Promise.reject(new Error('Photoshop eklentisi bağlı değil. Photoshop\'ta AjansOS panelini açıp bağlanın.'));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Photoshop yanıt vermedi (${op}, ${timeoutMs / 1000} sn)`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.conn.send(JSON.stringify({ type: 'req', id, op, args }));
    });
  }

  // İşlem listesini sırayla çalıştırır; ilk hatada durur ve hangi adımda kaldığını söyler.
  // optional:true olan adım başarısız olursa uyarı olarak kaydedilir, akış devam eder.
  // Hata olsa da durmadan her adımı dener ve adım adım rapor verir (Photoshop yetenek testi için).
  async runOpsReport(ops, opts) {
    const report = [];
    for (const o of ops) {
      const t0 = Date.now();
      try { await this.request(o.op, o.args, opts); report.push({ op: o.op, name: o.args?.name || '', ok: true, ms: Date.now() - t0 }); }
      catch (e) {
        if (/bağlı değil|bağlantısı koptu/i.test(e.message)) throw e;
        report.push({ op: o.op, name: o.args?.name || '', ok: false, error: String(e.message).slice(0, 300), ms: Date.now() - t0 });
      }
    }
    return report;
  }

  async runOps(ops, opts) {
    const results = [];
    const warnings = [];
    for (let i = 0; i < ops.length; i++) {
      try {
        const r = await this.request(ops[i].op, ops[i].args, opts);
        results.push(r);
        for (const w of (r && r.warnings) || []) warnings.push(`${ops[i].args?.name || ops[i].op}: ${w}`);
      } catch (e) {
        if (ops[i].optional && !/bağlı değil|bağlantısı koptu/i.test(e.message)) {
          warnings.push(`${ops[i].args?.name || ops[i].op}: atlandı (${e.message})`);
          results.push(null);
          continue;
        }
        const err = new Error(`Adım ${i + 1}/${ops.length} (${ops[i].op}): ${e.message}`);
        err.step = i;
        err.partial = results;
        throw err;
      }
    }
    results.warnings = warnings;
    return results;
  }
}

export const bridge = new PsBridge();
