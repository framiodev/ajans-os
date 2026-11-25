import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.AJANSOS_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ajans-prov-'));
const { extractJson, validateStrategy, generateStrategyAndCalendar } = await import('../services/aiProvider.mjs');

test('extractJson: metin içindeki ilk dengeli nesneyi alır, süslü parantezli stringleri bozmaz', () => {
  assert.deepEqual(extractJson('Tabii: {"a": "x}y", "b": {"c": 1}} bitti {"z":2}'), { a: 'x}y', b: { c: 1 } });
  assert.equal(extractJson('json yok'), null);
  assert.equal(extractJson('{kesik'), null);
});

test('validateStrategy geçersiz öğeleri eler ve sınırlar', () => {
  const r = validateStrategy({ summary: 's', items: [
    { day: 1, title: 'A', format: 'Bilinmeyen' },
    { day: 99, title: 'B' },
    { day: 5, title: '' },
    null,
    { day: 7, title: 'C'.repeat(500) }
  ] });
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].format, 'Post 4:5');
  assert.equal(r.items[1].title.length, 120);
  assert.equal(validateStrategy({ items: [] }), null);
  assert.equal(validateStrategy({}), null);
});

test('anahtar yokken çevrimdışı şablon sebebini söyler', async () => {
  const r = await generateStrategyAndCalendar({ brand: { id: 'x', name: 'N', sector: 'S', tone: 'T' }, brief: '' });
  assert.equal(r.mode, 'offline');
  assert.match(r.summary, /Çevrimdışı şablon/);
});
