// Marka klasörü (Brand Vault): her marka için diskte bir klasör; kurumsal kimlik, logo, font, fotoğraf, referans, üretilenler.
import fs from 'node:fs';
import path from 'node:path';

export const FOLDERS = {
  logo: new Set(['.png']),
  fonts: new Set(['.ttf', '.otf']),
  photos: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  references: new Set(['.jpg', '.jpeg', '.png', '.webp', '.psd']),
  generated: new Set(['.jpg', '.jpeg', '.png', '.webp']),
  designs: new Set(['.psd', '.png', '.jpg'])
};
export const MAX_ASSET_BYTES = 30 * 1024 * 1024;
const HEX = /^#[0-9a-fA-F]{6}$/;

export const safeId = id => String(id || '').replace(/[^\w-]/g, '').slice(0, 60);
export function safeFileName(name) {
  const base = path.basename(String(name || '')).replace(/[^\w.\- ()çğıöşüÇĞİÖŞÜ]/g, '_').replace(/^\.+/, '').slice(0, 100);
  return base;
}

export function vaultDir(dataDir, id) {
  const sid = safeId(id);
  if (!sid) throw new Error('Geçersiz marka kimliği');
  return path.join(dataDir, 'brands', sid);
}

export function ensureVault(dir) {
  for (const f of Object.keys(FOLDERS)) fs.mkdirSync(path.join(dir, f), { recursive: true });
  return dir;
}

const DEFAULT_KIT = {
  version: 1, fontHeading: '', fontBody: '', colors: {}, tone: '', forbidden: [], logo: { onDark: '', onLight: '' }, notes: ''
};

export function readKit(dir) {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
    return sanitizeKit(raw);
  } catch { return sanitizeKit({}); }
}

const text = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export function sanitizeKit(input = {}) {
  const colors = {};
  for (const k of ['primary', 'secondary', 'accent', 'background']) {
    const c = input.colors?.[k];
    if (typeof c === 'string' && HEX.test(c)) colors[k] = c.toUpperCase();
  }
  const fontOk = v => (typeof v === 'string' && /^[\w .-]{2,60}$/.test(v.trim()) ? v.trim() : '');
  return {
    ...DEFAULT_KIT,
    version: 1,
    fontHeading: fontOk(input.fontHeading), fontBody: fontOk(input.fontBody),
    colors,
    tone: text(input.tone, 300),
    forbidden: Array.isArray(input.forbidden) ? input.forbidden.map(x => text(x, 60)).filter(Boolean).slice(0, 50) : [],
    logo: { onDark: safeFileName(input.logo?.onDark), onLight: safeFileName(input.logo?.onLight) },
    notes: text(input.notes, 2000)
  };
}

export function writeKit(dir, input) {
  const kit = sanitizeKit(input);
  ensureVault(dir);
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(kit, null, 2), 'utf8');
  return kit;
}

export function scan(dir) {
  const out = {};
  for (const [folder, exts] of Object.entries(FOLDERS)) {
    const p = path.join(dir, folder);
    let files = [];
    try {
      files = fs.readdirSync(p, { withFileTypes: true })
        .filter(d => d.isFile() && exts.has(path.extname(d.name).toLowerCase()))
        .map(d => { const full = path.join(p, d.name); const st = fs.statSync(full); return { name: d.name, fullPath: full, size: st.size, mtimeMs: Math.round(st.mtimeMs) }; })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);
    } catch {}
    out[folder] = files;
  }
  return out;
}

export function saveAsset(dir, folder, name, buffer) {
  const exts = FOLDERS[folder];
  if (!exts) throw new Error('Geçersiz klasör');
  const fname = safeFileName(name);
  if (!fname || !exts.has(path.extname(fname).toLowerCase())) throw new Error(`Bu klasör için desteklenmeyen dosya türü: ${path.extname(fname) || '(yok)'}`);
  if (!buffer?.length) throw new Error('Boş dosya');
  if (buffer.length > MAX_ASSET_BYTES) throw new Error('Dosya çok büyük (en fazla 30 MB)');
  ensureVault(dir);
  const full = path.join(dir, folder, fname);
  fs.writeFileSync(full, buffer);
  return { name: fname, fullPath: full, size: buffer.length };
}

export function removeAsset(dir, folder, name) {
  if (!FOLDERS[folder]) throw new Error('Geçersiz klasör');
  const full = path.join(dir, folder, safeFileName(name));
  if (!full.startsWith(path.join(dir, folder) + path.sep)) throw new Error('Geçersiz yol');
  if (!fs.existsSync(full)) throw new Error('Dosya yok');
  fs.rmSync(full);
}

// PNG boyutu (IHDR) — logoyu oranını bozmadan yerleştirmek için.
export function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(24); fs.readSync(fd, b, 0, 24, 0); fs.closeSync(fd);
    if (b.readUInt32BE(0) !== 0x89504e47) return null;
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  } catch { return null; }
}

const lum = h => { const n = parseInt(h.slice(1), 16); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };

// Koyu ve açık zemin için logo sürümlerini çözer; biri yoksa diğeri yedek olur.
export function resolveLogos(dir, kit) {
  const files = scan(dir).logo.map(f => f.name);
  const exact = n => { if (!n) return null; const full = path.join(dir, 'logo', safeFileName(n)); return fs.existsSync(full) && path.extname(full).toLowerCase() === '.png' ? { path: full, size: pngSize(full) } : null; };
  const hintDark = files.find(n => /(light|beyaz|white|acik|açık)/i.test(n));   // koyu zeminde kullanılan açık renkli logo
  const hintLight = files.find(n => /(dark|siyah|black|koyu)/i.test(n));       // açık zeminde kullanılan koyu renkli logo
  const first = files[0];
  const onDark = exact(kit.logo.onDark) || exact(hintDark) || exact(first) || exact(kit.logo.onLight) || exact(hintLight);
  const onLight = exact(kit.logo.onLight) || exact(hintLight) || exact(first) || exact(kit.logo.onDark) || exact(hintDark);
  return { onDark, onLight };
}

export function vaultReport(dir, kit, dbBrand) {
  const assets = scan(dir);
  const warnings = [];
  if (!assets.logo.length) warnings.push('Logo yok (logo/ klasörüne PNG ekleyin; açık ve koyu zemin için iki sürüm önerilir).');
  if (!kit.fontHeading && !(dbBrand?.font_family)) warnings.push('Marka fontu tanımlı değil.');
  if (!assets.fonts.length && (kit.fontHeading || kit.fontBody)) warnings.push('Font dosyası fonts/ klasöründe yok. Font Photoshop\'ta kurulu olmalıdır; yoksa yedek font kullanılır.');
  if (!assets.photos.length) warnings.push('Marka fotoğrafı yok.');
  if (!Object.keys(kit.colors).length && !(dbBrand?.primary_color)) warnings.push('Marka renkleri tanımlı değil.');
  return { assets, warnings };
}
