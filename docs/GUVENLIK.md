# Güvenlik incelemesi (v0.11)

Bu belge, telefon ↔ tablet eşitleme ve uygulama içi güncelleme eklenirken yapılan güvenlik incelemesini,
bulunan sorunları, yapılan düzeltmeleri ve kalan riskleri özetler.

## Neyi koruyoruz?

Öğrenci adları, veli telefonları, ders notları, ödemeler ve kişisel ödemeler (Ödemelerim).
Saldırgan olarak şunlar düşünüldü:

1. **Sunucu adresini bulan herhangi biri** (internetten tarama yapan botlar dahil)
2. **Hosting firması / sunucu dosyalarına erişen biri** (ör. hosting hesabı ele geçirilirse)
3. **Ağı dinleyen biri** (ortak Wi-Fi)
4. **Telefonu kaybolan ya da çalınan cihaz**
5. **Güncelleme kanalına zararlı paket sokmaya çalışan biri**

## Alınan önlemler

### Veri gizliliği (uçtan uca şifreleme)
- Her kayıt cihazda **AES-256-GCM** ile şifrelenir. Anahtar paroladan **PBKDF2-SHA256 (600.000 tekrar)** ile türetilir
  ve cihazdan çıkmaz. Sunucuya yalnızca ayrı türetilmiş bir **giriş doğrulama değeri** gider; sunucu bunu da
  **bcrypt** ile özetleyerek saklar. Sunucu ve hosting firması kayıtların içeriğini **göremez**.
- Her şifreli kayıt, kendi koleksiyon/kimlik bilgisine bağlıdır (AEAD ek verisi): bir kaydın şifreli içeriği başka bir
  kaydın yerine konamaz.
- **Silmeler de şifreli bir işaretle** gönderilir: sunucuya erişen biri kayıt silemez; şifresiz silme istekleri yok sayılır.
- Doğrulanamayan (sahte/bozuk) kayıtlar uygulanmaz ve eşitlemeyi kilitlemez.
- Parola kuralı: en az 10 karakter, yalnızca rakam olamaz, en az 5 farklı karakter.

### Sunucu
- **Kurulum kodu:** İlk hesap yalnızca hosting panelinden görülebilen `veri/KURULUM-KODU.txt` dosyasındaki 10 karakterlik
  kodla açılabilir. Sunucu adresini sizden önce bulan biri hesabı ele geçiremez. Hesap açılınca dosya silinir.
- **Kaba kuvvete karşı:** 15 dakikada bir IP'den en fazla 10, toplamda en fazla 50 hatalı giriş/kurulum denemesi;
  her hatalı denemede gecikme. Kurulum kodu denemeleri de sınırlıdır.
- **Kullanıcı adı sızdırmama:** Bilinmeyen kullanıcı adına da tutarlı sahte bir tuz döner; hatalı girişte mesaj ve süre aynıdır.
- **Oturumlar:** 256 bit rastgele anahtar; sunucuda yalnızca SHA-256 özeti tutulur. 180 gün kullanılmayan oturum kapanır.
  **Kaybolan cihaz** Ayarlar → Hesap ve eşitleme → Bağlı cihazlar → **Kaldır** ile anında devre dışı bırakılır.
- **SQL enjeksiyonu:** Tüm sorgular parametreli; koleksiyon adı yalnızca harf, kayıt verisi yalnızca base64 kabul edilir.
- **İstek sınırları:** İstek en fazla 20 MB, kayıt en fazla 2 MB, istekte en fazla 5000 değişiklik; JSON derinliği sınırlı.
- **Saat sapması:** Saati ileride olan bir cihaz kayıtları "kilitleyemez" (en fazla 2 dk ileri kabul edilir).
- **Veri dosyası:** Web'den erişime kapalı klasörde (Apache 2.2/2.4 uyumlu kural), dosya adı tahmin edilemez
  (`ders-<32 hex>.sqlite`), izinler 0600. İsterseniz klasör web kökünün dışına alınabilir (`ayarlar.php`).
- **Başlıklar:** `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, kısıtlayıcı CSP,
  HTTPS'te HSTS; PHP sürümü gizlenir; arama motorlarına kapalı (`noindex`).
- **Yalnızca POST:** Veri uçları GET ile çalışmaz; tarayıcıdan izinli kaynaklar dışında CORS izni yok.
- Kullanılmayan "sunucu verisini sil" ucu kaldırıldı.

### Bağlantı
- Uygulama internetteki sunucular için **yalnızca HTTPS** kabul eder (yerel ağ adresleri hariç). Android tarafında
  şifresiz trafik kapalıdır. Sunucu HTTPS'e yönlendirir; HTTPS açık değilse uygulama uyarır.

### Android
- `FileProvider` yalnızca önbellek klasörünü paylaşır (önceden tüm harici depolama tanımlıydı).
- Android/Google yedeğine eşitleme anahtarı ve oturum **dahil edilmez** (veriler yedeklenmeye devam eder).
- Sayfaya CSP eklendi (eklenti, çerçeve, form gönderimi kapalı); kodda `innerHTML`/`eval` gibi riskli kullanım yok.
- İçe aktarılan dosyalar (.xls, .ics, .zip) yalnızca metin olarak işlenir, betik çalıştırılmaz.

### Güncellemeler
- Sürüm bilgisi ve paketler GitHub'dan **HTTPS** ile indirilir; paket **SHA-256** ile doğrulanır.
- Sürüm bilgisinde yalnızca beklenen biçimdeki dosya adları/etiketler kabul edilir.
- Paket içindeki dosyalar paket klasörünün dışına yazılamaz (`../`, mutlak yol vb. reddedilir).
- Yeni paket üç açılışta onaylanmazsa önceki pakete dönülür; yeni bir APK kurulunca indirilmiş paketler bırakılır.
- APK güncellemeleri Android tarafından **imza kontrolünden** geçer: yalnızca aynı anahtarla imzalı APK üzerine kurulur.

### Bağımlılıklar
- `npm audit`: `@capacitor/android` (kritik: uzak içeriğin uygulama kaynağında yüklenebilmesi) **6.2.3**'e,
  `fflate` (bozuk zip ile sonsuz döngü) **0.8.3**'e güncellendi. Uygulamaya giren pakette bilinen açık kalmadı.
  Yalnızca derleme aracındaki (`@capacitor/cli` → `tar`) bir uyarı var; telefona giden koda dahil değil.

## Testler

Her derlemede otomatik çalışır:

- `server/guvenlik.test.ts` — gerçek PHP sunucusuna 13 saldırı senaryosu: kurulumu kodsuz/yanlış kodla ele geçirme,
  kurulum kodu ve parola kaba kuvveti, oturumsuz/sahte oturumla erişim, SQL enjeksiyonu, şifresiz veri gönderme,
  aşırı büyük istek, ileri saatli kayıt kilitleme, kullanıcı adı tespiti, kaybolan cihazı kaldırma, CORS, güvenlik başlıkları.
- `src/lib/guvenlik.test.ts` — sunucuya erişen birinin kayıt silmesi/sahte kayıt eklemesi/şifreli kayıtları yer
  değiştirmesi, yanlış anahtar, şifreli silme işaretleri, HTTPS zorunluluğu, güncelleme paketi ve dosya yolu denetimleri.
- `src/lib/sync.test.ts` — şifreleme ve anahtar türetme.
- `e2e/run.mjs` — iki tarayıcı (iki cihaz) gerçek sunucu üzerinden eşitlenir; sunucudaki dosyada düz metin bulunmadığı denetlenir.

## Kalan riskler ve öneriler

| Risk | Açıklama | Öneri |
|---|---|---|
| **Parola unutulursa** | Sunucudaki kopya açılamaz (tasarım gereği). Cihazlardaki veriler durur. | Parolayı güvenli bir yere yazın. |
| **Zayıf parola + sunucu dosyası ele geçirilirse** | Saldırgan çevrimdışı parola tahmini yapabilir (600.000 tekrarlı PBKDF2 bunu yavaşlatır, engellemez). | Uzun bir parola seçin (ör. 4 kelimelik bir cümle). |
| **GitHub hesabı ele geçirilirse** | Saldırgan zararlı bir güncelleme yayınlayabilir. | GitHub hesabınızda **iki adımlı doğrulamayı (2FA)** açın. |
| **Telefon kilidi açık şekilde çalınırsa** | Uygulamadaki veriler görülebilir. | Telefonda ekran kilidi kullanın; uygulamada PIN kilidini açın; çalınan cihazı Bağlı cihazlar'dan kaldırın. |
| **Kötü niyetli sunucu** | Kayıtların eski bir sürümünü geri gönderebilir ya da veri vermeyebilir (okuyamaz, değiştiremez). | Hosting hesabınızın parolasını güçlü tutun, panelde 2FA varsa açın. |
| **Görev ekleri** | Dosya/fotoğraf ekleri yalnızca cihazda durur, yedeğe ve eşitlemeye girmez. | — |
| **Kullanılan sürüm** | Hostingdeki PHP güncel olmalı. | Panelden PHP 8.x seçin. |
