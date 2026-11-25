# FramioMedia — AjansOS Studio

Sosyal medya içerik planlama ve Adobe Photoshop ile katmanlı PSD üretimi. Yol haritası: `claude/ajans-os-revizyon-plani.md` (Claude Project dokümanı).

## Klasörler
- `frontend/` — React + TypeScript + Tailwind (geliştirmede `http://localhost:4000`)
- `backend/` — Node.js + Express + SQLite (`node:sqlite`; geliştirmede `http://127.0.0.1:4010`)
- `mcp-servers/adobe-mcp/` — Photoshop / Illustrator köprüleri (ExtendScript; UXP köprüsüne geçiliyor)
- `design-memory/` — başlangıç eğitim kaynağı başlıkları
- `electron/` — masaüstü kabuğu (paketli sürüm `http://127.0.0.1:4190`)

## Geliştirme
Gereksinim: Node.js **22.13 veya üzeri**.
1. `npm ci` (kök), `cd backend && npm ci`, `cd frontend && npm ci`
2. `start-ajansos.bat` (Windows) veya iki terminalde `backend: npm start`, `frontend: npm run dev`
3. Testler: `npm test` (backend), tip denetimi: `cd frontend && npm run typecheck`

API anahtarları (Gemini, Claude) uygulamada **API Bağlantıları** ekranından girilir; yerel veritabanında saklanır.
