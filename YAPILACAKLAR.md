# Yapılacaklar

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
- [ ] ⭐ Kurum programı değişiklik raporu ("Salı 3. saat kaldırıldı, Perşembe'ye eklendi")
- [ ] İptal → telafi dersi akışı (boş saat önerisi, orijinal derse bağlantı)
- [ ] Boş saat bulucu (yeni öğrenciye saat vermek için)
- [ ] Resmi tatiller / ara tatiller; tekrarlayan derslerin otomatik atlanması
- [ ] Öğrencinin kalıcı ders saati değişikliği için tek adımlı sihirbaz
- [ ] Kurum zil saatleri şablonu ("3. saat" seçerek ekleme)

### Ders defteri
- [ ] ⭐ Hızlı not şablonları, "önceki konunun devamı" önerisi
- [ ] ⭐ Sesli not → konu/ödev alanlarına otomatik ayrıştırma
- [ ] Müfredat/kazanım takibi ve ilerleme yüzdesi
- [ ] Aynı seviyedeki şubeleri karşılaştırma
- [ ] Ödev takibi (yapıldı/eksik)
- [ ] Resmi görünümlü ders defteri PDF dökümü

### Özel ders ve öğrenciler
- [ ] ⭐ Ders sonrası tek dokunuşla veliye WhatsApp mesajı
- [ ] ⭐ Paket / aylık sabit ücret modeli, kalan ders uyarısı
- [ ] Ödeme hatırlatma mesajı
- [ ] Veliye makbuz / dönem dökümü (PDF)
- [ ] Gelmedi / son dakika iptali ücret kuralı
- [ ] Öğrenci hedefleri (ör. LGS puan hedefi)
- [ ] Grup dersi (birden fazla öğrenci, ayrı ücret)
- [ ] Ev dersleri için adres, harita, yol süresi uyarısı

### Para ve raporlar
- [ ] ⭐ Gelir paneli ve grafikler (aylık/yıllık, kurum vs özel)
- [ ] Kurum ek ders puantaj dökümü
- [ ] Gider takibi ve net kazanç
- [ ] Yıllık gelir özeti

### Hatırlatma ve otomasyon
- [ ] ⭐ Bildirimler: ders öncesi hatırlatma, ders sonrası "ne işledin" bildirimi
- [ ] Haftalık özet bildirimi
- [ ] Ana ekran widget'ı

### Veri ve güvenlik
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
