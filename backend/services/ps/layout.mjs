import { FORMAT_DIMS } from './lint.mjs';

const hex = (c, fb) => (/^#[0-9a-fA-F]{6}$/.test(c || '') ? c : fb);
function luminance(h) {
  const n = parseInt(h.slice(1), 16);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
export const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// Yaklaşık karakter genişliğiyle satır kır (Photoshop'ta ölçülemeden önce kaba tahmin).
export function wrapText(text, size, maxWidth, widthFactor = 0.56) {
  const perLine = Math.max(4, Math.floor(maxWidth / (size * widthFactor)));
  const lines = [];
  let cur = '';
  for (const w of String(text || '').split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// R1'in sade yerleşimi: gerçek, katmanlı ve adlandırılmış PSD. Gelişmiş işlemler R2'de.
export function buildPostOps({ brand, copy = {}, format = 'post', psdPath, pngPath }) {
  const { w, h } = FORMAT_DIMS[format] || FORMAT_DIMS.post;
  const bg = hex(brand.primary_color, '#0F172A');
  const accent = hex(brand.accent_color, '#38BDF8');
  const light = '#F8FAFC', dark = '#0B1120';
  const fg = contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
  const accentOnBg = contrastRatio(bg, accent) >= 3 ? accent : fg;
  const font = brand.font_family && /^[\w .-]{2,60}$/.test(brand.font_family) ? brand.font_family : undefined;

  const mx = Math.round(w * 0.09);
  const isTall = h / w > 1.6;
  const top = Math.round(h * (isTall ? 0.18 : 0.09));
  const bottomLimit = Math.round(h * (isTall ? 0.78 : 0.92));
  const colW = w - mx * 2;
  const scale = w / 1080;

  const headSize = Math.round(74 * scale), bodySize = Math.round(32 * scale), smallSize = Math.round(26 * scale);
  const headLines = wrapText(copy.title || brand.name, headSize, colW);
  const bodyLines = wrapText(copy.desc || '', bodySize, colW);

  const logoY = top + smallSize;
  const eyebrowY = Math.round(top + h * 0.1);
  const headY = eyebrowY + Math.round(headSize * 1.5);
  const bodyY = headY + Math.round(headSize * 1.15 * headLines.length) + Math.round(bodySize * 0.8);
  const ctaY = Math.min(bottomLimit - smallSize, bodyY + Math.round(bodySize * 1.35 * Math.max(1, bodyLines.length)) + Math.round(h * 0.06));

  const T = (n, contents, x, y, size, color, extra = {}) => ({ op: 'layer.text', args: { name: n, contents, x, y, size, color, ...(font ? { font } : {}), ...extra } });
  const ops = [
    { op: 'doc.create', args: { name: `${brand.name}_${format}`.slice(0, 100), width: w, height: h, resolution: 72 } },
    { op: 'layer.solid', args: { name: 'BG_Base', color: bg } },
    T('Brand_Logo', String(brand.name || '').toUpperCase().slice(0, 40), mx, logoY, smallSize, accentOnBg)
  ];
  if (copy.eyebrow) ops.push(T('Eyebrow_Text', String(copy.eyebrow).toUpperCase().slice(0, 60), mx, eyebrowY, smallSize, accentOnBg));
  ops.push(T('Headline_H1', headLines.join('\n'), mx, headY, headSize, fg));
  if (copy.desc) ops.push(T('Subcopy_Body', bodyLines.join('\n'), mx, bodyY, bodySize, fg));
  if (copy.cta) ops.push(T('CTA_Text', String(copy.cta).slice(0, 28), mx, ctaY, smallSize + 2, accentOnBg));
  ops.push({ op: 'group.create', args: { name: 'Header', layers: ['Brand_Logo'] } });
  const copyLayers = ['Eyebrow_Text', 'Headline_H1', 'Subcopy_Body'].filter(n => ops.some(o => o.args.name === n));
  ops.push({ op: 'group.create', args: { name: 'Copy', layers: copyLayers } });
  if (copy.cta) ops.push({ op: 'group.create', args: { name: 'CTA', layers: ['CTA_Text'] } });
  ops.push({ op: 'doc.save', args: { psdPath, pngPath } });
  return ops;
}
