import { useId, useMemo } from 'react'

// Generative landscapes of Kaziranga — the national park the house is named
// after: fog over floodplain grassland, the Karbi hills behind, a wetland
// strip, tall elephant grass in front. Each scene is seeded, so a project
// always gets the same place, and every project gets a different one.

const W = 1600
const H = 900

export const PALETTES = {
  mist: { sky: ['#c9d2cd', '#eceee8'], sun: '#ffffff', far: ['#adb8b1', '#949f97'], mid: '#6c7d6f', water: '#d3dcd6', grass: ['#5c6d5b', '#435242'], fog: '#f4f6f2', deep: '#283028' },
  dawn: { sky: ['#e4c3ac', '#f4e5d6'], sun: '#fff4e6', far: ['#bea79e', '#a38d87'], mid: '#7b6f62', water: '#ecd9c8', grass: ['#6b634e', '#4f4838'], fog: '#fbf2e9', deep: '#352d26' },
  monsoon: { sky: ['#a5b5bd', '#d6dee0'], sun: '#f0f4f5', far: ['#8d9ea5', '#73868d'], mid: '#536669', water: '#c1ced2', grass: ['#4a5e57', '#354640'], fog: '#e8eff0', deep: '#222c2b' },
  dusk: { sky: ['#b7a4c3', '#e4d8e2'], sun: '#fdf0f4', far: ['#9c8ca5', '#80708b'], mid: '#5e5367', water: '#d9ccd9', grass: ['#594d5d', '#413846'], fog: '#f0e8ef', deep: '#2c2631' },
  gold: { sky: ['#d6c393', '#f0e7c9'], sun: '#fff9e3', far: ['#ab9f7d', '#908667'], mid: '#656748', water: '#e4ddc0', grass: ['#6e7040', '#53552e'], fog: '#f8f3df', deep: '#2f2e1c' },
}
const NAMES = Object.keys(PALETTES)

function hash(text) {
  let value = 2166136261
  for (const char of String(text)) {
    value ^= char.codePointAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

function seeded(seed) {
  let state = hash(seed) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function paletteFor(seed) {
  return PALETTES[NAMES[hash(`palette:${seed}`) % NAMES.length]]
}

// Smooth closed silhouette through noisy points (Catmull-Rom as cubic Béziers).
function ridge(random, base, amplitude, step = 50) {
  const waves = Array.from({ length: 3 }, () => ({
    phase: random() * Math.PI * 2,
    cycles: 0.5 + random() * 2.2,
    height: amplitude * (0.3 + random() * 0.7),
  }))
  const total = waves.reduce((sum, wave) => sum + wave.height, 0)
  const points = []
  for (let x = -step; x <= W + step; x += step) {
    const lift = waves.reduce((sum, wave) => sum + wave.height * (Math.sin((x / W) * Math.PI * 2 * wave.cycles + wave.phase) + 1) / 2, 0)
    points.push([x, base - (lift / total) * amplitude])
  }
  let path = `M ${points[0][0]} ${H} L ${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const [p0, p1, p2, p3] = [points[i - 1] || points[i], points[i], points[i + 1], points[i + 2] || points[i + 1]]
    path += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`
  }
  return `${path} L ${W + step} ${H} Z`
}

// A distant line of rounded tree crowns, with the odd tall silk-cotton tree.
function treeline(random, base) {
  let path = `M -20 ${H} L -20 ${base}`
  let x = -20
  while (x < W + 20) {
    if (random() < 0.22) {
      const gap = 10 + random() * 60
      path += ` L ${x + gap} ${base}`
      x += gap
    }
    const radius = 6 + random() * 15
    const height = random() < 0.07 ? radius * 3.4 : radius * (1 + random() * 0.9)
    path += ` Q ${x + radius} ${base - height * 2} ${x + radius * 2} ${base}`
    x += radius * 2
  }
  return `${path} L ${W + 20} ${H} Z`
}

// Tall floodplain grass: a spiky top edge with blades leaning a little.
function grass(random, base, low, high, spacing) {
  let path = `M -10 ${H} L -10 ${base}`
  for (let x = -10; x < W + 10; x += spacing * (0.6 + random() * 0.8)) {
    const height = low + random() * (high - low)
    path += ` L ${x + (random() - 0.5) * 7} ${base - height} L ${x + spacing * 0.5} ${base - random() * 3}`
  }
  return `${path} L ${W + 10} ${H} Z`
}

const RHINO = 'M0 22C2 12 12 6 26 6C38 6 44 10 48 14L54 12L56 5L58 13C61 15 62 19 60 22L56 24C54 25 52 25 50 24L48 31L44 31L44 25C36 27 22 27 16 25L15 31L11 31L10 24C6 24 3 24 0 22Z'

export default function KazirangaScene({ seed = 'binary-minds', detail = false, animated = false, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const scene = useMemo(() => {
    const random = seeded(seed)
    const palette = paletteFor(seed)
    const sun = { x: W * (0.18 + random() * 0.64), y: 170 + random() * 170, r: 70 + random() * 60 }
    const streaks = Array.from({ length: 7 }, () => ({ x: random() * W, y: 644 + random() * 22, w: 60 + random() * 260 }))
    const birds = Array.from({ length: 3 + Math.floor(random() * 3) }, () => ({ x: W * (0.15 + random() * 0.7), y: 120 + random() * 160, s: 6 + random() * 7 }))
    return {
      palette,
      sun,
      streaks,
      birds,
      farA: ridge(random, 470, 150),
      farB: ridge(random, 545, 95, 40),
      trees: treeline(random, 640),
      grassBack: grass(random, 712, 6, 26, 9),
      grassFront: grass(random, 792, 16, 64, 11),
      rhinoX: W * (0.52 + random() * 0.3),
    }
  }, [seed])
  const { palette: p } = scene

  return (
    <svg className={`kz-scene ${animated ? 'kz-animated' : ''} ${className}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.75" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`${uid}fog`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.fog} stopOpacity="0" />
          <stop offset="0.5" stopColor={p.fog} stopOpacity="0.75" />
          <stop offset="1" stopColor={p.fog} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.fog} stopOpacity="0" />
          <stop offset="1" stopColor={p.fog} stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${uid}soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="34" /></filter>
        <filter id={`${uid}haze`}><feGaussianBlur stdDeviation="2.2" /></filter>
        {detail && (
          <filter id={`${uid}grain`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
          </filter>
        )}
      </defs>

      <rect width={W} height={H} fill={`url(#${uid}sky)`} />
      <circle cx={scene.sun.x} cy={scene.sun.y} r={scene.sun.r * 1.9} fill={p.sun} opacity="0.55" filter={`url(#${uid}soft)`} />
      <circle cx={scene.sun.x} cy={scene.sun.y} r={scene.sun.r * 0.45} fill={p.sun} opacity="0.8" />

      {detail && scene.birds.map((bird, index) => (
        <path key={index} d={`M ${bird.x - bird.s} ${bird.y - bird.s * 0.4} Q ${bird.x - bird.s * 0.45} ${bird.y - bird.s * 0.55} ${bird.x} ${bird.y} Q ${bird.x + bird.s * 0.45} ${bird.y - bird.s * 0.55} ${bird.x + bird.s} ${bird.y - bird.s * 0.4}`} fill="none" stroke={p.mid} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
      ))}

      <path d={scene.farA} fill={p.far[0]} filter={`url(#${uid}haze)`} />
      <g className="kz-drift-a"><rect x={-W * 0.1} y="400" width={W * 1.2} height="200" fill={`url(#${uid}fog)`} /></g>
      <path d={scene.farB} fill={p.far[1]} />
      <g className="kz-drift-b"><rect x={-W * 0.1} y="520" width={W * 1.2} height="150" fill={`url(#${uid}fog)`} opacity="0.85" /></g>
      <path d={scene.trees} fill={p.mid} />

      <rect y="636" width={W} height="34" fill={p.water} />
      {scene.streaks.map((streak, index) => (
        <rect key={index} x={streak.x} y={streak.y} width={streak.w} height="1.6" rx="1" fill="#ffffff" opacity="0.55" />
      ))}
      <g className="kz-drift-a"><rect x={-W * 0.1} y="600" width={W * 1.2} height="110" fill={`url(#${uid}fog)`} opacity="0.5" /></g>

      <path d={scene.grassBack} fill={p.grass[0]} />
      {detail && <path d={RHINO} transform={`translate(${scene.rhinoX} 676) scale(1.15)`} fill={p.grass[1]} opacity="0.85" />}
      <path d={scene.grassFront} fill={p.grass[1]} />
      <rect y="700" width={W} height="200" fill={`url(#${uid}ground)`} />

      {detail && <rect width={W} height={H} filter={`url(#${uid}grain)`} opacity="0.16" style={{ mixBlendMode: 'overlay' }} />}
    </svg>
  )
}
