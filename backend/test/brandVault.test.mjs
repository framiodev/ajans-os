import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as v from '../services/brandVault.mjs';
import { makeTestPng } from '../services/ps/selftest.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'));

test('klasör yapısı oluşur; kit doğrulanır ve diske yazılır', () => {
  const root = tmp(); const dir = v.vaultDir(root, 'baskent-turizm');
  v.ensureVault(dir);
  for (const f of Object.keys(v.FOLDERS)) assert.ok(fs.statSync(path.join(dir, f)).isDirectory());
  const kit = v.writeKit(dir, { colors: { primary: '#0b2545', accent: 'kırmızı', secondary: '#E63946' }, fontHeading: 'Montserrat', fontBody: '../etc', forbidden: ['ucuz', ' '], tone: 'Güvenilir' });
  assert.equal(kit.colors.primary, '#0B2545');
  assert.equal(kit.colors.accent, undefined);
  assert.equal(kit.fontBody, '');
  assert.deepEqual(kit.forbidden, ['ucuz']);
  assert.deepEqual(v.readKit(dir), kit);
});

test('yükleme: tür ve boyut denetimi, güvenli ad; yol kaçışı engellenir', () => {
  const dir = v.ensureVault(path.join(tmp(), 'b'));
  const ok = v.saveAsset(dir, 'photos', '../../kotu/foto 1.jpg', Buffer.from([1, 2, 3]));
  assert.ok(ok.fullPath.startsWith(path.join(dir, 'photos')));
  assert.equal(path.basename(ok.fullPath), 'foto 1.jpg');
  assert.throws(() => v.saveAsset(dir, 'photos', 'x.exe', Buffer.from([1])));
  assert.throws(() => v.saveAsset(dir, 'logo', 'x.jpg', Buffer.from([1])), /desteklenmeyen/);
  assert.throws(() => v.saveAsset(dir, 'nope', 'x.png', Buffer.from([1])));
  assert.throws(() => v.saveAsset(dir, 'photos', 'x.png', Buffer.alloc(v.MAX_ASSET_BYTES + 1)), /büyük/);
  assert.equal(v.scan(dir).photos.length, 1);
  v.removeAsset(dir, 'photos', 'foto 1.jpg');
  assert.equal(v.scan(dir).photos.length, 0);
  assert.throws(() => v.removeAsset(dir, 'photos', '../../x'));
});

test('logo çözümü: koyu zemin için açık (light/beyaz) logo, açık zemin için koyu logo; boyut okunur', () => {
  const dir = v.ensureVault(path.join(tmp(), 'b'));
  makeTestPng(path.join(dir, 'logo', 'baskent_beyaz.png'), 300, 100);
  makeTestPng(path.join(dir, 'logo', 'baskent_siyah.png'), 300, 100);
  const logos = v.resolveLogos(dir, v.readKit(dir));
  assert.match(logos.onDark.path, /beyaz/);
  assert.match(logos.onLight.path, /siyah/);
  assert.deepEqual(logos.onDark.size, { w: 300, h: 100 });
  const rep = v.vaultReport(dir, v.readKit(dir), { font_family: '', primary_color: '' });
  assert.ok(rep.warnings.some(w => /fotoğraf/i.test(w)));
  assert.ok(!rep.warnings.some(w => /^Logo yok/.test(w)));
});

test('geçersiz marka kimliği reddedilir', () => {
  assert.throws(() => v.vaultDir('/tmp', '../../'), /Geçersiz/);
});
