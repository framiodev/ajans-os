// Tasarım tarifleri (recipe): düz veri. Derleyici bunları Photoshop işlemlerine çevirir.
// Aynı şema ileride videodan/görselden öğrenilen tarifleri de taşıyacak (R3/R4).
import { FORMAT_DIMS, SAFE } from './lint.mjs';

// ---------- renk ----------
const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexOk = (c, fb) => (HEX.test(c || '') ? c.toUpperCase() : fb);
const rgbOf = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
export function mix(a, b, t) { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); }
function luminance(h) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgbOf(h);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export const contrastRatio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const LIGHT = '#F8FAFC', DARK = '#0B1120';
const onColor = bg => (contrastRatio(bg, LIGHT) >= contrastRatio(bg, DARK) ? LIGHT : DARK);

export function colorTokens(brand, opts = {}) {
  const primary = hexOk(brand.primary_color, '#0F172A');
  const accentRaw = hexOk(brand.accent_color, '#38BDF8');
  // paper: açık, kâğıt tonlu zemin; metin marka koyusu (okunaklıysa) ya da koyu lacivert.
  const bg = opts.paper ? '#F5F2EC' : primary;
  const fg = opts.paper ? (contrastRatio(primary, bg) >= 7 ? primary : DARK) : onColor(bg);
  const accentOnBg = contrastRatio(bg, accentRaw) >= 3 ? accentRaw : fg;
  return {
    bg, fg, accentRaw, accentOnBg,
    onAccent: onColor(accentOnBg),
    onAccentRaw: onColor(accentRaw),
    muted: mix(fg, bg, 0.38),
    fgSoft: mix(fg, bg, 0.14),
    tint: mix(bg, accentOnBg, 0.16),
    rule: mix(bg, fg, 0.22),
    onFg: onColor(fg)
  };
}

// ---------- yazı tipleri ----------
const FONT_OK = /^[\w .-]{2,60}$/;
// "Montserrat / Inter" gibi tek alanlı değerden başlık ve gövde fontlarını çıkarır; marka kiti öncelikli.
export function brandFonts(brand) {
  const parts = String(brand.font_family || '').split('/').map(x => x.trim()).filter(x => FONT_OK.test(x));
  const heading = FONT_OK.test(brand.fontHeading || '') ? brand.fontHeading : parts[0];
  const body = FONT_OK.test(brand.fontBody || '') ? brand.fontBody : (parts[1] || heading);
  return { heading, body };
}
const isHeadingItem = name => /^(Headline|Price|Brand_Logo)/.test(name);

// ---------- metin ----------
const ARROWS = /[←-⇿➠-➿⬀-⯿»›▶►️]|\p{Extended_Pictographic}/gu;
// Fontlarda çoğu zaman olmayan ok/emoji karakterlerini temizler (kutu "▯" olarak çıkıyordu).
export function sanitize(text) {
  return String(text ?? '').replace(ARROWS, '').replace(/[ \t]+/g, ' ').replace(/\s+\n/g, '\n').trim();
}

const charFactor = ({ caps, bold, tracking = 0 }) => (caps ? (bold ? 0.72 : 0.68) : (bold ? 0.58 : 0.54)) + tracking / 1000;

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

// ---------- tarifler ----------
// Değerler "{post:..,story:..,default:..}" biçiminde formata göre değişebilir.
const pick = (v, format) => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[format] ?? v.default) : v;

const TOP = { post: 0.075, square: 0.075, story: 0.175, reel: 0.175, linkedin: 0.09, carousel: 0.075 };

export const SEED_RECIPES = [
  {
    id: 'editorial-dark',
    name: 'Editoryal Koyu',
    description: 'Harf aralıklı logo, ince çizgi, etiketli üst başlık, kalın başlık, vurgu çubuğu, dolgulu buton ve alt çizgi. Premium/gastronomi/gayrimenkul gibi markalarda güvenli seçim.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'image', name: 'Visual_Hero', when: 'hero', optional: true, group: 'Visual' },
      { type: 'rect', name: 'Visual_Overlay', when: 'hero', x: 'left', w: 'full', h: 'full', color: 'bg', opacity: 58, anchor: { top: 0 }, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_A', when: '!hero', cx: { default: 0.82, story: 0.8, linkedin: 0.8 }, cy: { default: 0.68, story: 0.72, linkedin: 0.5 }, d: { default: 0.62, linkedin: 0.95 }, color: 'accentOnBg', opacity: 12, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_B', when: '!hero', cx: { default: 0.82, story: 0.8, linkedin: 0.8 }, cy: { default: 0.68, story: 0.72, linkedin: 0.5 }, d: { default: 0.34, linkedin: 0.52 }, color: 'accentOnBg', opacity: 18, group: 'Visual' },

      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'accentOnBg', anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Meta_Text', bind: 'copy.meta|brand.sector', upper: true, size: 22, tracking: 160, color: 'muted', align: 'right', anchor: { sameTopAs: 'Brand_Logo' }, optional: true, dropIfOverlaps: 'Brand_Logo', group: 'Header' },
      { type: 'rect', name: 'Header_Rule', x: 'left', w: 'content', h: 2, color: 'rule', anchor: { after: ['Brand_Logo'], gap: 34 }, group: 'Header' },

      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 24, bold: true, tracking: 140, color: 'accentOnBg', inset: 22, anchor: { after: ['Header_Rule'], gap: { default: 70, story: 90 } }, group: 'Copy' },
      { type: 'behindText', name: 'Eyebrow_Tag', of: 'Eyebrow_Text', padX: 22, padY: 14, radius: 4, color: 'tint', stroke: { color: 'accentOnBg', width: 1.5 }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 84, linkedin: 76 }, bold: true, color: 'fg', leadingMul: 1.06, maxWidth: { default: 0.9, linkedin: 1 }, anchor: { after: ['Eyebrow_Tag', 'Header_Rule'], gap: 46 }, group: 'Copy' },
      { type: 'rect', name: 'Accent_Bar', x: 'left', w: 84, h: 7, color: 'accentOnBg', anchor: { after: ['Headline_H1'], gap: 34 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 34, color: 'fgSoft', leadingMul: 1.36, maxWidth: { default: 0.82, linkedin: 1 }, anchor: { after: ['Accent_Bar', 'Headline_H1'], gap: 30 }, group: 'Copy' },

      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 28, bold: true, tracking: 160, color: 'onAccent', inset: 40, anchor: { after: ['Subcopy_Body', 'Accent_Bar', 'Headline_H1'], gap: 56 + 26 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 40, padY: 26, radius: 6, color: 'accentOnBg', minW: 300, group: 'CTA' },

      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' },
      { type: 'rect', name: 'Footer_Rule', requires: 'URL_Text', x: 'left', w: 'content', h: 2, color: 'rule', anchor: { bottom: true, offset: 56 }, group: 'Footer' }
    ]
  },
  {
    id: 'bold-center',
    name: 'Ortalı Cesur',
    description: 'Ortalı, iri başlıklı; üstte renkli şerit, yuvarlak hap buton. Duyuru, kampanya ve kısa mesajlar için.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'image', name: 'Visual_Hero', when: 'hero', optional: true, group: 'Visual' },
      { type: 'rect', name: 'Visual_Overlay', when: 'hero', x: 'left', w: 'full', h: 'full', color: 'bg', opacity: 62, anchor: { top: 0 }, group: 'Visual' },
      { type: 'rect', name: 'Visual_Band', x: 'left', w: 'full', h: 16, color: 'accentOnBg', anchor: { top: 0 }, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_A', when: '!hero', cx: { default: 0.94, linkedin: 0.9 }, cy: { default: 0.08, linkedin: 0.1 }, d: { default: 0.5, linkedin: 0.7 }, color: 'accentOnBg', opacity: 10, group: 'Visual' },

      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 260, color: 'accentOnBg', align: 'center', anchor: { topFrac: { default: 0.1, story: 0.18, linkedin: 0.12 } }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 24, bold: true, tracking: 200, color: 'muted', align: 'center', anchor: { after: ['Brand_Logo'], gap: { default: 150, story: 200, linkedin: 90 } }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 100, linkedin: 88 }, bold: true, color: 'fg', align: 'center', leadingMul: 1.04, maxWidth: { default: 0.92, linkedin: 0.7 }, anchor: { after: ['Eyebrow_Text', 'Brand_Logo'], gap: 40 }, group: 'Copy' },
      { type: 'rect', name: 'Accent_Bar', x: 'center', w: 96, h: 8, color: 'accentOnBg', anchor: { after: ['Headline_H1'], gap: 44 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 34, color: 'fgSoft', align: 'center', leadingMul: 1.36, maxWidth: { default: 0.78, linkedin: 0.55 }, anchor: { after: ['Accent_Bar'], gap: 40 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 28, bold: true, tracking: 160, color: 'onAccent', align: 'center', inset: 0, anchor: { after: ['Subcopy_Body', 'Accent_Bar'], gap: 70 + 26 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 56, padY: 26, radius: 'full', color: 'accentOnBg', minW: 320, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', align: 'center', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  },
  {
    id: 'color-block',
    name: 'Renk Bloğu',
    description: 'Üstte marka renginde büyük blok (logo + başlık), altta sakin alan (metin + buton). Güçlü marka rengi olan işletmeler için.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'rect', name: 'Block_Accent', x: 'left', w: 'full', h: { default: 0.5, story: 0.46, linkedin: 0.58, square: 0.52 }, hMode: 'frac', color: 'accentRaw', anchor: { top: 0 }, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_A', cx: { default: 0.9, linkedin: 0.9 }, cy: { default: 0.1, linkedin: 0.1 }, d: { default: 0.5, linkedin: 0.8 }, color: 'onAccentRaw', opacity: 10, group: 'Visual' },

      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'onAccentRaw', anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 24, bold: true, tracking: 180, color: 'onAccentRaw', anchor: { after: ['Brand_Logo'], gap: { default: 90, story: 130 } }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 82, linkedin: 76 }, bold: true, color: 'onAccentRaw', leadingMul: 1.05, maxWidth: { default: 0.9, linkedin: 0.9 }, within: 'Block_Accent', anchor: { after: ['Eyebrow_Text', 'Brand_Logo'], gap: 28 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 34, color: 'fgSoft', leadingMul: 1.36, maxWidth: { default: 0.84, linkedin: 0.9 }, anchor: { afterBlock: 'Block_Accent', gap: 56 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 28, bold: true, tracking: 160, color: 'onFg', inset: 40, anchor: { after: ['Subcopy_Body'], gap: 50 + 26 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 40, padY: 26, radius: 6, color: 'fg', minW: 300, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  },
  {
    id: 'sehir-vurgu',
    manual: true,
    name: 'Şehir Vurgu',
    description: 'Çok iri, iki tonlu başlık (ilk sözcük beyaz, kalan vurgu renginde). Şehir, rota, sefer ve duyuru başlıkları için; seyahat/turizm markalarında güçlü.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'ellipse', name: 'Visual_Orb_A', cx: { default: 0.88, story: 0.9, linkedin: 0.86 }, cy: { default: 0.92, story: 0.9, linkedin: 0.9 }, d: { default: 0.9, linkedin: 1.1 }, color: 'accentOnBg', opacity: 10, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_B', cx: { default: 0.88, story: 0.9, linkedin: 0.86 }, cy: { default: 0.92, story: 0.9, linkedin: 0.9 }, d: { default: 0.5, linkedin: 0.6 }, color: 'accentOnBg', opacity: 14, group: 'Visual' },
      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'fg', anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Meta_Text', bind: 'copy.meta|brand.sector', upper: true, size: 22, tracking: 160, color: 'muted', align: 'right', anchor: { sameTopAs: 'Brand_Logo' }, optional: true, dropIfOverlaps: 'Brand_Logo', group: 'Header' },
      { type: 'rect', name: 'Accent_Bar', x: 'left', w: 120, h: 9, color: 'accentOnBg', anchor: { after: ['Brand_Logo'], gap: { default: 54, story: 70 } }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 26, bold: true, tracking: 200, color: 'accentOnBg', anchor: { after: ['Accent_Bar'], gap: { default: 64, story: 120 } }, group: 'Copy' },
      { type: 'arrow', name: 'Route_Arrow', sameTopAs: 'Eyebrow_Text', w: 170, dy: 12, thickness: 9, color: 'accentOnBg', align: 'right', group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title:first', size: { default: 136, linkedin: 108 }, bold: true, color: 'fg', leadingMul: 1.0, maxWidth: 1, anchor: { after: ['Eyebrow_Text', 'Accent_Bar'], gap: 26 }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1b', bind: 'copy.title:rest', size: { default: 136, linkedin: 108 }, bold: true, color: 'accentOnBg', leadingMul: 1.0, maxWidth: 1, anchor: { after: ['Headline_H1'], gap: 6 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 36, color: 'fgSoft', leadingMul: 1.36, maxWidth: { default: 0.82, linkedin: 1 }, anchor: { after: ['Headline_H1b', 'Headline_H1', 'Eyebrow_Text'], gap: 44 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 30, bold: true, tracking: 160, color: 'onAccent', inset: 44, anchor: { after: ['Subcopy_Body', 'Headline_H1b', 'Headline_H1'], gap: 56 + 28 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 44, padY: 28, radius: 'full', color: 'accentOnBg', minW: 320, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  },
  {
    id: 'kampanya-fiyat',
    manual: true,
    name: 'Kampanya / Fiyat',
    description: 'İri fiyat veya rakam öne çıkar (copy.price). Fiyat yoksa başlık öne çıkar. İndirim, sefer fiyatı, kampanya ve paket duyuruları için.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'rect', name: 'Visual_Band', x: 'left', w: 'full', h: 16, color: 'accentOnBg', anchor: { top: 0 }, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_A', cx: { default: 0.1, linkedin: 0.12 }, cy: { default: 0.95, linkedin: 0.9 }, d: { default: 0.8, linkedin: 1 }, color: 'accentOnBg', opacity: 10, group: 'Visual' },
      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'fg', anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 26, bold: true, tracking: 160, color: 'onAccent', inset: 24, anchor: { after: ['Brand_Logo'], gap: { default: 120, story: 160 } }, group: 'Copy' },
      { type: 'behindText', name: 'Eyebrow_Tag', of: 'Eyebrow_Text', padX: 24, padY: 14, radius: 'full', color: 'accentOnBg', group: 'Copy' },
      { type: 'text', name: 'Price_Text', bind: 'copy.price', size: { default: 230, linkedin: 170 }, bold: true, color: 'accentOnBg', leadingMul: 1.0, maxWidth: 1, anchor: { after: ['Eyebrow_Tag', 'Brand_Logo'], gap: 40 }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 76, linkedin: 66 }, bold: true, color: 'fg', leadingMul: 1.06, maxWidth: { default: 0.92, linkedin: 0.9 }, anchor: { after: ['Price_Text', 'Eyebrow_Tag', 'Brand_Logo'], gap: 30 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 34, color: 'fgSoft', leadingMul: 1.36, maxWidth: { default: 0.84, linkedin: 1 }, anchor: { after: ['Headline_H1'], gap: 30 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 30, bold: true, tracking: 160, color: 'onFg', inset: 44, anchor: { after: ['Subcopy_Body', 'Headline_H1'], gap: 50 + 28 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 44, padY: 28, radius: 6, color: 'fg', minW: 320, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  },
  {
    id: 'editoryal-acik',
    manual: true,
    name: 'Editoryal Açık',
    description: 'Açık kâğıt tonlu zemin, marka koyusuyla metin, solda dikey renk şeridi. Koyu tariflerle ritim değişimi sağlar; sakin, güven veren markalar için.',
    paper: true,
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'rect', name: 'Visual_Band', x: 'edge', w: 22, h: 'full', color: 'accentOnBg', anchor: { top: 0 }, group: 'Visual' },
      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'fg', inset: 24, anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Meta_Text', bind: 'copy.meta|brand.sector', upper: true, size: 22, tracking: 160, color: 'muted', align: 'right', anchor: { sameTopAs: 'Brand_Logo' }, optional: true, dropIfOverlaps: 'Brand_Logo', group: 'Header' },
      { type: 'rect', name: 'Header_Rule', x: 'left', w: 'content', h: 2, color: 'rule', anchor: { after: ['Brand_Logo'], gap: 34 }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 26, bold: true, tracking: 180, color: 'accentOnBg', inset: 24, anchor: { after: ['Header_Rule'], gap: { default: 100, story: 140 } }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 96, linkedin: 82 }, bold: true, color: 'fg', leadingMul: 1.05, maxWidth: { default: 0.88, linkedin: 1 }, inset: 24, anchor: { after: ['Eyebrow_Text', 'Header_Rule'], gap: 34 }, group: 'Copy' },
      { type: 'rect', name: 'Accent_Bar', x: 'left', w: 96, h: 8, color: 'accentOnBg', anchor: { after: ['Headline_H1'], gap: 38 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 36, color: 'fgSoft', leadingMul: 1.38, maxWidth: { default: 0.8, linkedin: 1 }, inset: 24, anchor: { after: ['Accent_Bar', 'Headline_H1'], gap: 34 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 30, bold: true, tracking: 160, color: 'onAccent', inset: 68, anchor: { after: ['Subcopy_Body', 'Accent_Bar', 'Headline_H1'], gap: 60 + 28 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 44, padY: 28, radius: 0, color: 'accentOnBg', minW: 320, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'muted', inset: 24, anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  },
  {
    id: 'foto-hero',
    manual: true,
    name: 'Fotoğraflı Hero',
    description: 'Tam kadraj fotoğraf, alttan koyulaşan perde (gradient) ve iri başlık. Şehir/rota/destinasyon gibi fotoğraf taşıyan duyurular için; fotoğraf yoksa marka renkli zemin kullanır.',
    items: [
      { type: 'bg', name: 'BG_Base', color: 'bg' },
      { type: 'image', name: 'Visual_Hero', when: 'hero', optional: true, group: 'Visual' },
      { type: 'gradient', name: 'Visual_Scrim', when: 'hero', color: 'bg', angle: 90, opacityStart: 0, opacityEnd: 88, group: 'Visual' },
      { type: 'rect', name: 'Visual_Top_Scrim', when: 'hero', x: 'left', w: 'full', h: 220, color: 'bg', opacity: 45, anchor: { top: 0 }, group: 'Visual' },
      { type: 'ellipse', name: 'Visual_Orb_A', when: '!hero', cx: { default: 0.8, story: 0.8, linkedin: 0.8 }, cy: { default: 0.3, story: 0.3, linkedin: 0.5 }, d: { default: 0.8, linkedin: 1 }, color: 'accentOnBg', opacity: 12, group: 'Visual' },
      { type: 'text', name: 'Brand_Logo', bind: 'brand.name', upper: true, size: 30, bold: true, tracking: 220, color: 'fg', anchor: { topFrac: TOP }, group: 'Header' },
      { type: 'text', name: 'Eyebrow_Text', bind: 'copy.eyebrow', upper: true, size: 26, bold: true, tracking: 200, color: 'accentOnBg', anchor: { topFrac: { default: 0.44, story: 0.44, linkedin: 0.34 } }, group: 'Copy' },
      { type: 'text', name: 'Headline_H1', bind: 'copy.title', size: { default: 112, linkedin: 88 }, bold: true, color: 'fg', leadingMul: 1.02, maxWidth: 1, anchor: { after: ['Eyebrow_Text'], gap: 26 }, group: 'Copy' },
      { type: 'text', name: 'Subcopy_Body', bind: 'copy.desc', size: 34, color: 'fgSoft', leadingMul: 1.36, maxWidth: { default: 0.84, linkedin: 0.9 }, anchor: { after: ['Headline_H1'], gap: 34 }, group: 'Copy' },
      { type: 'text', name: 'CTA_Text', bind: 'copy.cta', upper: true, size: 28, bold: true, tracking: 160, color: 'onAccent', inset: 40, anchor: { after: ['Subcopy_Body', 'Headline_H1'], gap: 48 + 26 }, group: 'CTA' },
      { type: 'behindText', name: 'CTA_Button', of: 'CTA_Text', padX: 40, padY: 26, radius: 'full', color: 'accentOnBg', minW: 300, group: 'CTA' },
      { type: 'text', name: 'URL_Text', bind: 'brand.url', size: 24, tracking: 60, color: 'fgSoft', anchor: { bottom: true, offset: 0 }, optional: true, group: 'Footer' }
    ]
  }
];

export function listRecipes() {
  return SEED_RECIPES.map(r => ({ id: r.id, name: r.name, description: r.description }));
}

// Aynı marka hep aynı ailede kalsın (marka sürekliliği); açıkça seçilirse o kullanılır.
export function chooseRecipe(brand, recipeId) {
  const byId = SEED_RECIPES.find(r => r.id === recipeId);
  if (byId) return byId;
  let h = 0;
  for (const ch of String(brand?.id || brand?.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const auto = SEED_RECIPES.filter(r => !r.manual); // yeni tarifler marka ailesi netleşene kadar yalnızca elle seçilir
  return auto[h % auto.length];
}

// ---------- derleyici ----------
export function metrics(format) {
  const { w, h } = FORMAT_DIMS[format] || FORMAT_DIMS.post;
  const [sx, , sb] = SAFE[format] || SAFE.default;
  const mx = Math.round(w * (format === 'linkedin' ? 0.07 : 0.085));
  return { w, h, mx, contentW: w - mx * 2, safeBottomY: Math.round(h * (1 - sb)), safeTop: Math.round(h * (TOP[format] ?? 0.075)) };
}

function bindValue(bind, { brand, copy }) {
  for (const b of String(bind || '').split('|')) {
    const [src, keyRaw] = b.split('.');
    const [key, part] = String(keyRaw || '').split(':');
    let v;
    if (src === 'brand') {
      if (key === 'url') v = String(brand.website || '').replace(/^https?:\/\//i, '').replace(/\/+$/, '');
      else v = brand[key];
    } else if (src === 'copy') v = copy[key];
    v = sanitize(v);
    if (v && part) {
      const words = v.split(/\s+/);
      v = part === 'first' ? words[0] : words.slice(1).join(' ');
    }
    if (v) return v;
  }
  return '';
}

function lineHeightPx(item, size) { return item.leadingMul ? Math.round(size * item.leadingMul) : Math.round(size * 1.2); }

// Tahmini metin kutusu (Photoshop gerçek ölçüyü verir; bu yalnızca satır kırma ve test için).
export function textBox(item, size, lines) {
  const f = charFactor({ caps: item.upper, bold: item.bold, tracking: item.tracking });
  const width = Math.max(...lines.map(l => l.length), 1) * size * f;
  const lead = lineHeightPx(item, size);
  const height = (lines.length - 1) * lead + Math.round(size * 0.95);
  return { width, height, lead };
}

// İçerik sığmazsa gövde puntolarını ve boşlukları kademeli küçültür (alt bilgiye ve güvenli alana taşma olmasın).
export function compileRecipe(recipe, ctx) {
  let best;
  const tall = ctx.format === 'story' || ctx.format === 'reel';
  for (const scale of [...(tall ? [1.5, 1.4, 1.32] : []), 1.25, 1.18, 1.1, 1.04, 1, 0.92, 0.85, 0.78, 0.72]) {
    const ops = compileOnce(recipe, ctx, scale);
    if (ops.fits) { ops.scale = scale; return ops; }
    best = ops;
  }
  best.notes.push('İçerik tam sığmadı; en küçük ölçek kullanıldı, metni kısaltmayı düşünün.');
  best.scale = 0.72;
  return best;
}

function compileOnce(recipe, { brand, copy = {}, format = 'post', psdPath, pngPath, heroImagePath }, scale = 1) {
  const T = colorTokens(brand, { paper: recipe.paper });
  const M = metrics(format);
  const fonts = brandFonts(brand);
  const ops = [{ op: 'doc.create', args: { name: `${brand.name}_${format}`.slice(0, 100), width: M.w, height: M.h, resolution: 72 } }];
  const emitted = new Map(); // ad -> {estimated bounds}
  const groups = new Map();
  const notes = [];
  const col = c => (T[c] || hexOk(c, T.fg));

  const addGroup = (item) => { if (item.group) { if (!groups.has(item.group)) groups.set(item.group, []); groups.get(item.group).push(item.name); } };
  const firstExisting = names => (names || []).find(n => emitted.has(n));

  for (const item of recipe.items) {
    if (item.requires && !emitted.has(item.requires)) continue;
    if (item.when === 'hero' && !heroImagePath) continue;
    if (item.when === '!hero' && heroImagePath) continue;

    if (item.type === 'bg') {
      ops.push({ op: 'layer.solid', args: { name: item.name, color: col(item.color) } });
      continue;
    }

    if (item.type === 'image') {
      ops.push({ op: 'layer.image', optional: true, args: { name: item.name, path: heroImagePath, x: 0, y: 0, w: M.w, h: M.h } });
      emitted.set(item.name, { left: 0, top: 0, right: M.w, bottom: M.h });
      addGroup(item);
      continue;
    }

    if (item.type === 'gradient') {
      ops.push({ op: 'shape.gradient', optional: true, args: { name: item.name, color: col(item.color), angle: pick(item.angle, format) ?? 90, opacityStart: item.opacityStart ?? 0, opacityEnd: item.opacityEnd ?? 80 } });
      emitted.set(item.name, { left: 0, top: 0, right: M.w, bottom: M.h });
      addGroup(item);
      continue;
    }

    if (item.type === 'arrow') {
      const ref = emitted.get(item.sameTopAs);
      if (!ref) continue;
      const w = pick(item.w, format);
      const x = item.align === 'right' ? M.w - M.mx - w : M.mx;
      const y = Math.round(ref.top + (item.dy || 0));
      ops.push({ op: 'shape.arrow', optional: true, args: { name: item.name, x, y, w, thickness: item.thickness || 8, color: col(item.color), ...(item.direction ? { direction: item.direction } : {}) } });
      emitted.set(item.name, { left: x, top: y - w * 0.2, right: x + w, bottom: y + w * 0.2 });
      addGroup(item);
      continue;
    }

    if (item.type === 'ellipse') {
      const d = Math.round(pick(item.d, format) * Math.min(M.w, M.h));
      const cx = Math.round(pick(item.cx, format) * M.w), cy = Math.round(pick(item.cy, format) * M.h);
      ops.push({ op: 'shape.ellipse', args: { name: item.name, x: cx - d / 2, y: cy - d / 2, w: d, h: d, color: col(item.color), ...(item.opacity !== undefined ? { opacity: item.opacity } : {}) } });
      emitted.set(item.name, { left: cx - d / 2, top: cy - d / 2, right: cx + d / 2, bottom: cy + d / 2 });
      addGroup(item);
      continue;
    }

    if (item.type === 'rect') {
      const a = item.anchor || {};
      const hRaw = pick(item.h, format);
      const h = item.hMode === 'frac' || hRaw === 'full' ? Math.round((hRaw === 'full' ? 1 : hRaw) * M.h) : hRaw;
      const w = item.w === 'full' ? M.w : item.w === 'content' ? M.contentW : item.w;
      const x = item.x === 'edge' ? 0 : item.x === 'left' ? (item.w === 'full' ? 0 : M.mx) : item.x === 'center' ? Math.round((M.w - w) / 2) : M.mx;
      const args = { name: item.name, x, w, h, color: col(item.color), ...(item.opacity !== undefined ? { opacity: item.opacity } : {}) };
      let top;
      if (a.bottom) top = M.safeBottomY - (a.offset || 0) - h;
      else if (a.after) {
        const ref = firstExisting(a.after);
        if (!ref) { notes.push(`${item.name}: bağlı katman yok, atlandı`); continue; }
        const gapPx = Math.round((pick(a.gap, format) || 0) * (item.group === 'Copy' || item.group === 'CTA' ? scale : 1));
        if (!emitted.get(ref).image) { args.afterLayer = ref; args.gap = gapPx; }
        top = emitted.get(ref).bottom + gapPx;
      } else top = a.top ?? 0;
      if (args.afterLayer === undefined) args.y = Math.round(top);
      ops.push({ op: 'shape.rect', args });
      emitted.set(item.name, { left: x, top, right: x + w, bottom: top + h });
      addGroup(item);
      continue;
    }

    if (item.type === 'text' && item.name === 'Brand_Logo' && brand.logos && (brand.logos.onDark || brand.logos.onLight)) {
      const bgOfLogo = (item.color === 'onAccentRaw') ? T.accentRaw : (item.color === 'onAccent') ? T.accentOnBg : T.bg;
      const dark = luminance(bgOfLogo) < 0.4;
      const logo = (dark ? brand.logos.onDark : brand.logos.onLight) || brand.logos.onDark || brand.logos.onLight;
      if (logo && logo.size && logo.size.w > 0 && logo.size.h > 0) {
        const targetH = Math.round(66 * (pick(item.logoScale, format) ?? 1));
        const maxW = Math.round(M.contentW * 0.4);
        let h = targetH, w = Math.round(h * logo.size.w / logo.size.h);
        if (w > maxW) { w = maxW; h = Math.round(w * logo.size.h / logo.size.w); }
        const align = item.align || 'left';
        const x = align === 'center' ? Math.round((M.w - w) / 2) : M.mx;
        const top = Math.round(pick(item.anchor?.topFrac, format) * M.h);
        ops.push({ op: 'layer.image', optional: true, args: { name: item.name, path: logo.path, x, y: top, w, h } });
        emitted.set(item.name, { left: x, top, right: x + w, bottom: top + h, image: true });
        addGroup(item);
        continue;
      }
    }

    if (item.type === 'text') {
      const raw = bindValue(item.bind, { brand, copy });
      if (!raw) continue;
      const text = item.upper ? raw.toLocaleUpperCase('tr-TR') : raw;
      const sc = (item.group === 'Copy' || item.group === 'CTA') ? scale : 1;
      const size = Math.round(pick(item.size, format) * sc);
      const maxW = Math.round(M.contentW * (pick(item.maxWidth, format) ?? 1) * (format === 'linkedin' ? 0.58 : 1));
      const f = charFactor({ caps: item.upper, bold: item.bold, tracking: item.tracking });
      const lines = wrapText(text, size, maxW, f);
      const box = textBox(item, size, lines);
      const align = item.align || 'left';
      const inset = item.inset || 0;
      const x = align === 'right' ? M.w - M.mx : align === 'center' ? Math.round(M.w / 2) : M.mx + inset;
      const a = item.anchor || {};
      const args = {
        name: item.name, contents: lines.join('\n').slice(0, 600), x, size, color: col(item.color),
        ...((isHeadingItem(item.name) ? fonts.heading : fonts.body) ? { font: isHeadingItem(item.name) ? fonts.heading : fonts.body } : {}), ...(item.bold ? { weight: 'bold' } : {}),
        ...(item.tracking ? { tracking: item.tracking } : {}), ...(item.leadingMul ? { leading: box.lead } : {}),
        ...(align !== 'left' ? { align } : {})
      };
      let top;
      if (a.topFrac) top = Math.round(pick(a.topFrac, format) * M.h);
      else if (a.sameTopAs) {
        const ref = emitted.get(a.sameTopAs);
        if (!ref) continue;
        top = ref.top;
        if (item.dropIfOverlaps) {
          const left = x - box.width;
          if (left < ref.right + 60) { notes.push(`${item.name}: sığmadığı için çıkarıldı`); continue; }
        }
      } else if (a.after) {
        const ref = firstExisting(a.after);
        if (!ref) { notes.push(`${item.name}: bağlı katman yok`); top = M.safeTop; }
        else {
          const gapPx = Math.round((pick(a.gap, format) || 0) * sc);
          if (!emitted.get(ref).image) { args.afterLayer = ref; args.gap = gapPx; }
          top = emitted.get(ref).bottom + gapPx;
        }
      } else if (a.afterBlock) {
        const ref = emitted.get(a.afterBlock);
        top = (ref ? ref.bottom : M.safeTop) + (a.gap || 0);
        if (ref) { args.afterLayer = a.afterBlock; args.gap = a.gap || 0; }
      } else if (a.bottom) top = M.safeBottomY - (a.offset || 0) - box.height;
      else top = M.safeTop;
      if (args.afterLayer === undefined) args.y = Math.round(top);
      ops.push({ op: 'layer.text', ...(item.optional ? { optional: true } : {}), args });
      const left = align === 'right' ? x - box.width : align === 'center' ? x - box.width / 2 : x;
      emitted.set(item.name, { left, top, right: left + box.width, bottom: top + box.height, text: true });
      addGroup(item);
      continue;
    }

    if (item.type === 'behindText') {
      const t = emitted.get(item.of);
      if (!t) continue; // metin yoksa etiketi/butonu da çizme
      const h = t.bottom - t.top + item.padY * 2;
      const radius = item.radius === 'full' ? Math.round(h / 2) : item.radius;
      ops.push({ op: 'shape.behindText', args: {
        name: item.name, textLayer: item.of, padX: item.padX, padY: item.padY, radius, color: col(item.color),
        ...(item.minW ? { minW: item.minW } : {}), ...(item.opacity !== undefined ? { opacity: item.opacity } : {}),
        ...(item.stroke ? { stroke: { color: col(item.stroke.color), width: item.stroke.width } } : {})
      } });
      const w = Math.max(t.right - t.left + item.padX * 2, item.minW || 0);
      const cx = (t.left + t.right) / 2;
      emitted.set(item.name, { left: cx - w / 2, top: t.top - item.padY, right: cx + w / 2, bottom: t.bottom + item.padY });
      addGroup(item);
    }
  }

  for (const [name, layers] of groups) ops.push({ op: 'group.create', args: { name, layers, skipMissing: true } });
  ops.push({ op: 'doc.save', args: { psdPath, pngPath } });
  ops.notes = notes;
  ops.estimated = Object.fromEntries(emitted);
  const flowNames = [...groups.entries()].filter(([g]) => g === 'Copy' || g === 'CTA').flatMap(([, l]) => l);
  const flowBottom = Math.max(0, ...flowNames.map(n => emitted.get(n)?.bottom ?? 0));
  const url = emitted.get('URL_Text');
  const limit = (url ? url.top - 24 : M.safeBottomY);
  const [sxm] = SAFE[format] || SAFE.default;
  const sideOk = [...emitted.values()].filter(b => b.text).every(b => b.left >= M.w * sxm - 2 && b.right <= M.w * (1 - sxm) + 2);
  const withinOk = recipe.items.every(it => !it.within || !emitted.has(it.name) || !emitted.has(it.within) || emitted.get(it.name).bottom <= emitted.get(it.within).bottom - 40);
  ops.fits = flowBottom <= limit && sideOk && withinOk;
  return ops;
}

export function buildOps({ brand, copy, format = 'post', recipeId, psdPath, pngPath, heroImagePath }) {
  const recipe = chooseRecipe(brand, recipeId);
  const ops = compileRecipe(recipe, { brand, copy, format, psdPath, pngPath, heroImagePath });
  ops.recipe = { id: recipe.id, name: recipe.name };
  return ops;
}
