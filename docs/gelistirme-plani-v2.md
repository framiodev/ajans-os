# AjansOS — Geliştirme Planı v2 (faz faz)

Tarih: 2026-11-25 · Durum: R0, R1 ve R2'nin ilk sürümü bitti (v1.5.2). Bu plan `ajans-os-revizyon-plani.md` (R0–R6) ve `ajans-mantigi.md` belgelerini birleştirir ve **marka klasörü + Firefly + kalite-öncelikli üretim** kararlarını ekler.

## 0. İlke: hız değil kalite

Hedef "hızlı sonuç" değil, **makul sürede iyi tasarım**. Bunun için üretim hattı tek atış yerine şu döngüyü izler:

```
Brief → Sanat yönetimi (yön + düzen seçimi) → 2–3 aday üret → Denetle (kod + model) → En iyiyi seç/iyileştir → Kullanıcıya sun → Revize → Onay
```

- Süre bütçesi vardır (ör. bir görsel için 2–5 dk kabul edilir), ama her aday **gerçek Photoshop çıktısı** ve gerçek ölçümle değerlendirilir.
- Ölçülmeyen şey "ölçülmedi" yazar. Uydurma puan yok.
- Üretilen her görselin (yapay zekâ dahil) kaynağı ve lisans notu kayıtlıdır.

## 1. Bugünkü durum

**Çalışan:** güncelleme mekanizması, Photoshop köprüsü (PS 28), 3 tarif, şekil/etiket/buton, gerçek önizleme ve katman ağacı, PSD hijyen denetimi, revize (katman adresli).

**Eksikler (genel):**
| Alan | Eksik |
|---|---|
| Üretim girişi | Serbest prompt yok; yalnızca hazır strateji kalemi |
| Marka | Logo, font, renk kiti, marka görselleri klasörü yok; tarifler markaya özgü örneklenmiyor |
| Görsel işleme | Fotoğraf yerleştirme PS'de denenmedi; konu kesme, gölge, gradient, ok yok; Firefly yok |
| Tasarım kalitesi | 3 tarif, hepsi düz renk + metin; alt blok boşlukları; tek yazı ailesi; tek aday |
| Format | Post/Story/LinkedIn ayrı üretiliyor; tek tasarımdan uyarlama yok; carousel yok |
| Yapay zekâ | Gemini/Claude anahtarı yok; maliyet sayacı yok; çok adaylı üretim ve öz-eleştiri yok |
| Öğrenme | Referans/video/elle düzeltme öğrenicisi yok |
| Ajans mantığı | İş kalemi, onay kapısı, marka hafızası, müşteri yönetimi yok |
| Altyapı | Tasarım sürüm geçmişi yok; dışa aktarma paketi (PNG/JPG/PDF) sınırlı; eklenti paketli (.ccx) değil, UDT ile yükleniyor; kurulum imzasız; frontend tek dosya (App.tsx) |
| Ürünleşme | Çok kullanıcı, lisans, KVKK, font ve görsel lisansı takibi yok |

## 2. Marka klasörü (Brand Vault) — mimari karar

Her marka için diskte bir klasör, uygulamanın kendi veri alanında:

```
AjansOSData/brands/<marka-id>/
  brand.json              kurumsal kimlik (renk rolleri, fontlar, ton, yasaklar, logo kuralları)
  logo/                   logo dosyaları (SVG/PNG, açık-koyu, ikon)
  fonts/                  marka fontları (varsa; lisans notu ile)
  photos/                 marka fotoğrafları (ürün, mekân, ekip; etiketli)
  references/             beğenilen referans görseller/PSD'ler
  generated/              Firefly ve uygulama üretimi görseller (kaynak + lisans notu ile)
  designs/                üretilen PSD/PNG çıktıları, sürümlü
  memory.json             onay/ret geçmişi, öğrenilmiş kurallar
```

- Uygulama klasörü **tarar** ve `brand.json` ile varlık dizinini (`assets.json`) üretir; kullanıcı elle dosya atabilir.
- Dosya erişimi yalnızca bu köklere izinli (mevcut `asset-file` kısıtı genişletilir).
- Ekranda "Marka Merkezi": yükle/sürükle-bırak, etiketle, logo/renk önizleme, eksik uyarısı ("logo yok", "font yüklü değil").
- Renk rolleri logodan ve kullanıcıdan çıkarılır; her tarif bu rollerle derlenir (zaten jeton sistemi var).

## 3. Firefly kararı (revizyon planında "ertelenir" idi)

Bu planla **geri alınıyor**, ama doğru yoldan:

- Firefly, **sağlayıcı soyutlaması** arkasında bir "görsel üretici/düzenleyici" olur: arka plan genişletme, nesne kaldırma/ekleme, arka plan üretme, varyasyon.
- İki olası yol (ikisi de **doğrulanacak**): (a) Adobe Firefly API (Adobe Developer Console kimliği, kullanım/fiyat koşulları, ticari kullanım hakkı), (b) Photoshop içi Generative Fill'in köprüden çağrılabilirliği (UXP/batchPlay'de güvenilir olmayabilir).
- Her üretim: istem, model, tarih, maliyet ve çıktının `generated/` klasörüne kaydı + "yapay zekâ üretimi" etiketi. Üretilen görsel hiçbir yere kaydedilmeden kullanılmaz (eski kodun hatası).
- Kullanıcı onayı olmadan dışarı görsel gönderilmez (müşteri fotoğrafları/KVKK).
- Bu oturumdaki Adobe/Canva bağlayıcıları Claude'a aittir; uygulamanın kendi Firefly erişimi ayrı kurulacak.

## 4. Fazlar

### Faz A — Düzen kalitesi ve eksik ilkeller (1–1,5 hafta)
Amaç: tipografi ağırlıklı tasarımda "Canva şablonu" görünümünden çıkmak.
- Mevcut 3 tarifin dengesi: alt blok boşluğu, gövde ve buton ölçeği, sağ tarafın kullanımı, başlık ile gövde için farklı yazı karakteri, 3 format.
- Yeni ilkeller: gradient (scrim), ok/çizgi/ayraç, yuvarlak köşe, gölge, rozet, çizgi/kenarlık (PS 28'de doğrula), harf aralığı doğrulaması.
- 5–6 yeni tarif ailesi (başlık odaklı, rota/liste, rakam odaklı, alıntı, ürün, duyuru).
- Kabul: 3 format × 6 tarif Photoshop'ta hijyen denetimini geçer, sen göz kontrolüyle beğenirsin; Kuzey Roastery referansına yaklaşım karşılaştırması.

### Faz B — Marka klasörü ve kimlik (1,5 hafta)
- Klasör yapısı, tarama, `brand.json` şeması, Marka Merkezi ekranı.
- Logo yerleştirme (`logo.place`), renk rolleri çıkarma, marka fontu eşleme ve Türkçe glif kontrolü, font yoksa açık uyarı.
- Tarifler marka kiti ile derlenir (marka başına 3–5 yerleşim ailesi seçimi).
- Kabul: yeni marka açılır, logo + renk + font yüklenir, aynı tarif iki markada farklı görünür ve tutarlı kalır.

### Faz C — Görsel işleme ve Firefly (2 hafta)
- Fotoğraf yerleştirme (akıllı nesne, kırpma), konu seçme/maske (PS `selectSubject` batchPlay, doğrula), kontakt gölgesi, renk uyumu, derinlik bulanıklığı.
- Firefly bağlayıcısı (Bölüm 3), maliyet sayacı, `generated/` kaydı, yapay zekâ etiketi.
- "Fotoğraf ağırlıklı" tarifler: otobüs/ürün/mekân kompozisyonu (Varan benzeri örnek test seti).
- Kabul: marka fotoğrafından kesilmiş konu, yeni arka plan ve gölgeyle bir post üretilir; her görselin kaynağı kayıtlıdır.

### Faz D — Prompt ile üretim ve kalite döngüsü (1,5–2 hafta)
- Alt alan "Ne tasarlayalım?" moduna geçer; metin/yön/düzen seçimi (Gemini/Claude; anahtar yönetimi, maliyet sayacı, bütçe tavanı).
- Çok adaylı üretim: 2–3 farklı yön → kod denetimi + model eleştirisi (toplam puan kodda) → en iyisi sunulur, diğerleri yan yana gösterilir.
- Revize döngüsü: şekil ve metin birlikte yeniden boyutlanır (buton font değişince), otomatik düzeltme.
- Tek tasarımdan format uyarlama (post → story → LinkedIn).
- Kabul: prompt → 3 aday → seçim → revize → kayıt; her adım gerçek PNG ve ölçümle.

### Faz E — Ajans iş akışı (A1–A2) (2 hafta)
- İş kalemi (iş panosu), aşamalar, onay kapıları, geri bildirim sınıflandırma, müşteri onay bağlantısı/paketi.
- Marka hafızası: onay/ret nedeniyle birlikte, öğrenilmiş kurallar (onayla eklenir).
- Tasarım sürüm geçmişi, dışa aktarma paketi (PNG/JPG/PDF, adlandırma), teslim kaydı.
- Kabul: bir iş kalemi brief'ten teslime kadar uygulamada taşınır.

### Faz F — Öğrenme (3–4 hafta, kısmen paralel)
- **Referans görselden öğrenme:** düzeni analiz → tarife çevir → nötr içerikle yeniden kur → karşılaştır → benzerlik koruması (kopya engeli).
- **Elle düzeltmeden öğrenme:** PSD farkı okunur (punto, hizalama, renk), kural önerisi, onayla kayıt.
- **Videodan öğrenme:** Gemini + herkese açık YouTube; kullanıcı onaylı kuyruk ve bütçe.
- Kabul: Varan örneği gibi bir referanstan çıkan tarif, farklı marka ve fotoğrafla üretimde kullanılır; kopya benzerlik eşiğinin altında kalır.

### Faz G — Marka dili, feed ve planlama (2–3 hafta)
- Boş marka (logo + sektör) → 3 yön örnek PSD → seçim → marka dili.
- 9–12'li feed mozaiği, monotonluk/uyumsuzluk uyarıları, içerik takvimi, kaynaklı sektör araştırması.

### Faz H — Ürünleşme (sürekli)
- Paketli eklenti (.ccx), imzalı kurulum, çok kullanıcı/ekip, lisans ve KVKK, font/görsel lisans takibi, destek ve hata günlüğü, yedekleme.
- Freelance ve reklam ajansı sürümü ayrımı (roller, onay zinciri, kampanya).

## 5. Çapraz işler (her fazda)
- Test: Photoshop'sız mantık testleri CI'da; PS testleri senin makinende (`test:ps`), sabit fikstür.
- Güvenlik ve anahtar saklama (şifreli), `userData` yolları, sabit yol yok.
- Maliyet defteri ve bütçe tavanı (Faz D'den zorunlu).
- Frontend'i bileşenlere bölme (Faz B–D sırasında).
- Yeni eklenti sürümü uyumsuzluğu: bağlanırken eklenti sürümü kontrol edilir, eskiyse açık uyarı.

## 6. Önerilen sıra ve nedeni

A → B → C → D → E → F → G → H.
- A ve B olmadan C anlamsız (tarif kalitesi ve marka kiti temel).
- C, D'den önce gelir, çünkü prompt ile üretimin kalitesi görsel işlemeye bağlı.
- E (iş akışı) D'nin ardından, çünkü onaylanacak iyi çıktı gerekiyor.
- F, E'nin hafızasına ihtiyaç duyar.

## 7. Açık sorular
1. Hedef: önce kendi ajansın mı, baştan başka ajanslara satış mı? (H ve çok kullanıcı önceliği değişir.)
2. Firefly için Adobe geliştirici hesabı/kimliği var mı, ticari kullanım koşulları? (Doğrulanacak.)
3. Gemini ve/veya Claude API anahtarı: aylık bütçe tavanı?
4. İlk üç pilot marka/sektör hangisi? Elde logo ve fotoğrafları var mı?
5. Hangi fontlar kullanılıyor ve lisansları hangi yolla (Adobe Fonts, kendi)?
6. Teslim biçimi: PSD, PNG/JPG, planlı yayın?
