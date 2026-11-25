// Sandbox/yerel önizleme: tarif işlemlerini SVG'ye çizer (Photoshop'un yaklaşık hali; yerleşim kontrolü içindir).
// Kullanım: node tools/preview-recipes.mjs [çıktıKlasörü]
import fs from 'node:fs';
import path from 'node:path';
import { SEED_RECIPES, compileRecipe, textBox } from '../backend/services/ps/recipes.mjs';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
export function opsToSvg(ops, family = 'Inter') {
  const dc = ops[0].args;
  const est = ops.estimated || {};
  let body = '', top = '';
  for (const o of ops) {
    const a = o.args;
    if (o.op === 'layer.solid') body += `<rect width="${dc.width}" height="${dc.height}" fill="${a.color}"/>`;
    else if (o.op === 'shape.rect') { const b = est[a.name]; body += `<rect x="${a.x}" y="${b.top}" width="${a.w}" height="${a.h}" fill="${a.color}" opacity="${(a.opacity ?? 100) / 100}"/>`; }
    else if (o.op === 'shape.ellipse') body += `<ellipse cx="${a.x + a.w / 2}" cy="${a.y + a.h / 2}" rx="${a.w / 2}" ry="${a.h / 2}" fill="${a.color}" opacity="${(a.opacity ?? 100) / 100}"/>`;
    else if (o.op === 'shape.arrow') { const t = a.thickness; body += `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${t}" rx="${t / 2}" fill="${a.color}"/>`; }
    else if (o.op === 'shape.behindText') {
      const b = est[a.name]; if (!b) continue;
      body += `<rect x="${b.left}" y="${b.top}" width="${b.right - b.left}" height="${b.bottom - b.top}" rx="${a.radius || 0}" fill="${a.color}" opacity="${(a.opacity ?? 100) / 100}" ${a.stroke ? `stroke="${a.stroke.color}" stroke-width="${a.stroke.width}"` : ''}/>`;
    } else if (o.op === 'layer.text') {
      const b = est[a.name]; if (!b) continue;
      const lines = a.contents.split('\n');
      const lead = a.leading || Math.round(a.size * 1.2);
      const anchor = a.align === 'center' ? 'middle' : a.align === 'right' ? 'end' : 'start';
      const tspans = lines.map((l, i) => `<tspan x="${a.x}" y="${b.top + a.size * 0.82 + i * lead}">${esc(l)}</tspan>`).join('');
      top += `<text font-family="${family}" font-size="${a.size}" font-weight="${a.weight === 'bold' ? 800 : 400}" letter-spacing="${(a.tracking || 0) / 1000 * a.size}" fill="${a.color}" text-anchor="${anchor}">${tspans}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dc.width}" height="${dc.height}" viewBox="0 0 ${dc.width} ${dc.height}">${body}${top}</svg>`;
}

if (process.argv[1] && process.argv[1].endsWith('preview-recipes.mjs')) {
  const out = process.argv[2] || '/tmp/preview';
  fs.mkdirSync(out, { recursive: true });
  const brands = [
    { id: 'vega', name: 'Vega Gayrimenkul', sector: 'Gayrimenkul', primary_color: '#0F172A', accent_color: '#D4A72C', font_family: 'Inter', website: 'https://vegagayrimenkul.com' },
    { id: 'baskent', name: 'Başkent Turizm', sector: 'Seyahat', primary_color: '#0B2545', accent_color: '#E63946', font_family: 'Inter', website: 'https://baskentturizm.example' }
  ];
  const copies = {
    vega: { eyebrow: 'Kariyer Fırsatı', title: 'Gayrimenkulde Kendi Başarını Yönet.', desc: 'Güçlü marka desteği, profesyonel eğitim ve yüksek kazanç modeliyle danışman ekibimize katıl.', cta: 'Hemen Başvur' },
    baskent: { eyebrow: 'Yeni Sefer', title: 'Ankara İstanbul', desc: 'Ankara, Bolu, Sakarya, İstanbul. Her gün konforlu yolculuk.', cta: 'Bilet Al', meta: 'Her gün 12 sefer', price: '399 TL' }
  };
  const formats = process.argv[3] ? process.argv[3].split(',') : ['post', 'story'];
  for (const b of brands) for (const r of SEED_RECIPES) for (const f of formats) {
    const ops = compileRecipe(r, { brand: b, copy: copies[b.id], format: f, psdPath: 'x', pngPath: 'y' });
    const svg = path.join(out, `${b.id}_${r.id}_${f}.svg`);
    fs.writeFileSync(svg, opsToSvg(ops));
    console.log(`${b.id} ${r.id} ${f} scale=${ops.scale} fits=${ops.fits}${ops.notes.length ? ' notes=' + ops.notes.join(';') : ''}`);
  }
}
