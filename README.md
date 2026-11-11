# Ders Asistanı

Kurum dersleri ve özel dersler için haftalık takvim, ders defteri ve ücret takibi uygulaması.

## Özellikler (v0.1)

- **Google Takvim benzeri takvim**: Gün / Hafta / Ay / Liste görünümü; boş bir saate tıklayarak ders ekleme; mobil uyumlu.
- **Kurum programı içe aktarma**: Kurumun yayınladığı `.xls` / `.xlsx` program dosyasını yükleyin.
  - Daha önce kaydedilmiş dersler **tekrar eklenmez** (her ders saati `tarih + saat + sınıf` anahtarıyla tanınır).
  - Aynı sınıfın art arda gelen saatleri tek ders bloğu olarak birleştirilir (ör. 09:20–10:50, 2 saat).
  - Yeni programda artık olmayan *gelecek* dersler bulunur ve isterseniz kaldırılır (notu girilmiş/geçmiş dersler asla silinmez).
  - Sizin sildiğiniz kurum dersleri sonraki yüklemelerde geri gelmez.
- **Ders defteri**: Her ders için "Ne işledim?", ödev ve notlar. Aynı sınıf/öğrencinin önceki dersleri hatırlatılır.
  Notu girilmemiş geçmiş dersler uyarı olarak gösterilir. Filtreleme, arama, Excel (CSV) çıktısı ve yazdırma.
- **Özel ders takibi**: Öğrenciler, ders başı ücret, haftalık tekrarlayan dersler, ödemeler, borç/alacak bakiyesi,
  WhatsApp üzerinden veliye ders özeti gönderme.
- **Aylık özet**: Kurum ders saatleri (sınıf bazında), tahmini ek ders ücreti, özel ders kazancı ve tahsilatlar.
- **Yedekleme**: JSON yedek indir/geri yükle; Google Takvim'e `.ics` aktarımı.

Veriler tarayıcıda (localStorage) saklanır; sunucu gerekmez. Düzenli yedek almayı unutmayın.

## Android uygulaması (APK)

Uygulama [Capacitor](https://capacitorjs.com) ile Android'e paketlenir (`android/` klasörü).
Her push'ta `.github/workflows/android.yml` APK'yı derler ve **Releases** sayfasına `DersAsistani.apk` olarak yükler.

**Telefona/tablete kurulum:** GitHub'da depo → *Releases* → en son sürüm → `DersAsistani.apk` dosyasını indirip açın.
İlk seferde "bilinmeyen kaynaklardan yüklemeye izin ver" onayı istenir.

**Güncelleme:** İmza anahtarı depoda tutulmaz; ilk derlemede üretilir ve GitHub Actions önbelleğinde saklanır.
`keystore-keepalive.yml` iş akışı önbelleğe üç günde bir erişerek silinmesini önler, böylece her APK aynı anahtarla
imzalanır ve eskisinin üzerine kurulur. Önbellek bir nedenle kaybolursa derleme uyarı verir ve yeni anahtar üretir
(o zaman bir kez yedek al / sil / kur / geri yükle gerekir).

**Ana ekran widget'ı:** Uygulamayı kurduktan sonra telefonun ana ekranına uzun basın → *Widget'lar* →
*Ders Asistanı · Bugün*. Bugünün derslerini, sıradaki dersi ve notu eksik ders sayısını gösterir.

## Dosya biçimleri (içe aktarma)

Depoda gerçek kurum dosyası **tutulmaz**; testlerde yalnızca küçük, uydurma bir örnek (`e2e/fixtures/program.xls`) kullanılır.

**Kurum ders programı (.xls / .xlsx / .html / .csv)**
- Kurum sisteminin verdiği ".xls" aslında bir HTML tablosudur; gerçek .xlsx de okunur.
- Her satırın **ilk sütunu tarih**tir (`16.11.2026`, `16.11.2026 Pazartesi`, `2026-11-16` gibi).
- Diğer hücrelerde ders: **sınıf kodu + saat aralığı**, ör. `478-H0811 09:20-10:00` (satır sonu ya da boşlukla ayrılmış).
- Her ders saatinin anahtarı `tarih|başlangıç|SINIF KODU`dur; aynı dosya ya da güncellenmiş program tekrar yüklenince
  kayıtlı saatler atlanır, silinenler geri gelmez, değişen günler raporlanır.
- Art arda gelen aynı sınıf saatleri tek ders olarak birleştirilebilir (ör. 09:20–10:50, 2 saat).

**Google Takvim yedeği (.zip / .ics)**
- Google Takvim → Ayarlar → İçe ve dışa aktar → Dışa aktar ile inen .zip (her takvim için bir .ics) ya da tek .ics.
- Tekrarlayan etkinlikler (günlük/haftalık/aylık/yıllık, COUNT/UNTIL/INTERVAL/BYDAY, EXDATE, tek tekrar değişiklikleri)
  2 yıl ileriye kadar açılır; iptal edilenler alınmaz. Anahtar `gcal|UID|tarih-saat`; tekrar yüklemede kopya oluşmaz.
- Her takvim kişisel etkinlik olarak kendi kategorisine girer; tüm gün etkinlikleri isteğe bağlıdır.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # birim testleri
npm run lint     # kod denetimi
npm run e2e      # uçtan uca testler (önce npm run build)
npm run build    # dist/ klasörüne üretim çıktısı
npx cap sync android   # web çıktısını Android projesine kopyalar (Android Studio ile açılabilir)
```

## Yapı

- `src/lib/` — iş mantığı (ekrandan bağımsız, testli): `schema` (doğrulama + sürüm geçişleri), `store` + `persist`
  (kalıcı depo, sağlam kopyalar, otomatik yedek), `finance`, `status`, `importSchedule`, `lessonLog`, `search`, `report`
- `src/components/` — ekranlar
- `src/styles/` — ekran bazında stiller; renkler `tokens.css` içindeki ana renk değişkenlerinden türetilir
- `e2e/` — gerçek tarayıcıda çalışan uçtan uca testler
- `android/` — Capacitor Android projesi (widget, kısayollar)

## Yayınlama (GitHub Pages)

`main` dalına her push'ta `.github/workflows/deploy.yml` uygulamayı derleyip GitHub Pages'e yayınlar.
İlk kullanımda depo ayarlarından **Settings → Pages → Source: GitHub Actions** seçilmelidir.
Yayınlanan adresi telefonda açıp tarayıcı menüsünden **"Ana ekrana ekle"** diyerek uygulama gibi kullanabilirsiniz.
