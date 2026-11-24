import { db } from '../db.mjs';

const FORMATS = ['Post 4:5', 'Story 9:16', 'Carousel', 'Reels Fikri'];
const MODEL_RE = /^[A-Za-z0-9._:-]{3,80}$/;

function getModel(key, fallback) {
  const v = getSetting(key);
  return MODEL_RE.test(v) ? v : fallback;
}

// Metinden ilk dengeli JSON nesnesini çıkarır (açgözlü regex yerine).
export function extractJson(text) {
  const t = String(text || '');
  try { return JSON.parse(t); } catch {}
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(t.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

const str = (v, n) => String(v ?? '').slice(0, n);

// Model çıktısı şema doğrulamasından geçmeden veritabanına girmez.
export function validateStrategy(obj) {
  if (!obj || typeof obj !== 'object' || !Array.isArray(obj.items)) return null;
  const items = [];
  for (const it of obj.items.slice(0, 40)) {
    if (!it || typeof it !== 'object') continue;
    const title = str(it.title, 120).trim();
    const day = Math.round(Number(it.day));
    if (!title || !Number.isFinite(day) || day < 1 || day > 31) continue;
    items.push({
      day,
      format: FORMATS.includes(it.format) ? it.format : 'Post 4:5',
      topic: str(it.topic, 160), eyebrow: str(it.eyebrow, 60), title,
      desc: str(it.desc, 300), cta: str(it.cta, 60), goal: str(it.goal, 80)
    });
  }
  if (!items.length) return null;
  return { summary: str(obj.summary, 600), items };
}

async function postJson(url, headers, body, { retries = 1, timeoutMs = 90000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return await res.json();
      lastErr = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) break;
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw lastErr;
}

function logCost({ provider, model, input, output, purpose, brandId }) {
  try {
    db.prepare('INSERT INTO cost_ledger (provider, model, input_tokens, output_tokens, purpose, brand_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(provider, model, Number(input) || 0, Number(output) || 0, purpose, brandId || '');
  } catch {}
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value.trim() : '';
}

function buildOfflineStrategy(brand, brief, reason = '') {
  const sector = brand.sector || 'Genel';
  const name = brand.name || 'Marka';
  const tone = brand.tone || 'Profesyonel';

  const items = [
    { day: 1, format: 'Post 4:5', topic: `${name} — Marka Tanıtım & Değer Önerisi`, eyebrow: 'YENİ DÖNEM', title: `${name} ile Standartları Yükselt.`, desc: `${sector} alanında ${tone.toLowerCase()} yaklaşımımızla fark yaratıyoruz.`, cta: 'Detaylı Bilgi →', goal: 'Marka Bilinirliği' },
    { day: 3, format: 'Story 9:16', topic: 'Hızlı Anket & Hedef Kitle Etkileşimi', eyebrow: 'SİZCE HANGİSİ?', title: 'Önceliğiniz Hangisi?', desc: 'Kısa anketimize katılın, size özel önerimizi hemen paylaşalım.', cta: 'Oyla →', goal: 'Etkileşim' },
    { day: 6, format: 'Carousel', topic: `${sector} Sektöründe Bilinmesi Gereken 5 Kritik Nokta`, eyebrow: 'REHBER', title: 'Doğru Karar İçin 5 İpucu.', desc: 'Kaydedip daha sonra tekrar inceleyebileceğiniz uzman rehberi.', cta: 'Kaydet & Paylaş', goal: 'Kaydetme / Otorite' },
    { day: 9, format: 'Post 4:5', topic: brief ? `Özel Brief: ${brief.slice(0, 60)}` : `${name} Özel Kampanya / Fırsat`, eyebrow: 'ÖZEL FIRSAT', title: 'Şimdi Harekete Geçme Zamanı.', desc: 'Sınırlı süreli avantajlarımız ve profesyonel desteğimizle yanınızdayız.', cta: 'Hemen Başvur →', goal: 'Dönüşüm / Lead' },
    { day: 12, format: 'Story 9:16', topic: 'Sahne Arkası & Ekip Kültürü', eyebrow: 'SAHNE ARKASI', title: 'İşimizin Mutfağından.', desc: 'Her detayda kaliteyi nasıl koruduğumuzu yakından görün.', cta: 'DM Gönder →', goal: 'Güven İnşası' },
    { day: 15, format: 'Reels Fikri', topic: '30 Saniyede Sık Sorulan Sorular', eyebrow: 'SSS', title: 'En Çok Merak Edilenler.', desc: 'Müşterilerimizden gelen en popüler 3 soruyu net şekilde yanıtladık.', cta: 'Yorumda Sor →', goal: 'Erişim (Reach)' },
    { day: 18, format: 'Post 4:5', topic: 'Müşteri Deneyimi & Sosyal Kanıt', eyebrow: 'REFERANS', title: 'Gerçek Sonuçlar, Gerçek Memnuniyet.', desc: `${name} ile çalışan müşterilerimizin deneyimleri.`, cta: 'İncele →', goal: 'Güven & Satış' },
    { day: 21, format: 'Carousel', topic: 'Adım Adım Süreç Nasıl İşler?', eyebrow: 'SÜREÇ', title: '3 Adımda Kusursuz Deneyim.', desc: 'İlk görüşmeden teslimata kadar şeffaf ve hızlı çalışma modelimiz.', cta: 'Randevu Al →', goal: 'Lead Toplama' },
    { day: 25, format: 'Story 9:16', topic: 'Hafta Sonu / Ay Sonu Hatırlatma', eyebrow: 'HATIRLATMA', title: 'Kontenjan Dolmadan Yerinizi Ayırtın.', desc: 'Bu ayki özel planlamamız için son günler.', cta: 'Hemen İletişime Geç →', goal: 'Aciliyet / Dönüşüm' },
    { day: 29, format: 'Post 4:5', topic: 'Ay Özeti & Yeni Ay Vizyonu', eyebrow: 'ÖZET', title: 'Birlikte Daha Güçlü Bir Ay.', desc: `${name} olarak gelecek ay yeni projelerle karşınızdayız.`, cta: 'Takip Et →', goal: 'Topluluk' }
  ];

  return {
    mode: 'offline',
    summary: `${name} (${sector}) için ${tone.toLowerCase()} tonda, bilinirlik + güven + dönüşüm odaklı 30 günlük ajans içerik stratejisi oluşturuldu. ${reason ? `(Çevrimdışı şablon: ${reason})` : '(Çevrimdışı şablon: API anahtarı girilmedi.)'}`,
    items
  };
}

export async function generateStrategyAndCalendar({ brand, brief }) {
  const claudeKey = getSetting('claude_api_key');
  const geminiKey = getSetting('gemini_api_key');

  const prompt = `Sen kıdemli bir dijital reklam ajansı stratejistisin.
Marka: ${brand.name}
Sektör: ${brand.sector}
Ton: ${brand.tone}
Marka Kuralları (.md Rehber):
${brand.brand_guidelines_md || 'Belirtilmedi — sektör standartlarını uygula.'}

Brief: ${brief || '1 aylık sosyal medya içerik stratejisi ve örnek gönderiler.'}

Sadece geçerli JSON döndür:
{
  "summary": "2 cümlelik strateji özeti",
  "items": [
    { "day": 1, "format": "Post 4:5 | Story 9:16 | Carousel | Reels Fikri", "topic": "...", "eyebrow": "...", "title": "...", "desc": "...", "cta": "...", "goal": "..." }
  ]
}
Ayın 1-30. günlerine yayılmış 10 adet yüksek kaliteli Türkçe içerik üret. Başlık en fazla 60, açıklama en fazla 140, CTA en fazla 28 karakter olsun. Kaynağını bilmediğin istatistik veya rakam yazma.`;

  const failures = [];

  if (claudeKey) {
    const model = getModel('claude_model', 'claude-sonnet-5-5');
    try {
      const data = await postJson('https://api.anthropic.com/v1/messages', { 'x-api-key': claudeKey, 'anthropic-version': '2023-06-01' },
        { model, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] });
      logCost({ provider: 'anthropic', model, input: data.usage?.input_tokens, output: data.usage?.output_tokens, purpose: 'strategy', brandId: brand.id });
      if (data.stop_reason === 'max_tokens') throw new Error('yanıt kesildi (max_tokens)');
      const parsed = validateStrategy(extractJson(data.content?.[0]?.text));
      if (!parsed) throw new Error('yanıt şemaya uymuyor');
      return { mode: 'claude', ...parsed };
    } catch (err) {
      failures.push(`Claude: ${err.message}`);
      console.error('Claude API hatasi:', err.message);
    }
  }

  if (geminiKey) {
    const model = getModel('gemini_model', 'gemini-2.5-flash');
    try {
      const data = await postJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { 'x-goog-api-key': geminiKey },
        { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8000 } });
      logCost({ provider: 'google', model, input: data.usageMetadata?.promptTokenCount, output: data.usageMetadata?.candidatesTokenCount, purpose: 'strategy', brandId: brand.id });
      if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new Error('yanıt kesildi (MAX_TOKENS)');
      const parsed = validateStrategy(extractJson(data.candidates?.[0]?.content?.parts?.[0]?.text));
      if (!parsed) throw new Error('yanıt şemaya uymuyor');
      return { mode: 'gemini', ...parsed };
    } catch (err) {
      failures.push(`Gemini: ${err.message}`);
      console.error('Gemini API hatasi:', err.message);
    }
  }

  return { ...buildOfflineStrategy(brand, brief, failures.join('; ')), failures };
}
