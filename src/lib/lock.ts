/** Uygulama kilidi: PIN düz metin olarak saklanmaz, tuzlanmış özeti saklanır */

export interface LockInfo {
  salt: string
  hash: string
}

async function digest(salt: string, pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${pin}`))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function makeLock(pin: string): Promise<LockInfo> {
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { salt, hash: await digest(salt, pin) }
}

export async function checkPin(lock: LockInfo, pin: string): Promise<boolean> {
  return (await digest(lock.salt, pin)) === lock.hash
}
