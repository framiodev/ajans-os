import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.AJANSOS_DATA_DIR || path.resolve(__dirname, '../storage');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'ajansos.db');

export const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sector TEXT NOT NULL,
    tone TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    font_family TEXT NOT NULL,
    website TEXT DEFAULT '',
    brand_guidelines_md TEXT DEFAULT '',
    assets_dir TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    title TEXT NOT NULL,
    brief TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    qa_score INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    source_url TEXT DEFAULT '',
    source_type TEXT DEFAULT 'youtube',
    steps_count INTEGER DEFAULT 10,
    steps_json TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS strategy_items (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    day INTEGER NOT NULL,
    format TEXT NOT NULL,
    topic TEXT NOT NULL,
    eyebrow TEXT DEFAULT '',
    title TEXT DEFAULT '',
    desc TEXT DEFAULT '',
    cta TEXT DEFAULT '',
    goal TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe schema migration for existing databases
try { db.exec("ALTER TABLE brands ADD COLUMN brand_guidelines_md TEXT DEFAULT ''"); } catch {}
try { db.exec("ALTER TABLE brands ADD COLUMN assets_dir TEXT DEFAULT ''"); } catch {}

// Seed initial brands if empty
const brandCount = db.prepare('SELECT COUNT(*) as c FROM brands').get().c;
if (brandCount === 0) {
  const insertBrand = db.prepare(`
    INSERT INTO brands (id, name, sector, tone, primary_color, secondary_color, accent_color, font_family, website)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertBrand.run('vega', 'Vega Gayrimenkul', 'Gayrimenkul & Yatırım', 'Güven veren, prestijli, net', '#0B1120', '#172554', '#D4AF37', 'Montserrat / Inter', 'vegagayrimenkul.com');
  insertBrand.run('nefis', 'Nefis Ocakbaşı', 'Restoran & Gastronomi', 'İştah açıcı, sıcak, davetkar', '#431407', '#7C2D12', '#FDE68A', 'Playfair Display / Lato', 'nefisocakbasi.com');
  insertBrand.run('aura', 'Aura Dental Klinik', 'Sağlık & Estetik Diş', 'Bilgilendirici, ferah, güvenilir', '#083344', '#0E7490', '#E0F2FE', 'Plus Jakarta Sans', 'auradental.com');
}

// Seed curated YouTube design recipes (11 Turkish & Global channels incl. Hasan Can Keleş)
try {
  const ytSeedPath = path.resolve(__dirname, '../design-memory/youtube_design_recipes.json');
  if (fs.existsSync(ytSeedPath)) {
    const ytRecipes = JSON.parse(fs.readFileSync(ytSeedPath, 'utf8'));
    const insRec = db.prepare(`
      INSERT OR IGNORE INTO recipes (id, title, source_url, source_type, steps_count, steps_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const r of ytRecipes) {
      insRec.run(r.id, r.title, r.source_url || '', r.source_type || 'youtube', (r.steps || []).length, JSON.stringify(r.steps || []));
    }
  }
} catch {}

// Seed default settings
const defaultSettings = [
  ['gemini_api_key', ''],
  ['claude_api_key', ''],
];
const upsertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of defaultSettings) {
  upsertSetting.run(k, v);
}
