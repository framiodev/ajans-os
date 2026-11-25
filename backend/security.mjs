import fs from 'node:fs';
import path from 'node:path';

// Yalnızca yerel arayüzden gelen isteklere izin verir (DNS rebinding + başka sitelerden CSRF koruması).
const ALLOWED_HOSTS = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const ALLOWED_ORIGINS = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

export function localOnly(req, res, next) {
  const host = req.headers.host || '';
  if (!ALLOWED_HOSTS.test(host)) return res.status(403).json({ error: 'Host reddedildi' });
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.test(origin)) return res.status(403).json({ error: 'Origin reddedildi' });
  next();
}

export const SECRET_KEYS = new Set(['anthropic_api_key', 'gemini_api_key', 'firefly_api_key', 'claude_api_key']);

export function isSecretKey(key) {
  return SECRET_KEYS.has(key) || /(api[_-]?key|token|secret|password)/i.test(key);
}

export function maskSecret(value) {
  const v = String(value || '');
  if (!v) return '';
  return v.length <= 8 ? '••••' : `••••${v.slice(-4)}`;
}

// Gerçek yolu (symlink çözülmüş) döndürür; yoksa en yakın var olan atanın gerçek yolu + kalan.
function realish(p) {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync(abs);
  } catch {
    const parent = path.dirname(abs);
    if (parent === abs) return abs;
    return path.join(realish(parent), path.basename(abs));
  }
}

export function isInside(root, target) {
  if (!root || !target) return false;
  const r = realish(root);
  const t = realish(target);
  const rel = path.relative(r, t);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function isInsideAny(roots, target) {
  return roots.filter(Boolean).some(r => isInside(r, target));
}

// Dosya adı parçası: yalnızca harf, rakam, tire, alt çizgi.
export function safeSegment(value, fallback = 'post') {
  const s = String(value ?? '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return s || fallback;
}

const FORMATS = new Set(['linkedin', 'post', 'story', 'reel', 'carousel', 'cover', 'banner', 'square']);
export function safeFormat(value) {
  const s = safeSegment(String(value ?? 'post').toLowerCase(), 'post');
  return FORMATS.has(s) ? s : 'post';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeCssColor(value, fallback = '#0F172A') {
  return /^#[0-9a-fA-F]{6}$/.test(String(value ?? '')) ? value : fallback;
}

// CSV formül enjeksiyonu koruması (Excel/Sheets: = + - @ TAB CR ile başlayan hücreler).
export function csvCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

// İstemciden gelen dosya yolunu doğrular: izinli kök içinde, beklenen uzantıda, var olan dosya.
export function validatedPath(p, roots, exts) {
  const s = String(p || '');
  if (!s || s.includes('\0')) return null;
  if (!exts.has(path.extname(s).toLowerCase())) return null;
  if (!isInsideAny(roots, s) || !fs.existsSync(s)) return null;
  return path.resolve(s);
}
