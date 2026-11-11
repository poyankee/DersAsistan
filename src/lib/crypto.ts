/** Yedek dosyasını parola ile şifreler (AES-256-GCM, anahtar PBKDF2 ile paroladan türetilir) */

const MARK = 'ders-asistani-sifreli-yedek'
const ITER = 250_000

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function keyFrom(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptText(text: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFrom(password, salt), new TextEncoder().encode(text))
  return JSON.stringify({ format: MARK, v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) })
}

export function isEncrypted(obj: unknown): obj is { format: string; salt: string; iv: string; data: string } {
  return typeof obj === 'object' && obj !== null && (obj as { format?: string }).format === MARK
}

/** Parola yanlışsa hata fırlatır */
export async function decryptText(obj: { salt: string; iv: string; data: string }, password: string): Promise<string> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(obj.iv) }, await keyFrom(password, unb64(obj.salt)), unb64(obj.data))
    return new TextDecoder().decode(plain)
  } catch {
    throw new Error('Parola yanlış ya da dosya bozuk')
  }
}
