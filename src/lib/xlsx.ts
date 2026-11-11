import { unzipSync, strFromU8 } from 'fflate'

/**
 * Küçük .xlsx okuyucu: ilk sayfayı satır/hücre metinleri olarak döndürür.
 * (.xlsx aslında içinde XML dosyaları olan bir zip arşividir.)
 */
export function rowsFromXlsx(buf: ArrayBuffer): string[][] {
  const files = unzipSync(new Uint8Array(buf), { filter: (f) => f.name === 'xl/sharedStrings.xml' || /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name) })
  const sheetName = Object.keys(files)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))[0]
  if (!sheetName) throw new Error('Excel dosyasında sayfa bulunamadı')
  const parse = (name: string) => new DOMParser().parseFromString(strFromU8(files[name]), 'application/xml')

  // Ortak metin tablosu (hücreler metinleri numarayla gösterir)
  const shared: string[] = []
  if (files['xl/sharedStrings.xml']) {
    for (const si of Array.from(parse('xl/sharedStrings.xml').getElementsByTagName('si'))) {
      shared.push(Array.from(si.getElementsByTagName('t')).filter((t) => t.parentElement?.tagName !== 'rPh').map((t) => t.textContent ?? '').join(''))
    }
  }

  const col = (ref: string) => {
    let n = 0
    for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64)
    return n - 1
  }
  const rows: string[][] = []
  for (const row of Array.from(parse(sheetName).getElementsByTagName('row'))) {
    const out: string[] = []
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const t = c.getAttribute('t')
      const v = c.getElementsByTagName('v')[0]?.textContent ?? ''
      let text = v
      if (t === 's') text = shared[Number(v)] ?? ''
      else if (t === 'inlineStr') text = Array.from(c.getElementsByTagName('t')).map((x) => x.textContent ?? '').join('')
      const i = c.getAttribute('r') ? col(c.getAttribute('r')!) : out.length
      while (out.length < i) out.push('')
      out[i] = text
    }
    rows.push(out)
  }
  return rows
}
