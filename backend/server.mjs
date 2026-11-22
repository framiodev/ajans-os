import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.mjs';
import { generateStrategyAndCalendar } from './services/aiProvider.mjs';
import { buildCalendarCsv, buildProposalHtml } from './services/exporter.mjs';
import { generatePostPsd, generateProEditorialJsx, revisePhotoshopLayer } from '../mcp-servers/adobe-mcp/photoshopBridge.mjs';
import { generateVectorPostAi } from '../mcp-servers/adobe-mcp/illustratorBridge.mjs';
import { generateFireflyScene, enhanceOrRecreateWithFirefly } from '../mcp-servers/adobe-mcp/fireflyService.mjs';
import { evaluateDesign } from './services/visionQa.mjs';
import { extractYoutubeRecipe, researchTrends } from './services/designLearner.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.AJANSOS_DATA_DIR || path.resolve(__dirname, '../storage');
const OUTPUT_DIR = path.join(DATA_DIR, 'outputs');
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');

const app = express();
const PORT = process.env.PORT || 4010;

app.use(cors());
app.use(express.json());

// Health & Status
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'FramioMedia AjansOS Backend',
    version: '1.0.0',
    services: {
      database: 'connected',
      photoshopMcp: 'ready',
      illustratorMcp: 'ready',
      firefly: 'configured'
    }
  });
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

app.get('/api/asset-file', (req, res) => {
  const filePath = String(req.query.path || '');
  if (!filePath || !fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.sendFile(path.resolve(filePath));
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
    const result = await generateProEditorialJsx({ brand, copy: copy || {}, format: format || 'post', heroImagePath: heroImagePath || '', outputDir: OUTPUT_DIR });
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
  for (const r of rows) obj[r.key] = r.value;
  res.json(obj);
});

app.post('/api/settings', (req, res) => {
  const stmt = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(req.body || {})) {
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
    VALUES (?, ?, ?, ?, 'completed', 96)
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
  res.json({ mode: result.mode, summary: result.summary, items: saved });
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
    const result = await revisePhotoshopLayer({ psdPath, instruction });
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

app.post('/api/adobe/firefly/enhance', async (req, res) => {
  try {
    const { brand_id, heroImagePath, action, format } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const result = await enhanceOrRecreateWithFirefly({ brand, heroImagePath, action: action || 'recompose', format: format || 'post' });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/knowledge/adobe-2027', (_req, res) => {
  const kPath = path.resolve(__dirname, '../design-memory/adobe_2027_knowledge.json');
  if (!fs.existsSync(kPath)) return res.json({ photoshop_2027: [], firefly_2027: [], creative_cloud_mcp_2027: [] });
  res.json(JSON.parse(fs.readFileSync(kPath, 'utf8')));
});

app.post('/api/adobe/firefly/generate', async (req, res) => {
  try {
    const { brand_id, prompt, format } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const result = await generateFireflyScene({ brand, prompt, format: format || 'post' });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Vision QA & Design Memory Endpoints (Faz 4)
app.post('/api/qa/evaluate', async (req, res) => {
  try {
    const { brand_id, pngPath, psdPath, copy } = req.body || {};
    const brand = db.prepare('SELECT * FROM brands WHERE id = ?').get(brand_id || 'vega');
    if (!brand) return res.status(404).json({ error: 'Marka bulunamadi' });
    const qa = await evaluateDesign({ pngPath, brand, copy });
    let autoFixed = false;
    if (!qa.passed && psdPath && qa.autoFixInstruction) {
      await revisePhotoshopLayer({ psdPath, instruction: qa.autoFixInstruction });
      autoFixed = true;
    }
    res.json({ ok: true, autoFixed, ...qa });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/memory/youtube', async (req, res) => {
  try {
    const { url, topic } = req.body || {};
    const extracted = await extractYoutubeRecipe({ url, topic });
    const id = 'rec-' + crypto.randomBytes(3).toString('hex');
    db.prepare(`
      INSERT INTO recipes (id, title, source_url, source_type, steps_count, steps_json)
      VALUES (?, ?, ?, 'youtube', ?, ?)
    `).run(id, extracted.title, url || '', extracted.steps.length, JSON.stringify(extracted.steps));
    const created = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
    res.status(201).json({ ok: true, mode: extracted.mode, recipe: created, steps: extracted.steps });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/memory/trends', async (req, res) => {
  try {
    const { sector, sources } = req.body || {};
    const result = await researchTrends({ sector: sector || 'Genel', sources });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`AjansOS Backend calisiyor: http://localhost:${PORT}`);
});
