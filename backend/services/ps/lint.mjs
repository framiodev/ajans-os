// PSD hijyen denetimi v1: Photoshop'tan okunan katman ağacı (snapshot) üzerinde kuralla çalışır.
export const FORMAT_DIMS = {
  post: { w: 1080, h: 1350 }, carousel: { w: 1080, h: 1350 }, square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 }, reel: { w: 1080, h: 1920 }, linkedin: { w: 1920, h: 1080 }
};

// Güvenli alan (kanvas oranı): [sol/sağ, üst, alt]
export const SAFE = { story: [0.06, 0.14, 0.20], reel: [0.06, 0.14, 0.20], default: [0.06, 0.05, 0.05] };
const DEFAULT_NAME = /^(layer|katman|group|grup|rectangle|dikdörtgen|ellipse|elips|text|metin|shape|şekil)\s*\d*(\s*copy.*|\s*kopya.*)?$/i;
const TEXTY = /(headline|baslik|başlık|subcopy|body|aciklama|açıklama|eyebrow|cta|copy|metin|text)/i;

export function flatten(layers, out = [], depth = 0) {
  for (const l of layers || []) {
    out.push({ ...l, depth });
    if (l.children) flatten(l.children, out, depth + 1);
  }
  return out;
}

export function lintSnapshot(snapshot, { format = 'post' } = {}) {
  const checks = [];
  const add = (id, label, ok, critical, detail = '') => checks.push({ id, label, ok, critical, detail });
  const doc = snapshot?.doc || {};
  const all = flatten(snapshot?.layers);
  const leaves = all.filter(l => l.kind !== 'group');
  const texts = leaves.filter(l => l.kind === 'text');
  const dims = FORMAT_DIMS[format] || FORMAT_DIMS.post;

  add('canvas_size', 'Kanvas ölçüsü formata uygun', doc.width === dims.w && doc.height === dims.h, true, `${doc.width}×${doc.height} (beklenen ${dims.w}×${dims.h})`);
  add('resolution', 'Çözünürlük 72 ppi', Number(doc.resolution) === 72, false, `${doc.resolution} ppi`);

  const rasterText = leaves.filter(l => (l.kind === 'pixel' || l.kind === 'smartObject') && TEXTY.test(l.name));
  add('live_text', 'Metin katmanları canlı (rasterize değil)', rasterText.length === 0, true, rasterText.map(l => l.name).join(', '));
  add('has_text', 'En az bir metin katmanı var', texts.length > 0, true);

  const defaults = all.filter(l => !l.name || DEFAULT_NAME.test(l.name.trim()));
  add('named', 'Tüm katmanlar adlandırılmış', defaults.length === 0, false, defaults.map(l => l.name || '(boş)').join(', '));

  add('grouped', 'Katmanlar gruplanmış (6+ katmanda)', leaves.length < 6 || all.some(l => l.kind === 'group'), false, `${leaves.length} katman`);

  const missingFont = texts.filter(l => l.text && l.text.fontAvailable === false);
  add('fonts', 'Yazı tipleri yüklü', missingFont.length === 0, true, missingFont.map(l => `${l.name}: ${l.text.font}`).join(', '));

  const [sx, top, bottom] = SAFE[format] || SAFE.default;
  const outside = texts.filter(l => {
    const b = l.bounds;
    if (!b) return false;
    return b.left < dims.w * sx || b.right > dims.w * (1 - sx) || b.top < dims.h * top || b.bottom > dims.h * (1 - bottom);
  });
  add('safe_area', 'Metinler güvenli alanda', outside.length === 0, true, outside.map(l => l.name).join(', '));

  const minSize = 22 * (dims.w / 1080);
  const small = texts.filter(l => l.text && Number(l.text.size) < minSize);
  add('min_size', `Metin punto ≥ ${Math.round(minSize)}`, small.length === 0, false, small.map(l => `${l.name}: ${l.text.size}`).join(', '));

  const invisible = leaves.filter(l => l.visible === false);
  const empty = leaves.filter(l => l.bounds && (l.bounds.right <= l.bounds.left || l.bounds.bottom <= l.bounds.top) && l.kind !== 'text');
  add('no_junk', 'Gizli veya boş katman yok', invisible.length === 0 && empty.length === 0, false, [...invisible, ...empty].map(l => l.name).join(', '));

  const failedCritical = checks.filter(c => c.critical && !c.ok);
  return {
    ok: failedCritical.length === 0,
    criticalFailed: failedCritical.map(c => c.id),
    warnings: checks.filter(c => !c.critical && !c.ok).map(c => c.id),
    checks,
    notChecked: ['contrast (render gerekir)', 'turkish_glyphs', 'photos_smart_object (R2)']
  };
}
