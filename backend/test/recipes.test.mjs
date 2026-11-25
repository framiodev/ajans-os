import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_RECIPES, compileRecipe, buildOps, chooseRecipe, colorTokens, contrastRatio, sanitize, metrics, listRecipes } from '../services/ps/recipes.mjs';
import { OPS } from '../services/ps/bridge.mjs';
import { SAFE, FORMAT_DIMS } from '../services/ps/lint.mjs';

const brand = { id: 'vega', name: 'Vega Gayrimenkul', sector: 'Gayrimenkul', primary_color: '#0F172A', accent_color: '#D4A72C', font_family: 'Inter', website: 'https://vegagayrimenkul.com/' };
const FORMATS = ['post', 'story', 'square', 'linkedin'];
const BRIEFS = [
  { eyebrow: 'Kariyer Fırsatı', title: 'Gayrimenkulde Kendi Başarını Yönet.', desc: 'Güçlü marka desteği, profesyonel eğitim ve yüksek kazanç modeliyle danışman ekibimize katıl.', cta: 'Hemen Başvur →' },
  { title: 'Kısa başlık', cta: 'Ara' },
  { eyebrow: 'Fırsat', title: 'Hayalinizdeki eve bir adım daha yakın olun bugün', desc: 'Uzman ekibimizle bölgenin en doğru fırsatlarını birlikte değerlendiriyoruz.', cta: 'Randevu Al' },
  { title: 'Yalnızca başlık ve açıklama olan bir tasarım denemesi', desc: 'Buton ve üst başlık yok.' }
];
const compile = (r, copy, format, extra = {}) => compileRecipe(r, { brand, copy, format, psdPath: '/tmp/a.psd', pngPath: '/tmp/a.png', ...extra });

test('her tarif × format × brief: tüm işlemler şemadan geçer', () => {
  for (const r of SEED_RECIPES) for (const f of FORMATS) for (const copy of BRIEFS) {
    const ops = compile(r, copy, f);
    for (const o of ops) assert.ok(OPS[o.op](o.args), `${r.id} ${f} ${o.op} ${o.args.name}`);
    assert.equal(ops[0].op, 'doc.create');
    assert.equal(ops.at(-1).op, 'doc.save');
  }
});

test('kanonik katman adları korunur (revizyon ve denetim bunlara bağlı)', () => {
  for (const r of SEED_RECIPES) {
    const names = compile(r, BRIEFS[0], 'post').map(o => o.args.name);
    for (const n of ['BG_Base', 'Brand_Logo', 'Eyebrow_Text', 'Headline_H1', 'Subcopy_Body', 'CTA_Text', 'CTA_Button']) assert.ok(names.includes(n), `${r.id}: ${n}`);
  }
});

test('olmayan alan için ilgili katman ve süsü çizilmez; gruplar yalnızca var olanı içerir', () => {
  const r = SEED_RECIPES[0];
  const ops = compile(r, BRIEFS[3], 'post');
  const names = ops.map(o => o.args.name);
  assert.ok(!names.includes('CTA_Text') && !names.includes('CTA_Button'));
  assert.ok(!names.includes('Eyebrow_Tag') && !names.includes('Eyebrow_Text'));
  const created = new Set(names);
  for (const g of ops.filter(o => o.op === 'group.create')) {
    assert.ok(g.args.skipMissing);
    for (const l of g.args.layers) assert.ok(created.has(l), `${g.args.name} -> ${l}`);
  }
  assert.ok(!ops.some(o => o.op === 'group.create' && o.args.layers.includes('BG_Base')));
});

test('ok/emoji karakterleri temizlenir', () => {
  assert.equal(sanitize('Hemen Başvur →'), 'Hemen Başvur');
  assert.equal(sanitize('İndirim 🔥 başladı'), 'İndirim başladı');
  assert.equal(sanitize('  a   b  '), 'a b');
  const ops = compile(SEED_RECIPES[0], BRIEFS[0], 'post');
  assert.ok(!/→/.test(ops.find(o => o.args.name === 'CTA_Text').args.contents));
});

test('Türkçe büyük harf: i → İ', () => {
  const ops = compile(SEED_RECIPES[0], { title: 'x', eyebrow: 'single origin etiyopya' }, 'post');
  assert.match(ops.find(o => o.args.name === 'Eyebrow_Text').args.contents, /ETİYOPYA/);
});

test('göreli yerleşim zinciri: başlık etiketin, buton gövdenin arkasından hizalanır', () => {
  const ops = compile(SEED_RECIPES[0], BRIEFS[0], 'post');
  const by = n => ops.find(o => o.args.name === n).args;
  assert.equal(by('Headline_H1').afterLayer, 'Eyebrow_Tag');
  assert.equal(by('Accent_Bar').afterLayer, 'Headline_H1');
  assert.equal(by('Subcopy_Body').afterLayer, 'Accent_Bar');
  assert.equal(by('CTA_Text').afterLayer, 'Subcopy_Body');
  const idx = n => ops.findIndex(o => o.args.name === n);
  assert.ok(idx('Eyebrow_Text') < idx('Eyebrow_Tag') && idx('Eyebrow_Tag') < idx('Headline_H1'));
  assert.equal(by('CTA_Button').textLayer, 'CTA_Text');
});

test('tahmini kutular kanvasın içinde, güvenli alanda ve metinler birbirine girmiyor', () => {
  for (const r of SEED_RECIPES) for (const f of FORMATS) for (const copy of BRIEFS.slice(0, 3)) {
    const ops = compile(r, copy, f);
    const { w, h } = FORMAT_DIMS[f];
    const [sx, , sb] = SAFE[f] || SAFE.default;
    const texts = ops.filter(o => o.op === 'layer.text').map(o => ({ n: o.args.name, b: ops.estimated[o.args.name] }));
    for (const { n, b } of texts) {
      const tag = `${r.id}/${f}/${n} ${JSON.stringify(b)}`;
      assert.ok(b.left >= w * sx - 2 && b.right <= w * (1 - sx) + 2, 'yatay güvenli alan ' + tag);
      assert.ok(b.bottom <= h * (1 - sb) + 2, 'alt güvenli alan ' + tag);
    }
    const flow = texts.filter(t => !['Brand_Logo', 'Meta_Text', 'URL_Text'].includes(t.n)).sort((a, b) => a.b.top - b.b.top);
    for (let i = 1; i < flow.length; i++) assert.ok(flow[i].b.top >= flow[i - 1].b.bottom - 1, `çakışma ${r.id}/${f}: ${flow[i - 1].n} ↔ ${flow[i].n}`);
    // gövde/buton alttaki URL ile çakışmamalı
    const url = ops.estimated.URL_Text, last = flow.at(-1);
    if (url && last) assert.ok(last.b.bottom <= url.top - 20 || ops.estimated.CTA_Button == null, `${r.id}/${f}: ${last.n} altbilgiye değiyor`);
    if (url && ops.estimated.CTA_Button) assert.ok(ops.estimated.CTA_Button.bottom <= url.top - 20, `${r.id}/${f}: buton altbilgiye değiyor`);
  }
});

test('hero görseli verilirse görsel + örtü eklenir, süs daireler çıkar; görsel isteğe bağlı', () => {
  const ops = compile(SEED_RECIPES[0], BRIEFS[0], 'post', { heroImagePath: 'C:/Users/x/hero.jpg' });
  const img = ops.find(o => o.op === 'layer.image');
  assert.ok(img && img.optional && OPS['layer.image'](img.args));
  assert.ok(ops.some(o => o.args.name === 'Visual_Overlay'));
  assert.ok(!ops.some(o => /Orb/.test(o.args.name)));
  const none = compile(SEED_RECIPES[0], BRIEFS[0], 'post');
  assert.ok(!none.some(o => o.op === 'layer.image') && none.some(o => /Orb/.test(o.args.name)));
});

test('renk belirteçleri: metin renkleri okunur kontrastta', () => {
  for (const [p, a] of [['#0F172A', '#D4A72C'], ['#FFFFFF', '#FACC15'], ['#1B3A2A', '#22C55E'], ['#808080', '#808080']]) {
    const T = colorTokens({ primary_color: p, accent_color: a });
    assert.ok(contrastRatio(T.bg, T.fg) >= 4.5, `fg ${p}`);
    assert.ok(contrastRatio(T.accentOnBg, T.onAccent) >= 4.5, `onAccent ${p}/${a}`);
    assert.ok(contrastRatio(T.accentRaw, T.onAccentRaw) >= 4.5, `onAccentRaw ${p}/${a}`);
    assert.ok(contrastRatio(T.bg, T.accentOnBg) >= 3 || T.accentOnBg === T.fg);
  }
});

test('bozuk marka renkleri varsayılana düşer', () => {
  const T = colorTokens({ primary_color: 'kırmızı', accent_color: undefined });
  assert.match(T.bg, /^#[0-9A-F]{6}$/);
});

test('tarif seçimi: aynı marka hep aynı ailede, açık seçim önceliklidir', () => {
  assert.equal(chooseRecipe(brand).id, chooseRecipe(brand).id);
  assert.equal(chooseRecipe(brand, 'color-block').id, 'color-block');
  assert.ok(listRecipes().every(r => r.id && r.name && r.description));
  const ops = buildOps({ brand, copy: BRIEFS[0], format: 'post', recipeId: 'bold-center', psdPath: '/tmp/a.psd' });
  assert.equal(ops.recipe.id, 'bold-center');
});

test('metrics: güvenli alan ve sütun genişliği', () => {
  const m = metrics('story');
  assert.equal(m.h, 1920);
  assert.ok(m.safeBottomY < 1920 && m.contentW < m.w);
});

test('yeni tarifler: şehir vurgu iki tonlu başlık, kampanya fiyatı yalnızca varsa çizilir, açık tarif açık zemin kullanır', () => {
  const ids = SEED_RECIPES.map(r => r.id);
  for (const id of ['sehir-vurgu', 'kampanya-fiyat', 'editoryal-acik']) assert.ok(ids.includes(id), id);
  const sehir = compile(SEED_RECIPES.find(r => r.id === 'sehir-vurgu'), { title: 'Ankara İstanbul', cta: 'Bilet Al' }, 'post');
  const names = sehir.map(o => o.args.name);
  assert.ok(names.includes('Headline_H1') && names.includes('Headline_H1b'));
  assert.match(sehir.find(o => o.args.name === 'Headline_H1').args.contents, /ANKARA|Ankara/i);
  const tek = compile(SEED_RECIPES.find(r => r.id === 'sehir-vurgu'), { title: 'Ankara' }, 'post');
  assert.ok(!tek.some(o => o.args.name === 'Headline_H1b'));
  const kampanya = SEED_RECIPES.find(r => r.id === 'kampanya-fiyat');
  assert.ok(compile(kampanya, { title: 'Ankara İstanbul', price: '399 TL' }, 'post').some(o => o.args.name === 'Price_Text'));
  assert.ok(!compile(kampanya, { title: 'Ankara İstanbul' }, 'post').some(o => o.args.name === 'Price_Text'));
  const acik = compile(SEED_RECIPES.find(r => r.id === 'editoryal-acik'), BRIEFS[0], 'post');
  assert.equal(acik[1].args.color, '#F5F2EC');
});

test('story formatında içerik büyütülür (alt yarı boş kalmasın) ve yine sığar', () => {
  for (const r of SEED_RECIPES) {
    const ops = compile(r, BRIEFS[2], 'story');
    assert.ok(ops.fits, r.id);
  }
});

test('otomatik seçim eski üç tarifle sınırlı kalır (marka sürekliliği bozulmaz)', () => {
  for (const id of ['vega', 'a', 'baskent', 'framio', 'x1']) {
    assert.ok(!chooseRecipe({ id }).manual);
  }
  assert.equal(chooseRecipe({ id: 'vega' }, 'sehir-vurgu').id, 'sehir-vurgu');
});

test('marka kiti: logo görseli Brand_Logo metninin yerine geçer, sonraki katmanlar mutlak yerleşir; fontlar başlık/gövde ayrılır', () => {
  const b = { ...brand, font_family: 'Montserrat / Inter', logos: { onDark: { path: '/tmp/logo_light.png', size: { w: 600, h: 200 } }, onLight: null } };
  const ops = compile(SEED_RECIPES[0], BRIEFS[0], 'post', {});
  assert.ok(ops.some(o => o.op === 'layer.text' && o.args.name === 'Brand_Logo'));
  const withLogo = compileRecipe(SEED_RECIPES[0], { brand: b, copy: BRIEFS[0], format: 'post', psdPath: '/tmp/a.psd', pngPath: '/tmp/a.png' });
  const logoOp = withLogo.find(o => o.args.name === 'Brand_Logo');
  assert.equal(logoOp.op, 'layer.image');
  assert.equal(Math.round(logoOp.args.w / logoOp.args.h), 3);
  assert.ok(OPS['layer.image'](logoOp.args));
  const rule = withLogo.find(o => o.args.name === 'Header_Rule');
  assert.equal(rule.args.afterLayer, undefined);
  assert.ok(Number.isFinite(rule.args.y));
  const head = withLogo.find(o => o.args.name === 'Headline_H1').args;
  const body = withLogo.find(o => o.args.name === 'Subcopy_Body').args;
  assert.equal(head.font, 'Montserrat');
  assert.equal(body.font, 'Inter');
});
