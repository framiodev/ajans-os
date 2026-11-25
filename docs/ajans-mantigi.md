# AjansOS — Ajans Mantığı (v0.1)

Hedef: AjansOS bir "tasarım üreten yapay zekâ" olmasın; **bir ajansın çalışma düzenini** taşısın. Gerçek bir ajansta tasarım, işin yalnızca bir halkasıdır. Marka, strateji, metin, onay, revizyon, teslim ve hafıza olmadan üretilen her tasarım tek seferlik kalır.

Bu belge mantığı tanımlar. Kod bu mantığa göre kademeli büyür (Bölüm 9).

---

## 1. Temel ilkeler

1. **Müşteri → iş kalemi → çıktı.** Her şey bir müşteri markasına ve bir iş kalemine (deliverable) bağlıdır. Başıboş tasarım yoktur.
2. **Roller, tek tek yetenekler değil, sorumluluklardır.** Her rolün girdisi, çıktısı ve "bitti" ölçütü vardır.
3. **Kapılar vardır.** Dışarı çıkan hiçbir şey (müşteriye gönderim, yayın) insan onayı olmadan gitmez. Otonomluk iş türüne göre kademeli açılır.
4. **Hafıza marka bazlıdır.** Onaylanan, reddedilen, düzeltilen her şey o markanın kuralı olarak kalır ve sonraki işi etkiler.
5. **Dürüst ölçüm.** Ölçülmeyen şey "ölçülmedi" yazar. Uydurma puan yok.
6. **Süreklilik > tekil güzellik.** Bir markanın feed'i bütün olarak tutarlı olmalı; tek bir gönderi iyi görünüp markanın dilini bozmamalı.

## 2. Roller

Hepsi tek program içindeki modüllerdir; aynı müşteri ve iş kalemi verisini paylaşırlar. Kullanıcı (ajans sahibi) her rolün üstündedir.

| Rol | Sorumluluk | Çıktısı | Bitti ölçütü |
|---|---|---|---|
| **Hesap yöneticisi** | Brief'i alır, eksikleri sorar, kapsam/teslim tarihi/onay kapılarını yönetir, müşteri mesaj taslağı yazar | Netleştirilmiş brief, teslim tarihi, müşteri mesajı taslağı | Brief'te hedef, kitle, format, tarih, kısıt dolu |
| **Stratejist** | Konumlandırma, hedef kitle, içerik sütunları, aylık/haftalık plan, sektör notu | İçerik planı (takvim), sütun dağılımı | Plan onaylandı; her kalem bir sütuna ve hedefe bağlı |
| **Metin yazarı** | Başlık, alt metin, CTA, caption, etiketler; ton ve Türkçe dil denetimi | Metin seti (tek mesaj, tek odak) | Metin kuralları (uzunluk, ton, imla) geçti |
| **Sanat yönetmeni** | Görsel yön, düzen (tarif) seçimi, marka dilinin sürekliliği, referans analizi, "şablon görünümü" kontrolü | Görsel yön notu, seçilen tarif, varyasyon planı | Marka diline uygun, son N işten farklı ritimde |
| **Tasarımcı (prodüksiyon)** | Photoshop'ta üretim, revizyon uygulama | Katmanlı PSD + PNG | Üretim hatasız, katmanlar düzenli |
| **Kalite / prodüksiyon müdürü** | PSD hijyeni, metin kuralları, görsel kalite, marka uyumu; kapıyı açar veya geri çevirir | Denetim raporu (geçti/kaldı + nedenler) | Kritik hata yok; ölçülmeyenler açıkça belirtilmiş |
| **Sosyal medya yöneticisi** | Yayın takvimi, zaman, son caption, (ileride) yayın | Yayın planı | Onaylı içerik doğru zamanda planlı |
| **Analist** | Sonuçları kaydeder, neyin işe yaradığını hafızaya yazar | Aylık özet, öğrenilenler | Sonuçlar iş kalemine bağlı |

## 3. İş kalemi yaşam döngüsü

Bir iş kalemi (ör. "Vega — Kariyer Fırsatı postu") şu aşamalardan geçer:

```
Brief → Kapsam onayı → Plan/Fikir → Metin → Tasarım → İç denetim → Revizyon → Müşteri onayı → Teslim/Yayın → Sonuç
```

| Aşama | Sahibi | Girdi | Çıkış ölçütü | İnsan onayı |
|---|---|---|---|---|
| Brief | Hesap | Müşteri talebi | Brief alanları dolu | Hayır (eksik varsa sorar) |
| Kapsam onayı | Hesap | Brief | Adet, format, tarih net | **Evet** |
| Plan/Fikir | Stratejist + Sanat | Marka hafızası, takvim | Fikir bir sütuna bağlı | **Evet** (ilk aşamada) |
| Metin | Metin yazarı | Fikir | Metin kuralları geçti | Evet |
| Tasarım | Sanat + Tasarımcı | Metin, tarif, varlıklar | PSD üretildi | Hayır |
| İç denetim | Kalite | PSD/PNG | Kritik hata yok | Hayır (kaldıysa geri döner) |
| Revizyon | Tasarımcı | Denetim/yorum | Düzeltme doğrulandı | Hayır |
| Müşteri onayı | Hesap | Onaylı iç çıktı | Müşteri "onay" dedi | **Evet** (müşteri) |
| Teslim/Yayın | Sosyal medya | Onaylı dosya | Teslim/yayın kaydı | **Evet** |
| Sonuç | Analist | Performans | Hafızaya yazıldı | Hayır |

**Durumlar:** `taslak` · `üretimde` · `iç denetimde` · `revizyonda` · `müşteri onayında` · `onaylandı` · `teslim edildi` · `yayınlandı` · `arşiv`.

**Geri dönüş kuralları**
- İç denetim kritik hatada kalırsa iş **Tasarım**'a döner; en fazla 2 otomatik tur, sonra kullanıcıya sorulur.
- Müşteri yorumu sınıflandırılır: **metin**, **görsel**, **kapsam dışı**. Kapsam dışı yorum ücretli/yeni iş kalemi olarak işaretlenir.
- Her geri dönüş sebebiyle kaydedilir (hafıza için).

## 4. Marka hafızası

Her marka için tutulur ve her iş başlarken okunur:

- **Kimlik özeti:** renk, font, ton, yasaklı sözcükler, yasaklı görsel tarzlar.
- **Görsel dil:** tercih edilen tarif ailesi, vurgu rengi kullanımı, boşluk/ritim tercihleri.
- **Geçmiş:** onaylanan işler, reddedilenler ve **nedenleri**, müşterinin sık yaptığı düzeltmeler.
- **Kurallar (öğrenilmiş):** "Başlık 3 satırı geçmesin", "Kırmızıyı CTA dışında kullanma" gibi, kaynağı kayıtlı kurallar. Kural eklemek insan onayından geçer.

## 5. Süreklilik ve ritim (feed mantığı)

- Aynı markanın ardışık gönderileri aynı düzeni tekrarlamaz; ama aynı **ailede** kalır (tarif ailesi + renk disiplini).
- 9'lu grid kuralı: yan yana üç gönderinin vurgu/açık-koyu dengesi bozulmaz.
- Şablon görünümü kontrolü: son N işin düzen parmak iziyle benzerlik ölçülür; çok benzerse Sanat yönetmeni varyasyon önerir.

## 6. Otonomluk seviyeleri (iş türüne göre ayrı)

| Seviye | Davranış |
|---|---|
| 1 | Taslak üretir; her adım onaya gelir |
| 2 | Planı kurar; kullanıcı onaylar |
| 3 | Onaylı planı uygular, işleri hazırlar |
| 4 | Düşük riskli rutin işleri kendisi hazırlar (ör. rutin story'ler); yine de dışarı onayla çıkar |

Marka kimliği ve fiyat/teklif konuları en son otomatikleştirilir.

## 7. Kalite kapıları

İç denetim üç ayrı ölçümden oluşur; hiçbiri uydurulmaz:

1. **Metin kuralları** (kodla ölçülür): uzunluk, imla, yasaklı sözcük, tek mesaj.
2. **PSD hijyeni** (Photoshop'tan okunan gerçek katman ağacı): canlı metin, adlandırma, gruplama, font, güvenli alan, boş/gizli katman.
3. **Görsel denetim** (yalnızca anahtar ve PNG varsa): hiyerarşi, kontrast, marka uyumu. Ölçülmediyse "ölçülmedi".

Kapı: kritik hata yok + ölçülenlerde eşik geçildi. Geçmeyen iş müşteriye gitmez.

## 8. Kapasite ve zaman (tek kişilik ajans)

- Her iş kalemi için süre tahmini ve teslim tarihi vardır.
- **"Bugün"** ekranı: bugün teslim, onay bekleyen, revizyondaki ve geciken işler.
- Haftalık kapasite uyarısı: planlanan iş yükü kapasiteyi aşıyorsa uyarı.

## 9. Uygulamaya yansıması

### Mevcut kodla eşleme

| Rol | Bugünkü karşılığı |
|---|---|
| Stratejist | `aiProvider` strateji üretimi + `validateStrategy` |
| Metin yazarı | `lintCopy` (metin kuralları) |
| Sanat yönetmeni | Tarif seçimi (`chooseRecipe`), tarif şeması (`recipes.mjs`) |
| Tasarımcı | Photoshop köprüsü, tarif derleyicisi |
| Kalite | PSD hijyen lint + Gemini görsel denetim |
| Hafıza | Henüz yok (Bölüm 4) |
| İş kalemi / pano / onay | Henüz yok |

### Veri modeli (öneri)

`clients`(müşteri/marka) · `work_items`(id, brand_id, başlık, format, aşama, durum, sahibi_rol, teslim_tarihi, plan_id) · `stage_log`(work_item_id, aşama, kim, ne zaman, not) · `approvals`(work_item_id, kapı, karar, yorum) · `feedback`(work_item_id, sınıf, metin, çözüldü_mü) · `brand_rules`(brand_id, kural, kaynak, onaylı_mı) · `assets` · `outputs`(work_item_id, psd, png, tarif, lint_sonucu).

### Ekranlar

**Bugün** · **İş panosu** (aşamalara göre sütunlar) · **Müşteriler & Marka hafızası** · **Stüdyo** (mevcut) · **Takvim/Feed** · **Raporlar**.

### Aşamalar

| Aşama | İçerik |
|---|---|
| A1 | İş kalemi tablosu + API + İş panosu; Stüdyo çıktısı bir iş kalemine bağlanır |
| A2 | Onay kapıları, geri bildirim kaydı, marka kuralları (hafıza) |
| A3 | Takvim + feed planlayıcı + şablon-benzerlik kontrolü |
| A4 | Müşteri raporu ve teklif şablonları |
| A5 | Öğrenme döngüsü: videodan/görselden tarif öğrenme (R3–R4), kullanıcı düzeltmelerinden öğrenme |

## 10. Açık sorular

1. Şu an kaç müşteri/marka var, aylık kaç çıktı üretiliyor?
2. Müşteri onayı nasıl alınıyor (WhatsApp, e-posta, panel)? Uygulama onay bağlantısı üretsin mi?
3. Hangi platformlar: yalnız Instagram mı, LinkedIn/TikTok da var mı?
4. Paketler/fiyatlar sistem içinde izlenecek mi (teklif ve rapor için)?
5. Teslim biçimi: PSD mi, PNG/JPG mi, planlı yayın mı?
