import test from 'node:test';
import assert from 'node:assert/strict';
import { lintSnapshot } from '../services/ps/lint.mjs';
import { wrapText, contrastRatio } from '../services/ps/layout.mjs';
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

test('wrapText ve kontrast', () => {
  assert.deepEqual(wrapText('a b c', 10, 1000), ['a b c']);
  assert.ok(wrapText('uzun uzun uzun uzun uzun uzun', 74, 500).length > 1);
  assert.ok(contrastRatio('#000000', '#FFFFFF') > 20);
});
