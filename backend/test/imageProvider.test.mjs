import test from 'node:test';
import assert from 'node:assert/strict';
import { searchVaultPhotos, planImageSearch, mayGenerate, providerStatus } from '../services/imageProvider.mjs';

const assets = [{ name: 'ankara-kale.jpg', fullPath: '/x/ankara-kale.jpg' }, { name: 'otobus-yan.png', fullPath: '/x/otobus-yan.png' }];

test('marka klasöründe ad eşleşmesi', () => {
  const r = searchVaultPhotos(assets, 'Ankara kalesi');
  assert.equal(r[0].name, 'ankara-kale.jpg');
  assert.equal(r[0].license, 'marka-sahibi');
});
test('bulunamazsa stok ve üretim adımları planlanır', () => {
  const p = planImageSearch({ query: 'deniz kıyısı', vaultPhotos: assets, env: { PEXELS_API_KEY: 'k' } });
  assert.equal(p.chosen, null);
  assert.ok(p.steps.find(s => s.step === 'stock').providers.includes('pexels'));
});
test('gerçek mekân için üretim kapalı', () => {
  assert.equal(mayGenerate('Anıtkabir fotoğrafı'.replace('Anıtkabir', 'Ankara')), false);
  assert.equal(mayGenerate('soyut mavi arka plan'), true);
});
test('anahtarsız sağlayıcılar kullanılamaz', () => {
  const s = providerStatus({});
  assert.equal(s.unsplash.available, false);
  assert.equal(s.wikimedia.available, true);
  assert.equal(s.generate.available, false);
});
