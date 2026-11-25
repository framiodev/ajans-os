import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selfTestOps, makeTestPng } from '../services/ps/selftest.mjs';
import { OPS } from '../services/ps/bridge.mjs';

test('yetenek testi: tüm işlemler şemadan geçer, test görseli geçerli PNG', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-'));
  const ops = selfTestOps({ dir });
  for (const o of ops) assert.ok(OPS[o.op] && OPS[o.op](o.args), `${o.op} ${o.args.name || ''}`);
  const png = fs.readFileSync(path.join(dir, 'yetenek_testi_gorsel.png'));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.readUInt32BE(16), 640);
  assert.equal(png.readUInt32BE(20), 480);
});

test('yeni işlem şemaları: gradient, ok, gölge, maske', () => {
  assert.ok(OPS['shape.gradient']({ name: 'g', color: '#112233', angle: 90, opacityStart: 0, opacityEnd: 80 }));
  assert.ok(!OPS['shape.gradient']({ name: 'g', color: 'kırmızı' }));
  assert.ok(OPS['shape.arrow']({ name: 'o', x: 0, y: 0, w: 100, color: '#FFFFFF' }));
  assert.ok(!OPS['shape.arrow']({ name: 'o', x: 0, y: 0, w: 2, color: '#FFFFFF' }));
  assert.ok(OPS['layer.shadow']({ name: 'x', opacity: 40 }));
  assert.ok(!OPS['layer.shadow']({ name: 'x', blur: 9999 }));
  assert.ok(OPS['mask.subject']({ name: 'x' }));
});
