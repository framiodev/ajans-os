# FramioMedia — AjansOS Studio

Yapay zeka destekli tam otomatik reklam ajansı ve Adobe Photoshop / Illustrator / Firefly MCP platformu.

## Klasör Yapısı
- `frontend/` — React + TypeScript + Tailwind CSS (AjansOS Studio arayüzü, `http://localhost:4000`)
- `backend/` — Node.js + Express + SQLite (Strateji, Vision QA, Trend Araştırması, Excel/PDF İhracat, `http://localhost:4010`)
- `mcp-servers/adobe-mcp/` — Windows COM + ExtendScript üzerinden Adobe Photoshop & Illustrator MCP köprüleri ve Adobe Firefly servisi
- `design-memory/` — YouTube eğitimlerinden çıkarılan JSON tasarım reçeteleri
- `storage/` — SQLite veritabanı (`ajansos.db`) ve üretilen PSD, AI, PNG, CSV, PDF çıktıları (`storage/outputs/`)

## Hızlı Başlatma
1. `start-ajansos.bat` dosyasına çift tıklayın.
2. Tarayıcı otomatik olarak `http://localhost:4000` adresinde **AjansOS Studio**'yu açacaktır.
3. Canlı yapay zeka moduna geçmek için sol menüden **MCP & API Bağlantıları** ekranına **Gemini**, **Claude** ve **Adobe Firefly** API anahtarlarınızı girip kaydedin.
