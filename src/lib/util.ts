export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export const PALETTE = [
  '#1a73e8', '#d50000', '#33b679', '#8e24aa', '#f4511e', '#039be5',
  '#e67c73', '#0b8043', '#3f51b5', '#f6bf26', '#7986cb', '#616161',
]

export function colorFor(key: string): string {
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

export function money(n: number, currency = '₺'): string {
  return `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency}`
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
