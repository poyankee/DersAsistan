import { useEffect, useRef, useState } from 'react'

/**
 * Uzun listeleri parça parça çizer: önce ilk `step` öğe, kullanıcı aşağı indikçe
 * (ya da "Daha fazla göster"e basınca) sıradaki parça eklenir. Yıllar içinde
 * yüzlerce kayıt biriktiğinde sayfaların hızlı açılmasını sağlar.
 */
export function useIncremental<T>(list: T[], step = 60): [T[], JSX.Element | null] {
  const [limit, setLimit] = useState(step)
  const ref = useRef<HTMLButtonElement>(null)
  const rest = list.length - limit

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setLimit((l) => l + step), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [step, rest > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const more =
    rest > 0 ? (
      <button ref={ref} className="btn small ghost show-more" onClick={() => setLimit((l) => l + step)}>
        Daha fazla göster ({rest} kaldı)
      </button>
    ) : null
  return [rest > 0 ? list.slice(0, limit) : list, more]
}
