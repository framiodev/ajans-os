import crypto from 'node:crypto';

const COLOR = /^#[0-9a-fA-F]{6}$/;
const num = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const str = (v, max = 2000) => typeof v === 'string' && v.length > 0 && v.length <= max;
const name = v => str(v, 120);

// Eklentiye gönderilebilecek tek işlem listesi. Serbest betik yok: her işlem şemalıdır.
export const OPS = {
  ping: () => true,
  'doc.snapshot': () => true,
  'doc.create': a => name(a.name) && num(a.width, 16, 8000) && num(a.height, 16, 8000) && (a.resolution === undefined || num(a.resolution, 36, 600)),
  'doc.open': a => str(a.path, 500) && /\.psd$/i.test(a.path),
  'doc.save': a => str(a.psdPath, 500) && /\.psd$/i.test(a.psdPath) && (a.pngPath === undefined || (str(a.pngPath, 500) && /\.png$/i.test(a.pngPath))),
  'layer.solid': a => name(a.name) && COLOR.test(a.color || ''),
  'layer.text': a => name(a.name) && str(a.contents, 600) && num(a.x, -8000, 8000) && num(a.y, -8000, 8000) && num(a.size, 4, 800) && COLOR.test(a.color || '')
    && (a.font === undefined || str(a.font, 120)) && (a.maxWidth === undefined || num(a.maxWidth, 16, 8000)),
  'layer.setText': a => name(a.name) && str(a.contents, 600),
  'layer.setTextSize': a => name(a.name) && num(a.size, 4, 800),
  'layer.rename': a => name(a.from) && name(a.to),
  'group.create': a => name(a.name) && Array.isArray(a.layers) && a.layers.length <= 50 && a.layers.every(name)
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
  async runOps(ops, opts) {
    const results = [];
    for (let i = 0; i < ops.length; i++) {
      try {
        results.push(await this.request(ops[i].op, ops[i].args, opts));
      } catch (e) {
        const err = new Error(`Adım ${i + 1}/${ops.length} (${ops[i].op}): ${e.message}`);
        err.step = i;
        err.partial = results;
        throw err;
      }
    }
    return results;
  }
}

export const bridge = new PsBridge();
