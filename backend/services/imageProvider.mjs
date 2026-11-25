// Görsel sağlayıcı iskeleti: marka klasörü -> stok (resmi API) -> yapay zekâ üretimi.
// Bu sürümde ağ çağrısı YOK; sağlayıcılar anahtar tanımlanana kadar "kullanılamaz" döner.
import fs from 'node:fs';
import path from 'node:path';

const norm = s => String(s || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[̀-ͯ]/g, '');
const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(t => t.length > 2);

// Marka klasöründeki fotoğrafları dosya adındaki sözcüklerle eşleştirir.
export function searchVaultPhotos(assets, query, limit = 5) {
  const q = tokens(query);
  if (!q.length) return [];
  return (assets || [])
    .map(a => {
      const n = tokens(a.name);
      const score = q.filter(t => n.some(x => x.includes(t) || t.includes(x))).length;
      return { source: 'vault', path: a.fullPath, name: a.name, score, license: 'marka-sahibi', ai: false };
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export const STOCK_PROVIDERS = {
  unsplash: { env: 'UNSPLASH_ACCESS_KEY', license: 'Unsplash License' },
  pexels: { env: 'PEXELS_API_KEY', license: 'Pexels License' },
  pixabay: { env: 'PIXABAY_API_KEY', license: 'Pixabay Content License' },
  wikimedia: { env: null, license: 'CC (dosyaya göre)' },
  'adobe-stock': { env: 'ADOBE_STOCK_API_KEY', license: 'Adobe Stock lisansı (ücretli)' }
};

export function providerStatus(env = process.env) {
  const out = {};
  for (const [id, p] of Object.entries(STOCK_PROVIDERS)) out[id] = { available: !p.env || !!env[p.env], license: p.license };
  out.generate = { available: !!env.IMAGE_GEN_API_KEY, license: 'Yapay zekâ üretimi — "AI ile üretildi" etiketi zorunlu' };
  return out;
}

// Gerçek mekân/kişi görselleri üretimle yapılmaz; üretim yalnızca atmosfer/arka plan içindir.
export function mayGenerate(query) {
  return !/(\b(ankara|istanbul|izmir|mersin|anitkabir|kule|cami|köprü|stadyum)\b|portre|yüz|ünlü)/i.test(String(query || '').toLocaleLowerCase('tr'));
}

export function planImageSearch({ query, vaultPhotos = [], env = process.env }) {
  const steps = [];
  const local = searchVaultPhotos(vaultPhotos, query);
  steps.push({ step: 'vault', results: local });
  if (local.length) return { chosen: local[0], steps };
  const st = providerStatus(env);
  const stock = Object.entries(st).filter(([id, v]) => id !== 'generate' && v.available).map(([id]) => id);
  steps.push({ step: 'stock', providers: stock, note: 'Arama bu sürümde çalıştırılmıyor; API bağlantısı en son aşamada.' });
  steps.push({ step: 'generate', allowed: mayGenerate(query) && st.generate.available, note: mayGenerate(query) ? undefined : 'Gerçek mekân/kişi için üretim kapalı' });
  return { chosen: null, steps };
}

// Lisans kaydı: görselin yanına .license.json yazar.
export function writeLicenseRecord(imagePath, rec) {
  const p = imagePath + '.license.json';
  fs.writeFileSync(p, JSON.stringify({ file: path.basename(imagePath), at: new Date().toISOString(), ...rec }, null, 2));
  return p;
}
