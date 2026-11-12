# Eşitleme sunucusu kurulumu (telefon ↔ tablet)

Bu kılavuz, Ders Asistanı'nı telefon ve tablette **aynı verilerle** kullanmak için kendi hostinginize
küçük bir sunucu kurmayı anlatır. Kurulum bir kez yapılır, yaklaşık 15–20 dakika sürer.

> **Gizlilik:** Öğrenci adları, ödemeler, notlar… her şey telefonda/tablette **parolanızla şifrelenip**
> öyle gönderilir. Hosting firması ve sunucu yalnızca anlamsız şifreli veri görür; parolanızın kendisi de
> sunucuya hiç gitmez. Bu yüzden **parolayı unutmamanız** önemlidir (unutursanız sunucudaki kopya açılamaz;
> cihazlardaki veriler yine durur).

---

## 1. Hosting ve alan adı alma

En küçük **Linux paylaşımlı hosting** paketi yeterlidir (cPanel ya da Plesk paneli olan, Türkiye'deki
herhangi bir hosting firması). Paket alırken şunlara bakın:

| Gerekli | Neden |
|---|---|
| **PHP 7.4 veya üzeri** (8.x önerilir) | Sunucu PHP ile yazıldı |
| **PDO SQLite** eklentisi | Veriler tek bir dosyada tutulur; ayrıca veritabanı kurmanız gerekmez |
| **Ücretsiz SSL (Let's Encrypt)** | Bağlantı şifreli olsun diye (çoğu pakette tek tıkla açılır) |

Alan adını (ör. `soyadim.com` ya da `.com.tr`) hosting firmasından paketle birlikte alabilirsiniz.
Aynı hostingi ileride kişisel web siteniz için de kullanabilirsiniz; eşitleme sunucusu ayrı bir klasörde durur.

## 2. SSL'i açın

Hosting panelinde **SSL/TLS** ya da **Let's Encrypt** bölümünden alan adınız için ücretsiz sertifikayı etkinleştirin.
Tarayıcıda `https://alanadiniz.com` açılabiliyorsa hazırdır.

## 3. Sunucu dosyalarını yükleyin

1. GitHub'daki son sürüm sayfasından **`ders-sunucu.zip`** dosyasını indirin
   (<https://github.com/poyankee/DersAsistan/releases/latest>).
2. Hosting panelinde **Dosya Yöneticisi**'ni açın, `public_html` içinde **`ders`** adında bir klasör oluşturun.
3. `ders-sunucu.zip`'i bu klasöre yükleyin ve **Çıkart / Extract** deyin. Klasörde şunlar olmalı:
   `api.php`, `index.html`, `.htaccess`, `ayarlar.ornek.php`.
4. Tarayıcıda **`https://alanadiniz.com/ders/`** adresini açın.
   **"Sunucu çalışıyor ✓ · hesap henüz kurulmadı"** yazısını görmelisiniz.
5. Dosya Yöneticisi'nde `ders` klasörünü yenileyin: içinde **`veri`** klasörü oluşmuş olmalı. İçindeki
   **`KURULUM-KODU.txt`** dosyasını açın ve 10 karakterlik **kurulum kodunu** not edin.
   (Bu kod yalnızca hosting panelinize girebilen kişi tarafından görülebilir; böylece sunucuyu sizden önce bulan biri
   hesabı açamaz. Hesap oluşturulunca dosya kendiliğinden silinir.)

> Klasör izinleri: Sunucu ilk açılışta `ders/veri` klasörünü kendisi oluşturur. "Veri klasörü oluşturulamadı"
> hatası görürseniz Dosya Yöneticisi'nden `ders` klasörünün iznini **755** yapın.

## 4. Telefonda hesabı oluşturun (ilk cihaz)

1. Uygulamada **Ayarlar → Eşitleme**.
2. Sunucu adresi: `alanadiniz.com/ders` → **Devam**.
3. "Sunucu hazır; henüz hesap yok" yazar. **Kurulum kodunu**, bir **kullanıcı adını** ve **güçlü bir parolayı** girin
   (en az 10 karakter; ör. bir cümlenin kelimeleri: `MaviKalem-Sabah7-Defter`), cihaz adını "Telefon" bırakın
   → **Hesap oluştur ve bağlan**.
4. Telefondaki tüm veriler şifrelenip sunucuya gönderilir. "Eşitlendi · az önce" yazısını görünce tamamdır.

## 5. Tabletten bağlanın

1. Tablette **Ayarlar → Eşitleme**, aynı adres → **Devam**.
2. Aynı kullanıcı adı ve parola, cihaz adı "Tablet" → **Giriş yap ve bağlan**.
3. Tablette de veri varsa sorulur:
   - **Sunucudakini kullan (önerilen):** Tablet, telefondaki verilerle aynı olur. Tabletin eski verisi ayrıca saklanır.
   - **Birleştir:** İki taraf birleşir. (İki cihaza ayrı ayrı aynı kurum programı yüklendiyse dersler iki kez görünebilir.)

Bundan sonra bir cihazda yaptığınız değişiklik birkaç saniye içinde ötekine geçer. Uygulama açılırken,
uygulamaya dönünce ve açıkken dakikada bir de kendiliğinden eşitlenir. İnternet yokken de kullanabilirsiniz;
bağlantı gelince eşitlenir.

## Nasıl çalışır?

- Veriler kayıt kayıt eşitlenir; yalnızca değişenler gönderilir (az internet kullanır).
- Aynı kaydı iki cihazda aynı anda değiştirirseniz **son yapılan değişiklik** geçerli olur.
- Silinen kayıtlar öteki cihazdan da silinir (30 gün çöp kutusunda kalır).
- Cihaza özel ayarlar eşitlenmez: uygulama kilidi (PIN), yazı boyutu, güncelleme ayarı.
- Görevlere eklenen **dosya ve fotoğraflar şimdilik eşitlenmez**; eklendikleri cihazda kalır.

## Güvenlik önerileri

Ayrıntılı inceleme ve test sonuçları: [GUVENLIK.md](GUVENLIK.md).

- **Telefon kaybolursa / çalınırsa:** Öteki cihazda Ayarlar → Eşitleme → Bağlı cihazlar → kaybolan cihazın yanındaki
  **Kaldır**. O cihaz artık eşitleme yapamaz.
- **GitHub hesabınızda iki adımlı doğrulamayı açın** (güncellemeler oradan geldiği için).
- Sunucu adresi **https://** olmalı; uygulama şifresiz (http) internet adreslerini kabul etmez.
- **Parolayı bir yere not edin.** Unutursanız: Ayarlar → Eşitleme → bağlantıyı kesin, sunucudaki `ders/veri`
  klasörünü silin ve hesabı yeniden oluşturun (veriler cihazlardan tekrar gönderilir).
- Daha da güvenli olsun isterseniz veri klasörünü web kökünün dışına alın: `ayarlar.ornek.php` dosyasının adını
  `ayarlar.php` yapıp içindeki `$DATA_DIR` satırını açın (ör. `/home/kullaniciadi/ders-veri`).
- 15 dakikada 10 hatalı giriş denemesinden sonra sunucu girişleri geçici olarak durdurur.
- Uygulamadaki **Ayarlar → Yedek al** yedekleri yine çalışır; ara sıra bir yedeği kendinize göndermeniz iyi olur.

## Sorun giderme

| Belirti | Çözüm |
|---|---|
| "Sunucuya ulaşılamadı" | Adresi kontrol edin (`alanadiniz.com/ders`), tarayıcıda `https://alanadiniz.com/ders/` açılıyor mu bakın. |
| "Bu adreste Ders Asistanı sunucusu bulunamadı" | Dosyalar yanlış klasörde olabilir; `api.php` doğrudan `ders` klasöründe olmalı. |
| "Hostingde PDO SQLite eklentisi yok" | Hosting panelinde **PHP Ayarları / Select PHP Version → Extensions** bölümünden `pdo_sqlite`'ı açın. |
| "Oturum açılmamış" / "Oturum geçersiz" | Bazı hostingler giriş bilgisini iletmez; `.htaccess` dosyasının yüklendiğinden emin olun (gizli dosyaları gösterin). Sonra bağlantıyı kesip yeniden giriş yapın. |
| "Kullanıcı adı ya da parola yanlış" | Kullanıcı adında büyük/küçük harf fark etmez ama parola birebir aynı olmalı. |
| "Kurulum kodu yanlış" | `ders/veri/KURULUM-KODU.txt` dosyasındaki 10 karakterlik kodu girin (boşluksuz). |
| "Çok fazla hatalı deneme" | Güvenlik için 15 dakika bekleyin. |
| "Güvenlik için sunucu adresi https:// ile başlamalı" | Hosting panelinden SSL'i açın. |

---

## Güncellemeler (APK kurmadan)

v0.11 ve sonrasında uygulama yenilikleri **kendisi indirir**:

- Çoğu güncelleme yalnızca arayüzü değiştirir: arka planda indirilir, doğrulanır, ekranın altında
  **"Yeni sürüm hazır · Yeniden başlat"** çıkar. Dokunmasanız da bir sonraki açılışta yeni sürüm açılır.
- Nadiren Android tarafı da değişir; o zaman **"Kur"** düğmesi çıkar: APK uygulamanın içinde indirilir ve
  Android'in kurulum ekranı açılır, **"Yükle"**ye dokunmanız yeterli (Play Store dışındaki uygulamalarda
  Android bu tek onayı her zaman ister). İlk seferde "Bu kaynaktan yüklemeye izin ver" ayarını açmanız istenir.
- Yeni bir arayüz güncellemesi açılamazsa uygulama üç denemeden sonra kendiliğinden önceki sürüme döner.
- Ayarlar → Güncellemeler'den otomatik indirmeyi kapatabilir ya da "Şimdi denetle" diyebilirsiniz.
