# Yapılacaklar

## 🔜 Sıradaki toplu geliştirme (v0.6)

### Senin istediklerin
- [ ] **Tarihi belli olmayan ödeme:** Veli "sonra ödeyeceğim" dediğinde tarih girmeden "Ödeme bekleniyor"
  olarak işaretlenebilsin. Alacaklarda ayrı bir kalem olarak görünsün ("tarihi belirsiz"), kaç gündür
  beklediği yazsın (ör. "12 gündür bekliyor"), belirli bir süreyi geçince nazikçe hatırlatsın.
  Sonradan tarih belli olursa tek dokunuşla tarihli söze çevrilebilsin.
- [ ] **Takvimin akıcı kullanımı (soft his):** Takvim baştan elden geçirilecek. Tespit edilen/olası sorunlar:
  - Telefonda dersi taşımak için basılı tutma süresi uzun, basarken görsel geri bildirim yok
  - Derse dokununca ağır tam form açılıyor → önce küçük bir **özet kartı** (saat, konu, hızlı
    "Yapıldı / İptal / Taşı / Not yaz" düğmeleri), detay istenirse form
  - Gün değiştirirken (kaydırma) animasyon yok, sayfa "zıplıyor" → parmakla sürüklenen, yumuşak geçiş
  - Saat yüksekliği sabit ve telefonda küçük → iki parmakla yakınlaştırma / sıkıştırma
  - Telefonda sadece Gün görünümü rahat → **3 günlük görünüm** eklenmeli
  - Görünüm/gün değişince kaydırma konumu sıfırlanıyor
  - Süre değiştirme tutamağı dokunmatik için çok ince
  - Saat seçicide AM/PM görünebiliyor → her yerde 24 saat, 5 dakikalık adımlı kendi saat seçicimiz
  - Telefonda form açılınca klavye alanları kapatıyor
  - Ay görünümü telefonda sıkışık; güne dokununca altta o günün listesi açılmalı
  - Genel geçiş animasyonları ve dokunma geri bildirimi (titreşim, basılma efekti)
  > Kullanırken takıldığın somut anları buraya ekle (ör. "X'e dokununca Y oluyor") — öncelik onlara.

### Seçilen ek geliştirmeler
- [ ] **Hızlı işlem:** Bugün ekranındaki derslerde kaydırarak "Yapıldı ✓ / Ücreti alındı ₺ / İptal"
- [ ] **Ders bitince tek ekran akışı:** "Ne işledin + ödev + ücreti alındı mı?" tek adımda
- [ ] **Öğrenci arama ve sıralama:** Ada göre arama, borca/son derse göre sıralama
- [ ] **Geri dönüşüm kutusu:** Silinen ders/öğrenci/ödeme 30 gün geri alınabilsin
- [ ] **Bildirimler:** Ders öncesi hatırlatma, ders sonrası "ne işledin", vadesi gelen ödeme sözleri

### Beklemede (şimdilik seçilmedi)
- [ ] Son kullanılan konu/ödev metinlerinden otomatik tamamlama
- [ ] Borcu olan veliye hazır WhatsApp ödeme hatırlatma metni
- [ ] Ay sonu toplu tahsilat listesi (toplu ödeyenler)
- [ ] Her gün otomatik yerel yedek

### Seçilen iş akışı özellikleri
- [ ] **A. Yapılacaklar / görevler:** Ders dışı işler için tarihli hatırlatmalar ("8-H yazılılarını oku")
- [ ] **D. Haftalık bakış:** Gelecek hafta ders sayısı, boşluklar, tatiller, beklenen ödemeler
- [ ] **E. Sınıf sayfası:** Kurum sınıfları için profil; sınıf notları, konu ilerlemesi, son işlenenler
- [ ] **G. Sınav/yazılı takvimi:** Takvimde gösterme, öncesinde hatırlatma
- [ ] **I. Toplu ücret güncelleme:** Belirli tarihten itibaren tüm/seçili öğrencilere yeni ücret
- [ ] **M. Tablette çift panel:** Solda liste, sağda detay
- [ ] **N. Simge kısayolları:** Uzun basınca "Yeni ders", "Ödeme al", "Bugün"
- [ ] **O. Tema ve yazı boyutu ayarı**

### Ödeme sisteminin sadeleştirilmesi (onay bekliyor)
Şu anki sorun: 3 ödeme düzeni, 5 ayrı alacak kartı, tarihli söz, ders ders dağıtım → karmaşık.
Önerilen sade model — **"veresiye defteri" mantığı:**
- [ ] Her öğrencinin tek bir **bakiyesi** var: ders yapılınca ücret borç yazılır, ödeme alınınca düşer.
  Kartta tek satır: "2.400 ₺ borç · 3 ders" veya "Peşin 1.500 ₺ · 3 ders hakkı".
- [ ] "Ödeme düzeni" seçimi kalkar; yerine isteğe bağlı tek etiket: **"Ne zaman öder?" → Her ders / Ay sonu / Peşin**.
  Sadece "gecikti mi?" kararında kullanılır (ay sonu ödeyenin bu ayki borcu gecikmiş sayılmaz).
- [ ] Ödeme sözü + tarihi belirsiz ödeme birleşir: öğrenciye tek bir **"Ödeme notu"** — "Bilinmiyor" (varsayılan)
  ya da tarih. Ayrı alacak kategorisi yok, sadece ismin altında görünür.
- [ ] Alacak özeti **2 sayıya** iner: **Toplam alacak** ve bunun içinden **Gecikmiş** olan.
- [ ] Ödeme alma tek ekran: büyük tutar alanı + "Tüm borç" / "1 ders" düğmeleri, tarih bugün. Bitti.
- [ ] Ders ders "ödendi/ödenmedi" etiketleri varsayılan olarak gizlenir (geçmişte küçük bir nokta).
- [ ] Ders penceresindeki "Ücreti alındı" kutusu kalır (ders başı ödeyenler için en hızlı yol).
- [ ] Mevcut veriler kaybolmaz; eski ödeme düzeni bilgisi yeni etikete çevrilir.

### Beklemede (seçilmedi)
- [ ] B. Ders planı · C. Hızlı ekleme cümlesi · F. Sınıf listesi ve yoklama · H. Kardeş/aile hesabı
- [ ] J. Ders sonu değerlendirme · K. Bekleme listesi · L. Derse fotoğraf ekleme

## Sıradaki fikirler

### 📈 Sınav ve deneme sonuçları (iş yükü az olacak şekilde)
Her sonucu elle girmek yorucu olacağı için girişi otomatikleştirecek seçenekler:

1. **Fotoğraftan okuma:** Deneme sonuç belgesinin (karne, optik sonuç çıktısı) fotoğrafını çek → uygulama
   ders bazında doğru/yanlış/net değerlerini okuyup önerir, sen sadece onaylarsın. (Yapay zekâ ile görüntü okuma;
   internet ve bir API anahtarı gerektirir.)
2. **Excel/PDF içe aktarma:** Kurumların veya yayınevlerinin verdiği toplu sonuç dosyalarını (sınıf listesi)
   tek seferde yükleyip öğrencilerle eşleştirme — kurum programı içe aktarmaya benzer.
3. **Hızlı giriş tablosu:** Bir sınav için tek ekranda tüm öğrenciler × dersler tablosu; sadece net yazılıp
   Tab ile geçilir (elle giriş gerekiyorsa en hızlı yol).
4. Sonuçlar öğrenci profilinde grafik olarak (net gelişimi, ders bazında güçlü/zayıf yönler) gösterilir ve
   veliye gönderilen özete eklenir.

### Takvim ve program
- [x] "Bugün" ana ekranı (sıradaki ders, notu eksikler, alacaklar)
- [x] ⭐ Kurum programı değişiklik raporu ("Salı 3. saat kaldırıldı, Perşembe'ye eklendi")
- [x] İptal → telafi dersi akışı (boş saat önerisi, orijinal derse bağlantı)
- [x] Boş saat bulucu (yeni öğrenciye saat vermek için)
- [x] Resmi tatiller / ara tatiller; tekrarlayan derslerin otomatik atlanması
- [x] Öğrencinin kalıcı ders saati değişikliği için tek adımlı sihirbaz
- [x] Kurum zil saatleri şablonu ("3. saat" seçerek ekleme)

### Ders defteri
- [ ] ⭐ Hızlı not şablonları, "önceki konunun devamı" önerisi
- [ ] ⭐ Sesli not → konu/ödev alanlarına otomatik ayrıştırma
- [ ] Müfredat/kazanım takibi ve ilerleme yüzdesi
- [ ] Aynı seviyedeki şubeleri karşılaştırma
- [ ] Ödev takibi (yapıldı/eksik)
- [ ] Resmi görünümlü ders defteri PDF dökümü

### Özel ders ve öğrenciler
- [x] Ödeme düzenleri: ders başı / toplu (ay sonu, her N ders) / paket; ileri tarihli ödeme sözü; ders bazında ödendi bilgisi
- [ ] ⭐ Ders sonrası tek dokunuşla veliye WhatsApp mesajı
- [x] Paket modeli ve kalan ders uyarısı
- [ ] Aylık sabit ücret (ders sayısından bağımsız) modeli
- [ ] Ödeme hatırlatma mesajı
- [ ] Veliye makbuz / dönem dökümü (PDF)
- [ ] Gelmedi / son dakika iptali ücret kuralı
- [ ] Öğrenci hedefleri (ör. LGS puan hedefi)
- [ ] Grup dersi (birden fazla öğrenci, ayrı ücret)
- [ ] Ev dersleri için adres, harita, yol süresi uyarısı

### Para ve raporlar
- [x] ⭐ Gelir paneli ve grafikler (aylık/yıllık, kurum vs özel)
- [x] Kurum ek ders puantaj dökümü
- [ ] Gider takibi ve net kazanç
- [ ] Yıllık gelir özeti

### Hatırlatma ve otomasyon
- [ ] ⭐ Bildirimler: ders öncesi hatırlatma, ders sonrası "ne işledin" bildirimi
- [ ] Haftalık özet bildirimi
- [x] Ana ekran widget'ı

### Veri ve güvenlik (sonraya bırakıldı)
- [ ] Gerçek kullanıma geçerken sabit APK imza anahtarı (güncellemeler veri silinmeden üstüne kurulsun)
- [ ] ⭐ Bulut eşitleme (telefon + tablet)
- [ ] Google Drive'a otomatik haftalık yedek
- [ ] Parmak izi / PIN kilidi
- [ ] Google Takvim ile otomatik eşitleme

### Yapay zekâ destekli
- [ ] Doğal dille komut ("Ayşe'nin yarınki dersini cumaya al")
- [ ] Öğrenciye çalışma planı / sonraki konu önerisi
- [ ] Ay sonu kişiselleştirilmiş veli raporu

## Tamamlananlar
- v0.1 Takvim, kurum programı içe aktarma (kopyasız), ders defteri, özel ders ücret/ödeme takibi, özet, yedekleme
- v0.2 Android APK (Capacitor), GitHub Actions ile otomatik derleme
- v0.3 Öğrenci profil sayfası (geçmiş, hızlı kayıt, kitaplar, notlar, ödemeler); takvimde sürükle-bırak,
  süre değiştirme, geri al, seriye uygula, çakışma uyarısı, çoğaltma, kaydırarak gün değiştirme
- v0.4 Modern arayüz: kenar menüsü, alt menü, "+" düğmesi, Bugün ekranı, yeni takvim görünümü, koyu tema, Inter yazı tipi ve simgeler
- v0.5 Ödeme sistemi (ders başı/toplu/paket, söz, ayrı alacak dağılımı), boş saat bulucu, telafi, tatiller, zil saatleri, değişiklik raporu, ders düzeni, gelir paneli, ek ders puantajı, Android ana ekran widget'ı
