/** Uygulama sürümü ve "bu sürümde neler değişti" listesi (Ayarlar → Yenilikler) */
export const APP_VERSION = '0.9'

export const CHANGELOG: { version: string; items: string[] }[] = [
  {
    version: '0.9',
    items: [
      'Görevler artık ayrı bir sekme: yapılacaklar listesi (gecikenler, bugün, bu hafta, daha sonra)',
      'Ödemelerim (Raporlar): kredi kartı, kira, fatura gibi aylık ödemeler; ödendi işareti, aylık ve 12 aylık toplu görünüm',
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
