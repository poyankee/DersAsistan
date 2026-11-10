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

**Kalıcı imza anahtarı (bir kerelik):** Yeni sürümlerin verileri silmeden eskisinin üzerine kurulabilmesi için
APK her seferinde aynı anahtarla imzalanmalıdır. Anahtar güvenlik için depoda değil, GitHub Secrets'ta durur:
*Settings → Secrets and variables → Actions → New repository secret* ile şu iki gizli değeri ekleyin:

| Ad | Değer |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | imza anahtarının base64 hali |
| `ANDROID_KEYSTORE_PASSWORD` | anahtar şifresi |

Kendi anahtarınızı üretmek için:
```bash
keytool -genkeypair -keystore dersasistani.keystore -alias dersasistani -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 dersasistani.keystore   # çıktıyı ANDROID_KEYSTORE_BASE64 olarak kaydedin
```
Anahtar dosyasını ve şifresini kaybetmeyin; kaybolursa uygulamayı silip yeniden kurmak (önce yedek alarak) gerekir.

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # birim testleri
npm run build    # dist/ klasörüne üretim çıktısı
npx cap sync android   # web çıktısını Android projesine kopyalar (Android Studio ile açılabilir)
```

## Yayınlama (GitHub Pages)

`main` dalına her push'ta `.github/workflows/deploy.yml` uygulamayı derleyip GitHub Pages'e yayınlar.
İlk kullanımda depo ayarlarından **Settings → Pages → Source: GitHub Actions** seçilmelidir.
Yayınlanan adresi telefonda açıp tarayıcı menüsünden **"Ana ekrana ekle"** diyerek uygulama gibi kullanabilirsiniz.
