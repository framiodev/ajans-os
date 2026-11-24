import { db } from '../db.mjs';

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value.trim() : '';
}

function buildOfflineStrategy(brand, brief) {
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
    summary: `${name} (${sector}) için ${tone.toLowerCase()} tonda, bilinirlik + güven + dönüşüm odaklı 30 günlük ajans içerik stratejisi oluşturuldu. (API anahtarları eklendiğinde Claude & Gemini canlı üretim yapacaktır.)`,
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
    { "day": 1, "format": "Post 4:5", "topic": "...", "eyebrow": "...", "title": "...", "desc": "...", "cta": "...", "goal": "..." }
  ]
}
Toplam 8-10 adet (1 aya yayılmış) yüksek kaliteli Türkçe içerik üret.`;

  if (claudeKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': claudeKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-7-sonnet-latest',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.content?.[0]?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          return { mode: 'claude', summary: parsed.summary || '', items: parsed.items || [] };
        }
      }
    } catch (err) {
      console.error('Claude API hatasi, offline moda geciliyor:', err.message);
    }
  }

  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = JSON.parse(text);
        return { mode: 'gemini', summary: parsed.summary || '', items: parsed.items || [] };
      }
    } catch (err) {
      console.error('Gemini API hatasi, offline moda geciliyor:', err.message);
    }
  }

  return buildOfflineStrategy(brand, brief);
}
