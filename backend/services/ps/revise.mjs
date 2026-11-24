import { flatten } from './lint.mjs';

const CANDIDATES = {
  logo: ['Brand_Logo', 'Logo_SmartObject'],
  cta: ['CTA_Text', 'CTA_Button_Text', 'CTA_Buton_Grubu'],
  eyebrow: ['Eyebrow_Text'],
  body: ['Subcopy_Body', 'Alt_Aciklama'],
  headline: ['Headline_H1', 'Ana_Baslik_H1']
};

export function parseRevision(instruction) {
  const t = String(instruction || '').toLowerCase().replace(/İ/g, 'i');
  const kind = /logo/.test(t) ? 'logo' : /cta|buton|düğme|dugme/.test(t) ? 'cta'
    : /üst etiket|ust etiket|eyebrow|rozet/.test(t) ? 'eyebrow'
    : /açıklama|aciklama|alt metin|gövde|govde/.test(t) ? 'body' : 'headline';
  const shrink = /küçült|kucult|azalt|düşür|dusur/.test(t);
  const grow = /büyüt|buyut|artır|artir/.test(t);
  const m = t.match(/(\d{1,3})\s*(px|punto|pt)?/);
  const amount = m ? Math.min(200, Number(m[1])) : 10;
  return { kind, delta: shrink ? -amount : grow ? amount : null };
}

export function pickLayer(snapshot, kind) {
  const leaves = flatten(snapshot?.layers).filter(l => l.kind === 'text');
  for (const name of CANDIDATES[kind] || []) {
    const hit = leaves.filter(l => l.name === name);
    if (hit.length === 1) return hit[0];
  }
  return null;
}
