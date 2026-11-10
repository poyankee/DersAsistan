# Yapılacaklar

## Sıradaki adımlar
- [ ] Gerçek telefonda deneme geri bildirimi (takvim hissi, widget, bildirimler, kısayollar)

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
- v0.6 Sade ödeme modeli (tek bakiye, "ne zaman öder", tarihi belirsiz ödeme notu, toplam/gecikmiş);
  akıcı takvim (3 gün, kaydırma animasyonu, iki parmak yakınlaştırma, özet kartı, 24 saat seçici, ay görünümünde
  gün paneli); ders bitiş ekranı; Bugün'de kaydırarak Yapıldı/İptal; görevler; sınav/yazılı takvimi; haftalık bakış;
  kurum sınıf sayfası; öğrenci arama/sıralama; toplu ücret güncelleme; tablette çift panel; çöp kutusu (30 gün);
  tema ve yazı boyutu; Android bildirimleri ve simge kısayolları
