import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.AJANSOS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ajans-qa-'));
const { evaluateDesign, lintCopy, parseVisionResult } = await import('../services/visionQa.mjs');
const brand = { name: 'Test', sector: 'Kahve' };

test('görsel yokken skor uydurulmaz, geçti denmez', async () => {
  const r = await evaluateDesign({ brand, copy: { title: 'Merhaba', desc: 'kısa', cta: 'Tıkla' } });
  assert.equal(r.total, null);
  assert.equal(r.passed, null);
  assert.equal(r.mode, 'copy_lint');
});

test('boş başlık kritik hata: passed=false', async () => {
  const r = await evaluateDesign({ brand, copy: { title: '', desc: '', cta: '' } });
  assert.equal(r.passed, false);
});

test('çok uzun başlık metin kuralında yakalanır', () => {
  const checks = lintCopy({ title: 'x'.repeat(200), desc: 'a', cta: 'b' });
  assert.equal(checks.find(c => c.id === 'title_len').ok, false);
});

test('anahtar yokken PNG verilse de skor yok', async () => {
  const r = await evaluateDesign({ brand, pngPath: '/tmp/x.png', copy: { title: 'a' } });
  assert.equal(r.mode, 'no_vision_key');
  assert.equal(r.total, null);
});

test('parseVisionResult toplamı kodda hesaplar ve aralığı kısıtlar', () => {
  const r = parseVisionResult({ typography: 200, contrast: 50, grid: -10, brandFit: 60, total: 99 });
  assert.equal(r.typography, 100);
  assert.equal(r.grid, 0);
  assert.equal(r.total, 53); // (100+50+0+60)/4 = 52.5 → 53, modelin "total: 99" değeri yok sayılır
  assert.equal(parseVisionResult('{bozuk'), null);
  assert.equal(parseVisionResult({ typography: 'x' }), null);
});
