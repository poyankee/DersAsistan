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

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # birim testleri
npm run build    # dist/ klasörüne üretim çıktısı
```

## Yayınlama (GitHub Pages)

`main` dalına her push'ta `.github/workflows/deploy.yml` uygulamayı derleyip GitHub Pages'e yayınlar.
İlk kullanımda depo ayarlarından **Settings → Pages → Source: GitHub Actions** seçilmelidir.
Yayınlanan adresi telefonda açıp tarayıcı menüsünden **"Ana ekrana ekle"** diyerek uygulama gibi kullanabilirsiniz.
