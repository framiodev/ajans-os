import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { safeFormat, safeSegment } from '../../backend/security.mjs';

function findPhotoshopExe() {
  const adobeDir = 'C:\\Program Files\\Adobe';
  if (fsSync.existsSync(adobeDir)) {
    const dirs = fsSync.readdirSync(adobeDir).filter(d => d.toLowerCase().includes('photoshop')).sort().reverse();
    for (const d of dirs) {
      const exe = path.join(adobeDir, d, 'Photoshop.exe');
      if (fsSync.existsSync(exe)) return exe;
    }
  }
  return null;
}

function hexToRgb(hex = '#0B1120') {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  if (Number.isNaN(num)) return { r: 15, g: 23, b: 42 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function escapeJsx(str = '') {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\r');
}

async function runPhotoshopJsx(jsxCode) {
  const exe = findPhotoshopExe();
  if (!exe) throw new Error('Photoshop bulunamadi (C:\\Program Files\\Adobe altinda kurulu surum yok).');
  const id = Date.now();
  const tmpJsx = path.join(os.tmpdir(), `ajansos_ps_${id}.jsx`);
  const doneFile = path.join(os.tmpdir(), `ajansos_ps_${id}.done`).replace(/\\/g, '/');

  const wrappedJsx = `
    try {
      var __result;
      ${jsxCode}
      var df = new File("${escapeJsx(doneFile)}");
      df.open("w"); df.write(typeof __result === "string" ? "OK:" + __result : "OK"); df.close();
    } catch (e) {
      var ef = new File("${escapeJsx(doneFile)}");
      ef.open("w"); ef.write("ERR:" + e.message); ef.close();
    }
  `;

  await fs.writeFile(tmpJsx, wrappedJsx, 'utf8');
  const child = spawn(exe, [tmpJsx], { detached: true, stdio: 'ignore' });
  child.unref();

  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (fsSync.existsSync(doneFile)) {
      const status = (await fs.readFile(doneFile, 'utf8')).trim();
      await fs.unlink(tmpJsx).catch(() => {});
      await fs.unlink(doneFile).catch(() => {});
      if (status.startsWith('ERR:')) throw new Error(status);
      return status;
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('Photoshop JSX zaman asimina ugradi (45sn).');
}

export async function generateProEditorialJsx({ brand, copy, format = 'post', heroImagePath = '', outputDir }) {
  format = safeFormat(format);
  const dims =
    format === 'story' ? { w: 1080, h: 1920 } : format === 'linkedin' ? { w: 1920, h: 1080 } : { w: 1080, h: 1350 };

  const bg = hexToRgb(brand.primary_color);
  const acc = hexToRgb(brand.accent_color);
  const safeName = `${safeSegment(brand.id, 'brand')}_${format}_pro_${Date.now()}`;
  const jsxPath = path.join(outputDir, `${safeName}.jsx`);
  const psdPath = path.join(outputDir, `${safeName}.psd`).replace(/\\/g, '/');
  const pngPath = path.join(outputDir, `${safeName}.png`).replace(/\\/g, '/');
  const cleanHero = (heroImagePath || '').replace(/\\/g, '/');

  const jsx = `// FramioMedia AjansOS — Pro Editoryal Tasarim Scripti (${escapeJsx(brand.name)})
app.preferences.rulerUnits = Units.PIXELS;
app.preferences.typeUnits = TypeUnits.POINTS;

var W = ${dims.w}, H = ${dims.h};
var doc = app.documents.add(W, H, 72, "${escapeJsx(safeName)}", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);

function makeColor(r, g, b) {
  var c = new SolidColor();
  c.rgb.red = r; c.rgb.green = g; c.rgb.blue = b;
  return c;
}

function fillRectLayer(name, x1, y1, x2, y2, r, g, b, opacity) {
  var lyr = doc.artLayers.add();
  lyr.name = name;
  doc.selection.select([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
  doc.selection.fill(makeColor(r, g, b));
  doc.selection.deselect();
  if (opacity !== undefined) lyr.opacity = opacity;
  return lyr;
}

var heroFile = new File("${escapeJsx(cleanHero)}");
if ("${escapeJsx(cleanHero)}" !== "" && heroFile.exists) {
  var srcDoc = app.open(heroFile);
  srcDoc.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
  srcDoc.close(SaveOptions.DONOTSAVECHANGES);
  app.activeDocument = doc;
  var heroLyr = doc.activeLayer;
  heroLyr.name = "Hero_Studio_Photo";
  var b = heroLyr.bounds;
  var lw = b[2].value - b[0].value;
  var lh = b[3].value - b[1].value;
  var scale = Math.max(W / lw, H / lh) * 100;
  heroLyr.resize(scale, scale, AnchorPosition.MIDDLECENTER);
  var nb = heroLyr.bounds;
  heroLyr.translate((W / 2) - ((nb[0].value + nb[2].value) / 2), (H / 2) - ((nb[1].value + nb[3].value) / 2));
  // Akilli Fotograf Duzenleme (Kontrast + Marka Tonlamasi)
  try {
    heroLyr.autoContrast();
    heroLyr.adjustBrightnessContrast(4, 14);
  } catch (e) {}
} else {
  fillRectLayer("BG_Brand_Base", 0, 0, W, H, ${bg.r}, ${bg.g}, ${bg.b}, 100);
}

var scrim = doc.artLayers.add();
scrim.name = "Editorial_Dark_Scrim";
doc.selection.select([[0, 0], [Math.round(W * 0.62), 0], [Math.round(W * 0.54), H], [0, H]]);
doc.selection.feather(120);
doc.selection.fill(makeColor(${bg.r}, ${bg.g}, ${bg.b}));
doc.selection.deselect();
scrim.opacity = 62;

fillRectLayer("Hairline_Top", 84, 146, W - 84, 147, ${acc.r}, ${acc.g}, ${acc.b}, 35);
fillRectLayer("Hairline_Bottom", 84, H - 110, W - 84, H - 109, 255, 255, 255, 20);

function addText(name, content, size, x, y, r, g, b, opts) {
  opts = opts || {};
  var lyr = doc.artLayers.add();
  lyr.kind = LayerKind.TEXT;
  lyr.name = name;
  var ti = lyr.textItem;
  ti.contents = content;
  ti.size = size;
  ti.position = [x, y];
  ti.color = makeColor(r, g, b);
  try { ti.font = opts.font || "Arial-BoldMT"; } catch (e) {}
  if (opts.tracking) ti.tracking = opts.tracking;
  if (opts.leading) { ti.useAutoLeading = false; ti.leading = opts.leading; }
  return lyr;
}

addText("Brand_Logo", "${escapeJsx((brand.name || '').toUpperCase())}", 22, 84, 112, ${acc.r}, ${acc.g}, ${acc.b}, { font: "Arial-BoldMT", tracking: 220 });
fillRectLayer("Badge_BG", 84, 210, 460, 255, ${acc.r}, ${acc.g}, ${acc.b}, 24);
addText("Badge_Text", "${escapeJsx((copy.eyebrow || brand.sector || '').toUpperCase())}", 16, 106, 239, ${acc.r}, ${acc.g}, ${acc.b}, { font: "Arial-BoldMT", tracking: 140 });
addText("Headline_H1", "${escapeJsx(copy.title || brand.name)}", 74, 82, 370, 250, 247, 242, { font: "Arial-BoldMT", leading: 82, tracking: -15 });
fillRectLayer("Accent_Divider", 84, 590, 164, 594, ${acc.r}, ${acc.g}, ${acc.b}, 100);
addText("Subcopy_Body", "${escapeJsx(copy.desc || '')}", 26, 84, 650, 224, 220, 214, { font: "ArialMT", leading: 36 });
fillRectLayer("CTA_Button_BG", 84, H - 240, 390, H - 170, ${acc.r}, ${acc.g}, ${acc.b}, 100);
addText("CTA_Button_Text", "${escapeJsx((copy.cta || 'HEMEN KEŞFET').toUpperCase())}", 20, 122, H - 197, ${bg.r}, ${bg.g}, ${bg.b}, { font: "Arial-BoldMT", tracking: 90 });
addText("Footer_Web", "${escapeJsx(brand.website || 'framiomedia.com')}", 16, 84, H - 64, 180, 174, 166, { font: "ArialMT", tracking: 100 });

var psdOpts = new PhotoshopSaveOptions();
psdOpts.layers = true;
doc.saveAs(new File("${escapeJsx(psdPath)}"), psdOpts, true, Extension.LOWERCASE);
doc.saveAs(new File("${escapeJsx(pngPath)}"), new PNGSaveOptions(), true, Extension.LOWERCASE);
`;

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(jsxPath, '\uFEFF' + jsx, 'utf8');
  return { jsxPath, psdPath, pngPath, heroImagePath: cleanHero };
}

export async function generatePostPsd({ brand, copy, format = 'post', outputDir }) {
  format = safeFormat(format);
  const dims =
    format === 'story' ? { w: 1080, h: 1920 } : format === 'linkedin' ? { w: 1920, h: 1080 } : { w: 1080, h: 1350 };

  const bg = hexToRgb(brand.primary_color);
  const acc = hexToRgb(brand.accent_color);
  const safeName = `${safeSegment(brand.id, 'brand')}_${format}_${Date.now()}`;
  const psdPath = path.join(outputDir, `${safeName}.psd`).replace(/\\/g, '/');
  const pngPath = path.join(outputDir, `${safeName}.png`).replace(/\\/g, '/');

  const jsx = `
    app.preferences.rulerUnits = Units.PIXELS;
    var doc = app.documents.add(${dims.w}, ${dims.h}, 72, "${escapeJsx(safeName)}", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);

    // 1. Arka Plan Katmani
    var bgLayer = doc.artLayers.add();
    bgLayer.name = "BG_Brand_Base";
    var bgColor = new SolidColor();
    bgColor.rgb.red = ${bg.r}; bgColor.rgb.green = ${bg.g}; bgColor.rgb.blue = ${bg.b};
    doc.selection.selectAll();
    doc.selection.fill(bgColor);
    doc.selection.deselect();

    function addTextLayer(name, text, size, x, y, r, g, b, maxW) {
      var lyr = doc.artLayers.add();
      lyr.kind = LayerKind.TEXT;
      lyr.name = name;
      var ti = lyr.textItem;
      ti.kind = TextType.PARAGRAPHTEXT;
      ti.width = maxW;
      ti.height = size * 4;
      ti.contents = text;
      ti.size = size;
      ti.position = [x, y];
      var col = new SolidColor();
      col.rgb.red = r; col.rgb.green = g; col.rgb.blue = b;
      ti.color = col;
      return lyr;
    }

    // 2. Tipografi Katmanlari
    addTextLayer("Logo_SmartObject", "${escapeJsx(brand.name.toUpperCase())}", 36, 90, 90, ${acc.r}, ${acc.g}, ${acc.b}, ${dims.w - 180});
    addTextLayer("Eyebrow_Text", "${escapeJsx(copy.eyebrow || '')}", 28, 90, 220, ${acc.r}, ${acc.g}, ${acc.b}, ${dims.w - 180});
    addTextLayer("Ana_Baslik_H1", "${escapeJsx(copy.title || '')}", 78, 90, 340, 248, 250, 252, ${dims.w - 180});
    addTextLayer("Alt_Aciklama", "${escapeJsx(copy.desc || '')}", 34, 90, 680, 226, 232, 240, ${dims.w - 180});
    addTextLayer("CTA_Buton_Grubu", "${escapeJsx(copy.cta || '')}", 38, 90, ${dims.h - 200}, ${acc.r}, ${acc.g}, ${acc.b}, ${dims.w - 180});

    // 3. PSD ve PNG Kaydet
    var psdOpts = new PhotoshopSaveOptions();
    psdOpts.layers = true;
    doc.saveAs(new File("${escapeJsx(psdPath)}"), psdOpts, true, Extension.LOWERCASE);

    var pngOpts = new PNGSaveOptions();
    doc.saveAs(new File("${escapeJsx(pngPath)}"), pngOpts, true, Extension.LOWERCASE);
  `;

  await fs.mkdir(outputDir, { recursive: true });
  await runPhotoshopJsx(jsx);
  return { psdPath, pngPath, layers: ['BG_Brand_Base', 'Logo_SmartObject', 'Eyebrow_Text', 'Ana_Baslik_H1', 'Alt_Aciklama', 'CTA_Buton_Grubu'] };
}

export async function revisePhotoshopLayer({ psdPath, instruction }) {
  const lower = (instruction || '').toLowerCase();
  // PSD'yi hangi akış üretmiş olursa olsun (generatePostPsd / pro-jsx) katman adı eşleşsin diye aday listesi
  const CANDIDATES = {
    logo: ['Logo_SmartObject', 'Brand_Logo'],
    cta: ['CTA_Buton_Grubu', 'CTA_Button_Text'],
    headline: ['Ana_Baslik_H1', 'Headline_H1']
  };
  const kind = lower.includes('logo') ? 'logo' : lower.includes('cta') || lower.includes('buton') ? 'cta' : 'headline';
  const targetLayer = CANDIDATES[kind][0];
  const delta = lower.includes('küçült') || lower.includes('kucult') ? -10 : 12;

  const cleanPsd = psdPath.replace(/\\/g, '/');
  const cleanPng = cleanPsd.replace(/\.psd$/i, '.png');

  const jsx = `
    var f = new File("${escapeJsx(cleanPsd)}");
    if (!f.exists) throw new Error("PSD dosyasi yok: ${escapeJsx(cleanPsd)}");
    var doc = app.open(f);
    var names = ${JSON.stringify(CANDIDATES[kind])};
    var lyr = null;
    for (var i = 0; i < names.length && !lyr; i++) {
      try { lyr = doc.artLayers.getByName(names[i]); } catch (e1) {}
    }
    if (!lyr) { doc.close(SaveOptions.DONOTSAVECHANGES); throw new Error("Katman bulunamadi: " + names.join(" / ")); }
    if (lyr.kind != LayerKind.TEXT) { doc.close(SaveOptions.DONOTSAVECHANGES); throw new Error("Katman metin degil: " + lyr.name); }
    var before = Number(lyr.textItem.size);
    lyr.textItem.size = before + (${delta});
    var after = Number(lyr.textItem.size);
    if (after === before) { doc.close(SaveOptions.DONOTSAVECHANGES); throw new Error("Boyut degismedi: " + lyr.name); }
    var psdOpts = new PhotoshopSaveOptions();
    psdOpts.layers = true;
    doc.saveAs(f, psdOpts, true, Extension.LOWERCASE);
    doc.saveAs(new File("${escapeJsx(cleanPng)}"), new PNGSaveOptions(), true, Extension.LOWERCASE);
    doc.close(SaveOptions.DONOTSAVECHANGES);
    __result = lyr.name + "|" + before + "|" + after;
  `;

  const status = await runPhotoshopJsx(jsx);
  const m = /^OK:(.+)\|(\d+(?:\.\d+)?)\|(\d+(?:\.\d+)?)$/.exec(status);
  if (!m) throw new Error('Revizyon dogrulanamadi: ' + status);
  return { updatedLayer: m[1], sizeBefore: Number(m[2]), sizeAfter: Number(m[3]), psdPath: cleanPsd, pngPath: cleanPng };
}
