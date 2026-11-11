/** Hata günlüğü: uygulamada oluşan hatalar cihazda saklanır, Ayarlar'dan paylaşılabilir */

const KEY = 'ders-asistan-hatalar'
const MAX = 30

export interface LoggedError {
  at: string
  message: string
  stack?: string
  where?: string
}

export function readErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LoggedError[]
  } catch {
    return []
  }
}

export function logError(err: unknown, where?: string) {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err))
    const list = readErrors()
    // Aynı hata art arda gelirse günlüğü doldurmasın
    if (list[0]?.message === e.message && list[0]?.where === where) return
    list.unshift({ at: new Date().toISOString(), message: e.message, stack: e.stack?.split('\n').slice(0, 8).join('\n'), where })
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* günlük yazılamazsa uygulamayı etkilemesin */
  }
}

export function clearErrors() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* yok say */
  }
}

export function installErrorLogging() {
  window.addEventListener('error', (e) => logError(e.error ?? e.message, 'pencere'))
  window.addEventListener('unhandledrejection', (e) => logError(e.reason, 'söz'))
}

/** Paylaşılabilir metin raporu (kişisel veri içermez: yalnızca hata metinleri ve cihaz bilgisi) */
export function errorReport(version: string): string {
  const list = readErrors()
  return [
    `Ders Asistanı ${version} — hata raporu`,
    `Tarih: ${new Date().toISOString()}`,
    `Cihaz: ${navigator.userAgent}`,
    `Ekran: ${window.innerWidth}x${window.innerHeight}`,
    '',
    ...list.map((e, i) => `#${i + 1} ${e.at} [${e.where ?? '-'}]\n${e.message}\n${e.stack ?? ''}\n`),
    list.length ? '' : '(Kayıtlı hata yok)',
  ].join('\n')
}
