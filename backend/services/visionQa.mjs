import fs from 'node:fs/promises';
import { db } from '../db.mjs';

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value.trim() : '';
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n))));

// Ölçülebilir metin kuralları. Görsel kalite hakkında hiçbir şey iddia etmez.
export function lintCopy(copy = {}) {
  const title = String(copy.title || '');
  const desc = String(copy.desc || '');
  const cta = String(copy.cta || '');
  const checks = [
    { id: 'title_present', label: 'Başlık dolu', ok: title.trim().length > 0, critical: true },
    { id: 'title_len', label: 'Başlık ≤ 60 karakter', ok: title.length <= 60, critical: false, detail: `${title.length} karakter` },
    { id: 'desc_len', label: 'Açıklama ≤ 140 karakter', ok: desc.length <= 140, critical: false, detail: `${desc.length} karakter` },
    { id: 'cta_present', label: 'CTA dolu', ok: cta.trim().length > 0, critical: false },
    { id: 'cta_len', label: 'CTA ≤ 28 karakter', ok: cta.length <= 28, critical: false, detail: `${cta.length} karakter` }
  ];
  return checks;
}

// Model çıktısını şemaya göre doğrular; toplam her zaman kodda hesaplanır.
export function parseVisionResult(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const dims = ['typography', 'contrast', 'grid', 'brandFit'];
  const out = {};
  for (const d of dims) {
    const v = Number(obj[d]);
    if (!Number.isFinite(v)) return null;
    out[d] = clamp(v);
  }
  out.total = clamp(dims.reduce((a, d) => a + out[d], 0) / dims.length);
  out.critique = String(obj.critique || '').slice(0, 600);
  out.autoFixInstruction = String(obj.autoFixInstruction || '').slice(0, 300);
  return out;
}

export async function evaluateDesign({ pngPath, brand, copy }) {
  const checks = lintCopy(copy);
  const failedCritical = checks.some(c => c.critical && !c.ok);
  const failedAny = checks.filter(c => !c.ok);
  const geminiKey = getSetting('gemini_api_key');

  const base = { checks, visionAvailable: false };

  if (!pngPath) {
    return {
      ...base,
      mode: 'copy_lint',
      passed: failedCritical ? false : null, // görsel değerlendirilmediği için "geçti" denmez
      total: null,
      breakdown: null,
      critique: failedAny.length
        ? `Metin kuralları: ${failedAny.map(c => `${c.label}${c.detail ? ` (${c.detail})` : ''}`).join('; ')} sağlanmadı.`
        : 'Metin kuralları sağlandı. Görsel kalite ölçülmedi: önce PSD üretip PNG ile tekrar çalıştırın.',
      autoFixInstruction: ''
    };
  }

  if (!geminiKey) {
    return {
      ...base,
      mode: 'no_vision_key',
      passed: null,
      total: null,
      breakdown: null,
      critique: 'Görsel değerlendirme için Gemini API anahtarı gerekli (Bağlantılar sekmesi).',
      autoFixInstruction: ''
    };
  }

  try {
    const imgBuf = await fs.readFile(pngPath);
    const prompt = `Sen kıdemli bir sosyal medya Kreatif Direktörüsün. Ekteki tasarımı (${brand.name} - ${brand.sector}) dört ölçütte 0-100 arası puanla: typography (tipografi ve hiyerarşi), contrast (okunabilirlik/kontrast), grid (yerleşim ve boşluk), brandFit (marka uyumu).
Dürüst ol: sorun varsa düşük puan ver. Sadece JSON döndür, alanlar: typography, contrast, grid, brandFit (sayı), critique (2 cümle Türkçe, somut), autoFixInstruction (düzeltme gerekiyorsa tek cümlelik Photoshop komutu, yoksa boş string).`;
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: 'image/png', data: imgBuf.toString('base64') } }] }],
        generationConfig: { responseMimeType: 'application/json' }
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
    const data = await res.json();
    const parsed = parseVisionResult(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
    if (!parsed) throw new Error('Model yanıtı şemaya uymuyor');
    return {
      ...base,
      visionAvailable: true,
      mode: 'gemini_vision',
      passed: !failedCritical && parsed.total >= 80,
      total: parsed.total,
      breakdown: { typography: parsed.typography, contrast: parsed.contrast, grid: parsed.grid, brandFit: parsed.brandFit },
      critique: parsed.critique,
      autoFixInstruction: parsed.total < 80 ? parsed.autoFixInstruction : ''
    };
  } catch (err) {
    return {
      ...base,
      mode: 'vision_error',
      passed: null,
      total: null,
      breakdown: null,
      critique: `Görsel değerlendirme yapılamadı: ${err.message}`,
      autoFixInstruction: ''
    };
  }
}
