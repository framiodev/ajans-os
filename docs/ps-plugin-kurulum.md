# AjansOS Photoshop Köprüsü — Kurulum ve Deneme (Photoshop 27.0)

Bu eklenti, AjansOS'un Photoshop'ta katmanlı PSD üretmesini ve revize etmesini sağlar. Photoshop ile AjansOS arasındaki bağlantı yalnızca bu bilgisayarda (localhost) çalışır.

## 1. Kurulum (geliştirici modu, bir kez)
1. Photoshop'ta **Düzen → Tercihler → Eklentiler** (Edit → Preferences → Plugins) bölümünde **Geliştirici Modunu Etkinleştir** (Enable Developer Mode) kutusunu işaretleyin, Photoshop'u yeniden başlatın.
2. Creative Cloud masaüstü uygulamasından **UXP Developer Tool**'u kurun ve açın.
3. UXP Developer Tool'da **Add Plugin** → bu depodaki `ps-plugin/manifest.json` dosyasını seçin.
4. Listede "AjansOS Köprüsü" görününce Photoshop'un açık olduğundan emin olun ve **Load** düğmesine basın.
5. Photoshop'ta **Eklentiler (Plugins) → AjansOS Köprüsü** panelini açın.

## 2. Bağlanma
1. AjansOS'u açın → **API Bağlantıları** ekranı → "Photoshop Köprüsü" kutusundaki **port** ve **bağlantı anahtarını** görün.
2. Photoshop'taki AjansOS panelinde portu yazın (kurulu uygulama: `4190`, `start-ajansos.bat` ile geliştirme: `4010`), anahtarı yapıştırın, **Bağlan**'a basın.
3. Panel yeşil "Bağlı — Photoshop 27.0…" gösterir; AjansOS kenar çubuğunda **Photoshop: Bağlı** yazar. Anahtar panelde saklanır; sonraki açılışlarda otomatik bağlanır.

## 3. Deneme listesi (lütfen sonuçları bildirin)
| # | Deneme | Beklenen |
|---|---|---|
| T1 | Bağlan | Hem panel hem AjansOS "Bağlı" der |
| T2 | Stüdyo → **Photoshop PSD Üret** (post) | Yeni belge 1080×1350 açılır; katmanlar: BG_Base, Header/Copy/CTA grupları içinde metinler; `.psd` ve `.png` çıktı klasörüne kaydolur |
| T3 | Aynısını **story** ve **square** formatında | Metinler güvenli alanda, taşma yok |
| T4 | Sağ paneldeki hijyen listesi | Kritik maddeler ✓ (veya hangisinin ✗ olduğu görünür) |
| T5 | Revize: "Başlığı 8 punto büyüt" | Başlık büyür; mesaj "punto X → Y (Photoshop'tan doğrulandı)" der |
| T6 | Revize: "logoyu küçült", "CTA'yı büyüt" | İlgili katman değişir |
| T7 | Yanlış anahtar / Photoshop kapalı | Açık hata mesajı, çökme yok |

## 4. Hata olursa
UXP Developer Tool'da eklentinin yanındaki **Debug** düğmesi bir konsol açar. Kırmızı hata satırını ve AjansOS'ta görünen hata mesajını bana iletin. Özellikle şu noktalar Photoshop 27.0'da henüz doğrulanmadı:
- `documents.add` içindeki `name` seçeneği (yoksa otomatik ad kullanılır)
- `createTextLayer` seçenekleri (yazı tipi adı, renk, konum)
- `createLayerGroup({ fromLayers })` ile gruplama
- `saveAs.psd/png` ile mutlak yola kaydetme (`localFileSystem: fullAccess`)
- Yazı tipi adı çözümü: marka yazı tipi (örn. "Inter") Photoshop'ta yüklü değilse varsayılan yazı tipi kullanılır ve hijyen denetimi uyarır.

## 5. Güvenlik
- Eklenti yalnızca `localhost` bağlantısına izin verir; bağlantı anahtarı olmadan sunucu bağlantıyı reddeder.
- Eklenti tam dosya erişimi ister (PSD'yi çıktı klasörüne yazmak için); AjansOS yalnızca kendi çıktı klasörünün içindeki `.psd`/`.png` yollarını kabul eder.
