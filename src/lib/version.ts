/** Uygulama sürümü ve "bu sürümde neler değişti" listesi (Ayarlar → Yenilikler) */
export const APP_VERSION = '0.12'

/** Bu arayüz paketinin derleme numarası (yerelde 0) */
export const BUILD: number = typeof __BUILD__ === 'number' ? __BUILD__ : 0

/**
 * Bu arayüzün ihtiyaç duyduğu yerel (Android) kod düzeyi. Android tarafındaki
 * UpdaterPlugin.NATIVE_LEVEL ile aynı tutulur; yalnızca android/ klasöründe değişiklik olunca artırılır.
 * Telefondaki düzey daha düşükse güncelleme APK ile yapılır.
 */
export const NATIVE_LEVEL = 1

export const CHANGELOG: { version: string; items: string[] }[] = [
  {
    version: '0.12',
    items: [
      'Yeni ana sayfa: günün dersleri zaman çizelgesi, sıradaki ders, hızlı işlemler, görevler, bu hafta, takvim, notlarım, yaklaşanlar',
      'Ödeme hatırlatıcısı: ödemesi alınmamış dersler için menüde baloncuk ve zil; tek dokunuşla "Alındı" ya da "Sonra"',
      'Kurum ödemeleri: Raporlar → Puantaj / Kurum; puantajla karşılaştırma, giren/çıkan\'a gerçek tutar',
      'Öğrenci dosyası: ders kayıtları ve notlar ayrı sekmelerde',
      'Ders düzeni: tek seferlik dersler "Her … günü" diye görünmez',
      'Takvim: dersi haftanın kenarına sürükleyip bekletince önceki/sonraki haftaya geçer',
    ],
  },
  {
    version: '0.11',
    items: [
      'Telefon ↔ tablet eşitleme: kendi hostinginize kurduğunuz sunucu ile; veriler cihazda şifrelenir',
      'Uygulama içi güncelleme: yenilikler kendiliğinden iner, APK kurmanız gerekmez',
      'Ayarlar\'da Eşitleme ve Güncellemeler bölümleri',
      'Güvenlik: kurulum kodu, kaba kuvvete karşı sınırlar, kaybolan cihazı kaldırma, şifreli silme işaretleri, yalnızca HTTPS',
    ],
  },
  {
    version: '0.10',
    items: [
      'Android geri hareketi artık önceki ekrana döner (en sonda uygulamadan çıkar)',
      'Görevler: kategoriler ve kategoriye göre süzme, sıralama (en yeni üstte), önemli işareti',
      'Görev ayrıntıları: alt adımlar, fotoğraf / dosya ekleme',
      'Yeni görev yazarken listenin titremesi giderildi',
      'Takvimde kutularda yalnızca ad; saat dokununca görünür',
      'Takvimi haftalık / aylık PDF olarak alma ve yazdırma; ders dökümü de telefonda PDF olabilir',
      'Arama kutusu yenilendi',
    ],
  },
  {
    version: '0.9',
    items: [
      'Görevler artık ayrı bir sekme: yapılacaklar listesi (gecikenler, bugün, bu hafta, daha sonra)',
      'Ödemelerim (Raporlar): kredi kartı, kira, fatura gibi aylık ödemeler; ödendi işareti, aylık ve 12 aylık toplu görünüm',
      'Ödemelerim: son günden önce bildirim, takvimin ay görünümünde ödeme günleri, aylık giren / çıkan / kalan',
      'Google Takvim yedeğini (.zip / .ics) içe aktarma; tekrar yüklemede kopya oluşmaz',
      'Takvim ay görünümünde güne dokununca yan panelde o günün listesi ve "Güne git"',
      'Öğrenci dosyası → Bilgiler: kendi alanlarınızı ekleyin (okul, veli adı, hedef…)',
      'Yeni ana ekran widget\'ı: ana renkte başlık, şu an / sıradaki ders, renkli ders listesi, görevler, hızlı ekleme, koyu tema',
      'Ders dökümünden geri dönememe (beyaz ekran) hatası giderildi',
    ],
  },
  {
    version: '0.8',
    items: [
      'Yeni, daha canlı tasarım; ana renk Ayarlar\'dan seçilebilir',
      'Genel arama: öğrenci, sınıf, konu ve ödevlerde',
      'İptal edilen derse telafi planlama',
      'Ders kayıtları ve ödeme dökümü (paylaş / yazdır)',
      'Uygulama kilidi (PIN)',
      'Otomatik günlük yedek, parolalı yedek, bozuk veriye karşı sağlam kopyalar',
      'Hata raporu, kullanım kılavuzu',
    ],
  },
  { version: '0.7', items: ['Sadeleştirme: sade etkinlik formu, "ne yaptık" yalnızca öğrenci ve sınıf dosyasında', 'Öğrenci dosyası: Dersler / Ödeme işlemleri / Bilgiler', 'Kişisel etkinlikler ve yüksek lisans takibi', 'Tarihler gün.ay.yıl'] },
  { version: '0.6', items: ['Sade ödeme modeli', '3 günlük görünüm, kaydırma ve yakınlaştırma', 'Görevler, sınav takvimi, bildirimler'] },
]
