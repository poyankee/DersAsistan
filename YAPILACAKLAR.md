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

### Diğer öneriler
- **Bulut eşitleme:** Telefon ve tablet aynı verileri görsün, cihaz kaybolursa veri kaybolmasın.
- **Bildirimler:** Ders öncesi hatırlatma; ders bitince "ne işlediğini yaz" hatırlatması (Android bildirimleri).
- **Google Takvim ile otomatik eşitleme** (şu an tek yönlü .ics aktarımı var).
- **Müfredat/kazanım takibi:** Sınıf veya öğrenci için konu listesi, işlenenler işaretlendikçe ilerleme yüzdesi.
- **Yoklama:** Kurum sınıflarında devamsızlık, özel derste "gelmedi" durumu ve ücret kuralı.
- **Aylık döküm/makbuz:** Veliye ay sonu ders ve ödeme dökümü (PDF veya WhatsApp mesajı).
- **Ana ekran widget'ı:** Bugünün dersleri ve sıradaki ders.

## Tamamlananlar
- v0.1 Takvim, kurum programı içe aktarma (kopyasız), ders defteri, özel ders ücret/ödeme takibi, özet, yedekleme
- v0.2 Android APK (Capacitor), GitHub Actions ile otomatik derleme
- v0.3 Öğrenci profil sayfası (geçmiş, hızlı kayıt, kitaplar, notlar, ödemeler); takvimde sürükle-bırak,
  süre değiştirme, geri al, seriye uygula, çakışma uyarısı, çoğaltma, kaydırarak gün değiştirme
