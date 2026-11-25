import http from 'node:http';
import { spawn } from 'node:child_process';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { generateStrategyAndCalendar } from './services/aiProvider.mjs';
import { buildCalendarCsv, buildProposalHtml } from './services/exporter.mjs';
import { generatePostPsd, generateProEditorialJsx, revisePhotoshopLayer } from '../mcp-servers/adobe-mcp/photoshopBridge.mjs';
import { generateVectorPostAi } from '../mcp-servers/adobe-mcp/illustratorBridge.mjs';
import { localOnly, validatedPath, isSecretKey, maskSecret } from './security.mjs';
import { evaluateDesign } from './services/visionQa.mjs';
import { bridge } from './services/ps/bridge.mjs';
import { attachWebSocket } from './services/ps/wsServer.mjs';
import { lintSnapshot } from './services/ps/lint.mjs';
import { buildOps, listRecipes } from './services/ps/recipes.mjs';
import { parseRevision, pickLayer } from './services/ps/revise.mjs';
import { selfTestOps, SELFTEST_NOTES } from './services/ps/selftest.mjs';
import * as vault from './services/brandVault.mjs';
import { safeFormat, safeSegment } from './security.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.AJANSOS_DATA_DIR || path.resolve(__dirname, '../storage');
const OUTPUT_DIR = path.join(DATA_DIR, 'outputs');
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');

const app = express();
const PORT = process.env.PORT || 4010;

app.use(localOnly);
app.use(express.json({ limit: '1mb' }));

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function allowedImageRoots() {
  const roots = [OUTPUT_DIR, path.join(DATA_DIR, 'brands')];
  for (const r of db.prepare('SELECT assets_dir FROM brands').all()) if (r.assets_dir) roots.push(r.assets_dir);
  return roots;
}


// Health & Status
app.get('/api/health', (_req, res) => {
  let version = 'bilinmiyor';
  try {
    version = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')).version || version;
  } catch {}
  const row = db.prepare('SELECT COUNT(*) AS n FROM brands').get();
  res.json({ ok: true, app: 'FramioMedia AjansOS Backend', version, database: { ok: true, brands: row.n } });
});

// Brands CRUD
app.get('/api/brands', (_req, res) => {
  const rows = db.prepare('SELECT * FROM brands ORDER BY created_at ASC').all();
  res.json(rows);
});

app.post('/api/brands', (req, res) => {
  const { name, sector, tone, primary_color, secondary_color, accent_color, font_family, website } = req.body;
  if (!name || !sector) return res.status(400).json({ error: 'name ve sector zorunludur' });
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + crypto.randomBytes(2).toString('hex');
  db.prepare(`
    INSERT INTO brands (id, name, sector, tone, primary_color, secondary_color, accent_color, font_family, website)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    sector,
    tone || 'Profesyonel, modern',
    primary_color || '#0F172A',
    secondary_color || '#1E293B',
    accent_color || '#38BDF8',
    font_family || 'Inter',
    website || ''
  );
  const created = db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
  res.status(201).json(created);
});

app.put('/api/brands/:id', (req, res) => {
  const { brand_guidelines_md, assets_dir, tone, primary_color, secondary_color, accent_color } = req.body || {};
  const existing = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Marka bulunamadi' });

  db.prepare(`
    UPDATE brands
    SET brand_guidelines_md = ?, assets_dir = ?, tone = ?, primary_color = ?, secondary_color = ?, accent_color = ?
    WHERE id = ?
  `).run(
    brand_guidelines_md ?? existing.brand_guidelines_md ?? '',
    assets_dir ?? existing.assets_dir ?? '',
    tone ?? existing.tone,
    primary_color ?? existing.primary_color,
    secondary_color ?? existing.secondary_color,
    accent_color ?? existing.accent_color,
    req.params.id
  );

  // Also persist real .md file under storage/brands/<id>.md
  const brandsDir = path.join(DATA_DIR, 'brands');
  fs.mkdirSync(brandsDir, { recursive: true });
  fs.writeFileSync(path.join(brandsDir, `${req.params.id}.md`), brand_guidelines_md ?? existing.brand_guidelines_md ?? '', 'utf8');

  const updated = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  res.json(updated);
});

app.get('/api/brands/:id/assets', (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.id);
  if (!brand || !brand.assets_dir || !fs.existsSync(brand.assets_dir)) {
    return res.json({ dir: brand?.assets_dir || '', files: [] });
  }
  const exts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  const files = fs
    .readdirSync(brand.assets_dir)
    .filter(f => exts.has(path.extname(f).toLowerCase()))
    .map(f => ({ name: f, fullPath: path.join(brand.assets_dir, f) }));
  res.json({ dir: brand.assets_dir, files });
});

// ---- Marka klasörü (Brand Vault) ----
const brandRow = id => db.prepare('SELECT * FROM brands WHERE id = ?').get(id);
function brandVaultDir(brand) {
  const dir = vault.vaultDir(DATA_DIR, brand.id);
  vault.ensureVault(dir);
  return dir;
}
// Marka satırı + marka kiti (renk/font) + logo sürümleri; üretim hattı bunu kullanır.
function brandWithKit(row) {
  const dir = brandVaultDir(row);
  const kit = vault.readKit(dir);
  return {
    ...row,
    primary_color: kit.colors.primary || row.primary_color,
    secondary_color: kit.colors.secondary || row.secondary_color,
    accent_color: kit.colors.accent || row.accent_color,
    fontHeading: kit.fontHeading, fontBody: kit.fontBody,
    forbidden: kit.forbidden,
    logos: vault.resolveLogos(dir, kit)
  };
}
app.get('/api/brands/:id/vault', (req, res) => {
  const brand = brandRow(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
  const dir = brandVaultDir(brand);
  const kit = vault.readKit(dir);
  const { assets, warnings } = vault.vaultReport(dir, kit, brand);
  res.json({ dir, kit, assets, warnings, folders: Object.keys(vault.FOLDERS) });
});
app.put('/api/brands/:id/kit', (req, res) => {
  const brand = brandRow(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
  res.json({ ok: true, kit: vault.writeKit(brandVaultDir(brand), req.body || {}) });
});
app.post('/api/brands/:id/assets/:folder', express.raw({ type: () => true, limit: '31mb' }), (req, res) => {
  const brand = brandRow(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
  try {
    const saved = vault.saveAsset(brandVaultDir(brand), req.params.folder, req.query.name, Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0));
    res.json({ ok: true, ...saved });
  } catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.delete('/api/brands/:id/assets/:folder/:name', (req, res) => {
  const brand = brandRow(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
  try { vault.removeAsset(brandVaultDir(brand), req.params.folder, req.params.name); res.json({ ok: true }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});
app.post('/api/brands/:id/open-folder', (req, res) => {
  const brand = brandRow(req.params.id);
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
  const dir = brandVaultDir(brand);
  try {
    const cmd = process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    spawn(cmd, [dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
    res.json({ ok: true, dir });
  } catch (e) { res.json({ ok: false, dir, error: e.message }); }
});

app.get('/api/asset-file', (req, res) => {
  const filePath = validatedPath(req.query.path, allowedImageRoots(), IMAGE_EXTS);
  if (!filePath) return res.status(404).send('Not found');
  res.sendFile(filePath);
});

app.get('/api/outputs', (_req, res) => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const files = fs.readdirSync(OUTPUT_DIR).map(name => {
    const fullPath = path.join(OUTPUT_DIR, name);
    const st = fs.statSync(fullPath);
    return { name, fullPath, size: st.size, mtime: st.mtime };
  }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
  res.json(files);
});

app.delete('/api/outputs/:filename', (req, res) => {
  const target = path.join(OUTPUT_DIR, path.basename(req.params.filename));
  if (fs.existsSync(target)) fs.unlinkSync(target);
  res.json({ deleted: true });
});

app.post('/api/adobe/photoshop/pro-jsx', async (req, res) => {
  try {
    const { brand_id, copy, format, heroImagePath } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const hero = heroImagePath ? validatedPath(heroImagePath, allowedImageRoots(), IMAGE_EXTS) : '';
    if (heroImagePath && !hero) return res.status(400).json({ ok: false, error: 'Gecersiz gorsel yolu' });
    const result = await generateProEditorialJsx({ brand, copy: copy || {}, format: format || 'post', heroImagePath: hero || '', outputDir: OUTPUT_DIR });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.delete('/api/brands/:id', (req, res) => {
  db.prepare('DELETE FROM brands WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM strategy_items WHERE brand_id = ?').run(req.params.id);
  res.json({ deleted: true });
});

// Settings
app.get('/api/settings', (_req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  for (const r of rows) obj[r.key] = isSecretKey(r.key) ? maskSecret(r.value) : r.value;
  res.json(obj);
});

app.post('/api/settings', (req, res) => {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) {
    if (isSecretKey(k) && String(v ?? '').startsWith('••••')) continue; // maskelenmiş değer geri gönderildi, değiştirme
    stmt.run(k, String(v ?? ''));
  }
  res.json({ saved: true });
});

// Recipes (Design Memory)
app.get('/api/recipes', (_req, res) => {
  const rows = db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/recipes', (req, res) => {
  const { title, source_url, source_type } = req.body;
  if (!title) return res.status(400).json({ error: 'title zorunludur' });
  const id = 'rec-' + crypto.randomBytes(3).toString('hex');
  db.prepare(`
    INSERT INTO recipes (id, title, source_url, source_type, steps_count, steps_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, source_url || '', source_type || 'youtube', 10, JSON.stringify(['Analiz', 'Grid', 'Tipografi', 'MCP Export']));
  const created = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  res.status(201).json(created);
});

// Campaigns
app.get('/api/campaigns', (_req, res) => {
  const rows = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/campaigns', (req, res) => {
  const { brand_id, title, brief } = req.body;
  const id = 'cmp-' + crypto.randomBytes(3).toString('hex');
  db.prepare(`
    INSERT INTO campaigns (id, brand_id, title, brief, status, qa_score)
    VALUES (?, ?, ?, ?, 'draft', NULL)
  `).run(id, brand_id || 'vega', title || 'Yeni Kampanya', brief || '');
  const created = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
  res.status(201).json(created);
});

// Strategy Generation (Claude / Gemini / Offline Fallback)
app.post('/api/strategy/generate', async (req, res) => {
  const { brand_id, brief } = req.body || {};
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
  if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });

  const result = await generateStrategyAndCalendar({ brand, brief });

  db.prepare('DELETE FROM strategy_items WHERE brand_id = ?').run(brand.id);
  const ins = db.prepare(`
    INSERT INTO strategy_items (id, brand_id, day, format, topic, eyebrow, title, desc, cta, goal, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const it of result.items) {
    ins.run(
      'st-' + crypto.randomBytes(3).toString('hex'),
      brand.id,
      Number(it.day) || 1,
      it.format || 'Post 4:5',
      it.topic || '',
      it.eyebrow || '',
      it.title || '',
      it.desc || '',
      it.cta || '',
      it.goal || '',
      result.summary || ''
    );
  }

  const saved = db.prepare('SELECT * FROM strategy_items WHERE brand_id = ? ORDER BY day ASC').all(brand.id);
  res.json({ mode: result.mode, summary: result.summary, items: saved, failures: result.failures || [] });
});

app.get('/api/strategy/:brandId', (req, res) => {
  const items = db.prepare('SELECT * FROM strategy_items WHERE brand_id = ? ORDER BY day ASC').all(req.params.brandId);
  res.json({ summary: items[0]?.summary || '', items });
});

app.get('/api/export/calendar/:brandId', (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
  if (!brand) return res.status(404).send('Marka bulunamadi');
  const items = db.prepare('SELECT * FROM strategy_items WHERE brand_id = ? ORDER BY day ASC').all(brand.id);
  const csv = buildCalendarCsv(brand, items);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${brand.id}_30_Gunluk_Strateji.csv"`);
  res.send(csv);
});

app.get('/api/export/proposal/:brandId', (req, res) => {
  const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(req.params.brandId);
  if (!brand) return res.status(404).send('Marka bulunamadi');
  const items = db.prepare('SELECT * FROM strategy_items WHERE brand_id = ? ORDER BY day ASC').all(brand.id);
  const html = buildProposalHtml(brand, items[0]?.summary || '', items);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Adobe Photoshop & Illustrator MCP + Firefly Endpoints
app.post('/api/adobe/photoshop/create', async (req, res) => {
  try {
    const { brand_id, copy, format } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const result = await generatePostPsd({ brand, copy: copy || {}, format: format || 'post', outputDir: OUTPUT_DIR });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/adobe/photoshop/revise', async (req, res) => {
  try {
    const { psdPath, instruction } = req.body || {};
    if (!psdPath) {
      return res.json({ ok: true, simulated: true, message: `Revize kaydedildi (Önce PSD üretin): "${instruction}"` });
    }
    const safePsd = validatedPath(psdPath, [OUTPUT_DIR], new Set(['.psd']));
    if (!safePsd) return res.status(400).json({ ok: false, error: 'Gecersiz PSD yolu (yalnizca cikti klasoru)' });
    const result = await revisePhotoshopLayer({ psdPath: safePsd, instruction: String(instruction || '').slice(0, 500) });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/adobe/illustrator/create', async (req, res) => {
  try {
    const { brand_id, copy, format } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const result = await generateVectorPostAi({ brand, copy: copy || {}, format: format || 'post', outputDir: OUTPUT_DIR });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

function devUpdateState() {
  const pkgPath = path.resolve(__dirname, '../package.json');
  const current = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  return { status: 'dev', current, latest: null, percent: 0, error: null, checkedAt: null };
}

app.get('/api/system/update-status', (_req, res) => {
  try {
    res.json(global.ajansUpdater ? global.ajansUpdater.getState() : devUpdateState());
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/system/check-update', async (_req, res) => {
  try {
    res.json(global.ajansUpdater ? await global.ajansUpdater.check() : devUpdateState());
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.post('/api/system/install-update', (_req, res) => {
  if (!global.ajansUpdater) return res.status(400).json({ ok: false, message: 'Güncelleme yalnızca kurulu uygulamada çalışır.' });
  res.json(global.ajansUpdater.install());
});

// Vision QA & Design Memory Endpoints (Faz 4)
app.post('/api/qa/evaluate', async (req, res) => {
  try {
    const { brand_id, pngPath, psdPath, copy } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const safePng = pngPath ? validatedPath(pngPath, [OUTPUT_DIR], new Set(['.png'])) : null;
    if (pngPath && !safePng) return res.status(400).json({ ok: false, error: 'Gecersiz PNG yolu (yalnizca cikti klasoru)' });
    const safePsd = psdPath ? validatedPath(psdPath, [OUTPUT_DIR], new Set(['.psd'])) : null;
    const qa = await evaluateDesign({ pngPath: safePng, brand, copy });
    let autoFixed = false;
    if (!qa.passed && safePsd && qa.autoFixInstruction) {
      await revisePhotoshopLayer({ psdPath: safePsd, instruction: qa.autoFixInstruction });
      autoFixed = true;
    }
    res.json({ ok: true, autoFixed, ...qa });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


// ---- Photoshop UXP köprüsü ----
function getBridgeToken() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'ps_bridge_token'").get();
  if (row && row.value) return row.value;
  const t = crypto.randomBytes(16).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('ps_bridge_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(t);
  return t;
}
const BRIDGE_TOKEN = getBridgeToken();

const MIN_PLUGIN = '0.3.0';
const semverLt = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); } return false; };
app.get('/api/ps/status', (_req, res) => {
  const st = bridge.status();
  res.json({ ...st, minPlugin: MIN_PLUGIN, pluginOutdated: !!(st.connected && st.plugin && semverLt(st.plugin, MIN_PLUGIN)) });
});
app.get('/api/ps/info', (_req, res) => res.json({ token: BRIDGE_TOKEN, port: Number(PORT) }));

async function snapshotAndLint(format) {
  const snapshot = await bridge.request('doc.snapshot', {});
  return { snapshot, lint: lintSnapshot(snapshot, { format }) };
}

app.post('/api/ps/snapshot', async (req, res) => {
  try {
    res.json({ ok: true, ...(await snapshotAndLint(safeFormat(req.body?.format))) });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.get('/api/recipes', (_req, res) => res.json(listRecipes()));

// Photoshop yetenek testi: yeni işlemlerin PS sürümünde çalışıp çalışmadığını tek tuşla raporlar.
app.post('/api/ps/selftest', async (_req, res) => {
  try {
    const ops = selfTestOps({ dir: path.join(OUTPUT_DIR, 'selftest') });
    const report = await bridge.runOpsReport(ops, { timeoutMs: 60000 });
    res.json({ ok: true, passed: report.filter(r => r.ok).length, total: report.length, report: report.map(r => ({ ...r, label: SELFTEST_NOTES[r.op] || r.op })), pluginVersion: bridge.status().plugin || null });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

app.post('/api/ps/generate', async (req, res) => {
  try {
    const { brand_id, copy, format, recipe, heroImagePath } = req.body || {};
    const brandRaw = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brandRaw) return res.status(404).json({ ok: false, error: 'Marka bulunamadi' });
    const brand = brandWithKit(brandRaw);
    const fmt = safeFormat(format);
    let hero;
    if (heroImagePath) {
      hero = validatedPath(heroImagePath, allowedImageRoots(), IMAGE_EXTS);
      if (!hero) return res.status(400).json({ ok: false, error: 'Gecersiz gorsel yolu (yalnizca cikti ve marka varlik klasorleri)' });
    }
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const base = `${safeSegment(brand.id, 'brand')}_${fmt}_${Date.now()}`;
    const psdPath = path.join(OUTPUT_DIR, `${base}.psd`);
    const pngPath = path.join(OUTPUT_DIR, `${base}.png`);
    const ops = buildOps({ brand, copy: copy || {}, format: fmt, recipeId: typeof recipe === 'string' ? recipe : undefined, psdPath, pngPath, heroImagePath: hero });
    const results = await bridge.runOps(ops, { timeoutMs: 60000 });
    const { snapshot, lint } = await snapshotAndLint(fmt);
    res.json({ ok: true, psdPath, pngPath, recipe: ops.recipe, scale: ops.scale, notes: ops.notes || [], warnings: results.warnings || [], lint, layers: snapshot.layers });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message, step: err.step ?? null });
  }
});

app.post('/api/ps/revise', async (req, res) => {
  try {
    const { instruction, psdPath, format } = req.body || {};
    const fmt = safeFormat(format);
    const safePsd = psdPath ? validatedPath(psdPath, [OUTPUT_DIR], new Set(['.psd'])) : null;
    if (psdPath && !safePsd) return res.status(400).json({ ok: false, error: 'Gecersiz PSD yolu (yalnizca cikti klasoru)' });
    const rev = parseRevision(instruction);
    if (rev.delta === null) return res.status(400).json({ ok: false, error: 'Revize anlaşılamadı: "büyüt" veya "küçült" belirtin (örn. "başlığı 8 punto büyüt").' });
    const { snapshot } = await snapshotAndLint(fmt);
    const layer = pickLayer(snapshot, rev.kind);
    if (!layer || !layer.text) return res.status(404).json({ ok: false, error: `Hedef metin katmanı bulunamadı (${rev.kind}). Katmanlar: ${snapshot.layers.map(l => l.name).join(', ')}` });
    const target = Math.max(8, Math.round(layer.text.size + rev.delta));
    const change = await bridge.request('layer.setTextSize', { name: layer.name, size: target });
    if (safePsd) await bridge.request('doc.save', { psdPath: safePsd, pngPath: safePsd.replace(/\.psd$/i, '.png') }, { timeoutMs: 60000 });
    const after = await snapshotAndLint(fmt);
    res.json({ ok: true, layer: layer.name, sizeBefore: change.before, sizeAfter: change.after, lint: after.lint, layers: after.snapshot.layers, pngPath: safePsd ? safePsd.replace(/\.psd$/i, '.png') : null });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

function verifyBridgeUpgrade(req, url) {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(req.headers.host || '') && url.searchParams.get('token') === BRIDGE_TOKEN;
}

// UXP 'localhost' adresini IPv4 veya IPv6'ya çözebilir; ikisini de yalnızca yerel arayüzde dinle.
// serverReady: IPv4 dinleyici hazır olunca çözülür, port dolu/yasaklıysa gerçek hata ile reddedilir
// (Electron bunu kullanıcıya açıkça gösterir).
export const serverReady = new Promise((resolve, reject) => {
  for (const host of ['127.0.0.1', '::1']) {
    const server = http.createServer(app);
    attachWebSocket(server, { path: '/ps', verify: verifyBridgeUpgrade, onConnection: c => bridge.attach(c) });
    server.on('error', err => {
      if (host === '127.0.0.1') reject(err);
      else console.warn(`IPv6 dinleyici açılamadı (${err.code || err.message}); IPv4 ile devam ediliyor.`);
    });
    server.listen(PORT, host, () => {
      if (host === '127.0.0.1') {
        console.log(`AjansOS Backend calisiyor: http://127.0.0.1:${PORT}`);
        resolve();
      }
    });
  }
});
