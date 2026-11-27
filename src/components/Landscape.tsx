import { memo, useId } from 'react'
import type { SceneDef } from '../lib/scenes'

type Variant = 'full' | 'hero' | 'side' | 'card'

/** Tekrarlanabilir sözde rastgele sayılar (her çizimde aynı manzara) */
function rng(seed: number) {
  let s = seed
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

/** Çam ağacı yolu: üç kat, gövde ile */
function pine(x: number, base: number, h: number): string {
  const tiers = [[0.62, 0.15], [0.34, 0.21], [0.1, 0.27]] as const
  const top = base - h
  const r: string[] = [`M${x} ${top}`]
  let prevY = top
  tiers.forEach(([y, w], i) => {
    const ty = base - h * y
    if (i > 0) r.push(`L${x + w * h * 0.45} ${prevY}`)
    r.push(`L${x + w * h} ${ty}`)
    prevY = ty
  })
  const t = Math.max(2, h * 0.035)
  r.push(`L${x + t} ${prevY}L${x + t} ${base}L${x - t} ${base}L${x - t} ${prevY}`)
  ;[...tiers].reverse().forEach(([y, w], i, arr) => {
    const ty = base - h * y
    r.push(`L${x - w * h} ${ty}`)
    const next = arr[i + 1]
    if (next) r.push(`L${x - next[1] * h * 0.45} ${ty}`)
  })
  return r.join('') + 'Z'
}

/** Ağaçlar: [x başlangıç, x bitiş, adet, en küçük boy, en büyük boy, taban y] */
function forest(seed: number, groups: [number, number, number, number, number, number][]): string {
  const rand = rng(seed)
  let d = ''
  for (const [a, b, n, hmin, hmax, base] of groups) {
    for (let i = 0; i < n; i++) {
      const x = a + ((b - a) * (i + rand() * 0.8)) / n
      d += pine(x, base + rand() * 10, hmin + rand() * (hmax - hmin))
    }
  }
  return d
}

const FAR = 'M0 250L120 205L210 232L330 168L450 228L560 192L700 118L820 204L930 172L1050 218L1200 184V400H0Z'
const MID = 'M0 292L150 238L262 276L392 212L520 282L640 248L762 170L884 262L1002 228L1122 272L1200 250V400H0Z'
const MID_SHADE = 'M762 170L884 262L842 400L780 400Z M392 212L520 282L470 400L420 400Z M120 205L210 232L180 300Z M700 118L820 204L760 260Z'
const NEAR = 'M0 334C180 306 330 322 520 338S880 304 1200 322V400H0Z'
const NEAR_MEADOW = 'M0 330C260 300 520 340 760 320S1060 300 1200 312V400H0Z'
const SNOW = 'M700 118L724 138L712 134L700 146L690 134L676 140Z M762 170L784 186L772 184L762 194L752 184L740 188Z M330 168L350 184L338 182L330 192L320 182L310 186Z'

const BACK_TREES = forest(7, [[0, 300, 9, 40, 70, 318], [880, 1200, 10, 40, 72, 314], [420, 760, 6, 26, 40, 330]])
const FRONT_TREES = forest(11, [[-10, 250, 7, 70, 130, 400], [940, 1210, 8, 70, 135, 400], [470, 720, 4, 34, 52, 392]])
const FRONT_FEW = forest(13, [[-10, 220, 5, 70, 125, 400], [520, 700, 3, 30, 46, 392]])

/**
 * Temanın manzarası (dağlar, ağaçlar, güneş ya da ay). Renkler CSS değişkenlerinden gelir;
 * koyu temada gece hâli (ay ve yıldızlar) kendiliğinden görünür.
 */
function Landscape({ scene, variant = 'full', className }: { scene: SceneDef; variant?: Variant; className?: string }) {
  const id = useId().replace(/:/g, '')
  const sky = variant === 'full' || variant === 'side'
  const ex = scene.extra
  return (
    <svg className={'landscape ' + (className ?? '')} viewBox="0 0 1200 400" preserveAspectRatio={variant === 'side' ? 'xMidYMax slice' : 'xMaxYMax slice'} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sky${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--sc-sky1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--sc-sky2)' }} />
        </linearGradient>
        <radialGradient id={`glow${id}`}>
          <stop offset="0" style={{ stopColor: 'var(--sc-sun)', stopOpacity: 0.7 }} />
          <stop offset="1" style={{ stopColor: 'var(--sc-sun)', stopOpacity: 0 }} />
        </radialGradient>
        <mask id={`moon${id}`}>
          <circle cx="930" cy="96" r="30" fill="#fff" />
          <circle cx="944" cy="86" r="27" fill="#000" />
        </mask>
      </defs>
      {sky && <rect width="1200" height="400" fill={`url(#sky${id})`} />}
      <g className="ls-night">
        {[[120, 60], [260, 110], [410, 40], [540, 90], [660, 30], [1080, 70], [1150, 130], [820, 60], [320, 160], [990, 150]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} style={{ fill: 'var(--sc-moon)' }} opacity={0.75} />
        ))}
        <circle cx="930" cy="96" r="70" fill={`url(#glow${id})`} opacity=".5" />
        <rect x="880" y="50" width="100" height="100" mask={`url(#moon${id})`} style={{ fill: 'var(--sc-moon)' }} />
      </g>
      <g className="ls-day">
        <circle cx="930" cy="110" r="110" fill={`url(#glow${id})`} />
        <circle cx="930" cy="110" r="44" style={{ fill: 'var(--sc-sun)' }} />
        <g fill="#fff" opacity=".35">
          <ellipse cx="300" cy="90" rx="70" ry="14" />
          <ellipse cx="350" cy="80" rx="44" ry="16" />
          <ellipse cx="640" cy="60" rx="60" ry="11" />
        </g>
      </g>
      <path d={FAR} style={{ fill: 'var(--sc-m3)' }} />
      <path d={MID} style={{ fill: 'var(--sc-m2)' }} />
      <path d={MID_SHADE} fill="#000" opacity=".07" />
      {ex === 'snow' && <path d={SNOW} style={{ fill: 'var(--sc-snow)' }} />}
      {ex !== 'meadow' && <path d={BACK_TREES} style={{ fill: 'var(--sc-tree2)' }} />}
      <path d={ex === 'meadow' ? NEAR_MEADOW : NEAR} style={{ fill: 'var(--sc-m1)' }} />
      {ex === 'lake' && (
        <g>
          <path d="M330 352C520 338 720 338 900 352L900 366C720 356 520 356 330 368Z" style={{ fill: 'var(--sc-lake)' }} opacity=".85" />
          <path d="M420 357H520M600 352H720M760 360H840" stroke="#fff" strokeWidth="2" opacity=".5" strokeLinecap="round" />
        </g>
      )}
      {ex === 'meadow' ? (
        <g>
          <path d={FRONT_FEW} style={{ fill: 'var(--sc-tree)' }} />
          <rect x="1006" y="282" width="14" height="70" rx="4" style={{ fill: 'var(--sc-trunk)' }} />
          <g style={{ fill: 'var(--sc-tree)' }}>
            <circle cx="1013" cy="262" r="46" />
            <circle cx="970" cy="280" r="32" />
            <circle cx="1058" cy="280" r="34" />
            <circle cx="1010" cy="226" r="32" />
          </g>
          <circle cx="996" cy="248" r="18" fill="#fff" opacity=".1" />
        </g>
      ) : (
        <path d={FRONT_TREES} style={{ fill: 'var(--sc-tree)' }} />
      )}
      {ex === 'snow' && <path d={FRONT_TREES} style={{ fill: 'var(--sc-snow)' }} opacity=".28" transform="translate(0 -3)" />}
      {ex === 'leaves' && variant !== 'side' && (
        <g className="ls-leaves">
          <path d="M-10 40C80 60 150 50 230 90S330 120 380 112" style={{ stroke: 'var(--sc-trunk)' }} strokeWidth="9" fill="none" strokeLinecap="round" />
          <path d="M150 62C170 30 200 26 220 20M260 98C280 130 300 140 330 148" style={{ stroke: 'var(--sc-trunk)' }} strokeWidth="4" fill="none" strokeLinecap="round" />
          {[[40, 52, 20], [80, 70, -30], [110, 44, 40], [150, 78, -10], [180, 40, 60], [210, 22, 10], [230, 104, -40], [260, 76, 30], [290, 128, 0], [320, 100, 50], [350, 130, -20], [200, 120, 70], [120, 96, -60], [60, 30, 10], [330, 150, 20]].map(([x, y, r], i) => (
            <ellipse key={i} cx={x} cy={y} rx="16" ry="8" transform={`rotate(${r} ${x} ${y})`} style={{ fill: i % 3 ? 'var(--sc-leaf)' : 'var(--sc-leaf2)' }} />
          ))}
          {[[440, 170, 30], [520, 230, -20], [600, 190, 60]].map(([x, y, r], i) => (
            <ellipse key={'f' + i} className="ls-fall" cx={x} cy={y} rx="9" ry="5" transform={`rotate(${r} ${x} ${y})`} style={{ fill: 'var(--sc-leaf)' }} />
          ))}
        </g>
      )}
    </svg>
  )
}

export default memo(Landscape)
