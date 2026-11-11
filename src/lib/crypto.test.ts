// @vitest-environment node
import { decryptText, encryptText, isEncrypted } from './crypto'

describe('şifreli yedek', () => {
  it('doğru parolayla açılır, yanlış parolayla açılmaz, içerik düz metin olarak görünmez', async () => {
    const secret = JSON.stringify({ students: [{ name: 'Ayşe Yılmaz', fee: 800 }] })
    const enc = await encryptText(secret, 'gizli-parola')
    expect(enc).not.toContain('Ayşe')
    const obj = JSON.parse(enc)
    expect(isEncrypted(obj)).toBe(true)
    expect(await decryptText(obj, 'gizli-parola')).toBe(secret)
    await expect(decryptText(obj, 'yanlış')).rejects.toThrow(/Parola/)
  })
})
