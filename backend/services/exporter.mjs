export function buildCalendarCsv(brand, items) {
  const header = ['Gun', 'Format', 'Konu', 'Ust Etiket', 'Baslik', 'Aciklama', 'CTA', 'Hedef'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = items.map(it =>
    [it.day, it.format, it.topic, it.eyebrow, it.title, it.desc, it.cta, it.goal].map(escape).join(';')
  );
  // UTF-8 BOM for Microsoft Excel Turkish character support
  return '\uFEFF' + [header.join(';'), ...rows].join('\r\n');
}

export function buildProposalHtml(brand, summary, items) {
  const rowsHtml = items
    .map(
      it => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-family:monospace;">Gün ${String(it.day).padStart(2, '0')}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;"><strong>${it.format}</strong></td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${it.topic}<br/><small style="color:#64748b;">${it.title}</small></td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${it.goal}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <title>${brand.name} — Sosyal Medya Strateji & Teklif Sunumu</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 40px; background: #f8fafc; }
    .page { max-width: 900px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .hero { background: linear-gradient(135deg, ${brand.primary_color}, ${brand.secondary_color}); color: #fff; padding: 48px 40px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,0.15); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
    .content { padding: 40px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 16px; }
    th { text-align: left; padding: 10px; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; }
    .print-btn { position: fixed; top: 20px; right: 20px; background: #4f46e5; color: #fff; border: none; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    @media print { .print-btn { display: none; } body { padding: 0; background: #fff; } .page { box-shadow: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">PDF Olarak Kaydet / Yazdır</button>
  <div class="page">
    <div class="hero">
      <div class="badge">FramioMedia • Dijital Strateji & Tasarım Teklifi</div>
      <h1 style="margin:16px 0 8px;font-size:32px;">${brand.name}</h1>
      <p style="margin:0;opacity:0.85;font-size:15px;">${brand.sector} • 1 Aylık Sosyal Medya İçerik Stratejisi & Kreatif Paket</p>
    </div>
    <div class="content">
      <h2 style="margin-top:0;">Strateji Özeti</h2>
      <p style="line-height:1.6;color:#334155;">${summary || `${brand.name} için sektör ve rakip analizine dayalı 30 günlük yüksek dönüşümlü sosyal medya içerik planı.`}</p>
      <h2 style="margin-top:32px;">30 Günlük İçerik Takvimi</h2>
      <table>
        <thead><tr><th>Gün</th><th>Format</th><th>Konu & Başlık</th><th>Hedef</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <p style="margin-top:32px;font-size:12px;color:#64748b;">Bu sunum FramioMedia AjansOS Studio tarafından otomatik olarak hazırlanmıştır.</p>
    </div>
  </div>
</body>
</html>`;
}
