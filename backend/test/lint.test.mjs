import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSnapshot } from '../services/ps/lint.mjs';
import { buildPostOps, wrapText, contrastRatio } from '../services/ps/layout.mjs';
import { OPS } from '../services/ps/bridge.mjs';

const good = {
  doc: { width: 1080, height: 1350, resolution: 72 },
  layers: [
    { name: 'BG_Base', kind: 'solid', bounds: { left: 0, top: 0, right: 1080, bottom: 1350 } },
    { name: 'Copy', kind: 'group', children: [
      { name: 'Headline_H1', kind: 'text', bounds: { left: 100, top: 300, right: 900, bottom: 500 }, text: { font: 'Inter-Bold', size: 74, fontAvailable: true } }
    ] }
  ]
};

test('temiz snapshot geçer', () => {
  const r = lintSnapshot(good, { format: 'post' });
  assert.equal(r.ok, true, JSON.stringify(r.criticalFailed));
});

test('rasterize başlık, eksik font, güvenli alan dışı ve yanlış ölçü kritik hata', () => {
  const bad = JSON.parse(JSON.stringify(good));
  bad.doc.width = 1000;
  bad.layers.push({ name: 'Headline_Alt', kind: 'pixel', bounds: { left: 0, top: 0, right: 10, bottom: 10 } });
  bad.layers[1].children[0].text.fontAvailable = false;
  bad.layers[1].children[0].bounds.left = 5;
  const r = lintSnapshot(bad, { format: 'post' });
  assert.deepEqual(r.criticalFailed.sort(), ['canvas_size', 'fonts', 'live_text', 'safe_area']);
});

test('varsayılan katman adları ve küçük punto uyarı üretir ama engellemez', () => {
  const s = JSON.parse(JSON.stringify(good));
  s.layers.push({ name: 'Layer 1', kind: 'pixel', bounds: { left: 0, top: 0, right: 5, bottom: 5 } });
  s.layers[1].children[0].text.size = 10;
  const r = lintSnapshot(s);
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings.sort(), ['min_size', 'named']);
});

test('buildPostOps: tüm işlemler şemadan geçer, 3 sabit brief güvenli alanda kalır', () => {
  const brand = { name: 'Vega Emlak', primary_color: '#0F172A', accent_color: '#38BDF8', font_family: 'Inter' };
  const briefs = [
    { eyebrow: 'Yeni', title: 'Hayalinizdeki eve bir adım daha yakın olun bugün', desc: 'Uzman ekibimizle bölgenin en doğru fırsatlarını birlikte değerlendiriyoruz.', cta: 'Randevu Al' },
    { title: 'Kısa başlık', cta: 'Ara' },
    { eyebrow: 'Fırsat', title: 'Sınırlı süreli kampanya', desc: 'Detaylar için hemen iletişime geçin.', cta: 'Detaylı Bilgi' }
  ];
  for (const format of ['post', 'story', 'square']) for (const copy of briefs) {
    const ops = buildPostOps({ brand, copy, format, psdPath: '/tmp/a.psd', pngPath: '/tmp/a.png' });
    for (const o of ops) assert.ok(OPS[o.op](o.args), `${format} ${o.op} ${JSON.stringify(o.args).slice(0, 80)}`);
    const texts = ops.filter(o => o.op === 'layer.text');
    const h = format === 'story' ? 1920 : format === 'square' ? 1080 : 1350;
    for (const t of texts) assert.ok(t.args.y < h * 0.95, `${format} ${t.args.name} y=${t.args.y}`);
  }
});

test('wrapText ve kontrast', () => {
  assert.deepEqual(wrapText('a b c', 10, 1000), ['a b c']);
  assert.ok(wrapText('uzun uzun uzun uzun uzun uzun', 74, 500).length > 1);
  assert.ok(contrastRatio('#000000', '#FFFFFF') > 20);
});

test('üretilen yerleşimin tahmini sınırları kendi güvenli alan denetimimizi geçer', () => {
  const brand = { name: 'Vega Emlak', primary_color: '#0F172A', accent_color: '#38BDF8', font_family: 'Inter' };
  const copy = { eyebrow: 'Yeni', title: 'Hayalinizdeki eve bir adım daha yakın olun bugün', desc: 'Uzman ekibimizle bölgenin en doğru fırsatlarını birlikte değerlendiriyoruz.', cta: 'Randevu Al' };
  const DIM = { post: [1080, 1350], story: [1080, 1920], square: [1080, 1080] };
  for (const format of Object.keys(DIM)) {
    const ops = buildPostOps({ brand, copy, format, psdPath: '/tmp/a.psd' });
    const layers = ops.filter(o => o.op === 'layer.text').map(o => {
      const a = o.args, lines = a.contents.split('\n');
      return { name: a.name, kind: 'text', text: { size: a.size, font: a.font, fontAvailable: true },
        bounds: { left: a.x, right: a.x + Math.max(...lines.map(l => l.length)) * a.size * 0.56, top: a.y - a.size, bottom: a.y + (lines.length - 1) * a.size * 1.2 + a.size * 0.3 } };
    });
    const r = lintSnapshot({ doc: { width: DIM[format][0], height: DIM[format][1], resolution: 72 }, layers }, { format });
    assert.ok(!r.criticalFailed.includes('safe_area'), `${format}: ${JSON.stringify(r.checks.find(c => c.id === 'safe_area'))}`);
  }
});
