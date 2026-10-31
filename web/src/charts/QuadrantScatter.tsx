import { useMemo, useState, type MouseEvent } from 'react'
import type { Quadrant } from '../data/charts.ts'
import { linear } from './scale.ts'
import { useWidth } from './useWidth.ts'

export interface ScatterPoint {
  id: string
  x: number
  y: number
  name: string
  /** Team-colored dots on the teams chart; default is the neutral field gray. */
  fill?: string
}

export interface ScatterMark {
  id: string
  x: number
  y: number
  label: string
  color: string
  shape?: 'circle' | 'square'
  /** Below the qualifier line: drawn as a ring, not a filled dot. */
  hollow?: boolean
}

interface Props {
  points: ScatterPoint[]
  marks: ScatterMark[]
  avgX: number | null
  avgY: number | null
  quadrants: Record<Quadrant, string>
  xAxis: string
  yAxis: string
  formatX: (v: number) => string
  formatY: (v: number) => string
  xTick?: (v: number) => string
  yTick?: (v: number) => string
  /** Put low values at the top (EPA allowed, where lower is better). */
  invertY?: boolean
  onPick?: (id: string) => void
  ariaLabel: string
}

const M = { top: 6, right: 6, bottom: 26, left: 44 }
const MONO_ADVANCE = 0.6
const LABEL_FONT = 11.5
const LABEL_H = 22

interface Box {
  x: number
  y: number
  w: number
  h: number
}
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

export function QuadrantScatter(p: Props) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<{ id: string; px: number; py: number } | null>(null)
  const height = Math.round(Math.min(420, Math.max(250, width * 0.84)))
  const plot = { x0: M.left, x1: width - M.right, y0: M.top, y1: height - M.bottom }

  const { sx, sy } = useMemo(() => {
    const xs = [...p.points.map((d) => d.x), ...p.marks.map((d) => d.x)]
    const ys = [...p.points.map((d) => d.y), ...p.marks.map((d) => d.y)]
    const sx = linear(xs, [plot.x0, plot.x1], { ticks: width < 420 ? 3 : 4 })
    const sy = linear(ys, p.invertY ? [plot.y0, plot.y1] : [plot.y1, plot.y0], { ticks: 4 })
    return { sx, sy }
  }, [p.points, p.marks, p.invertY, plot.x0, plot.x1, plot.y0, plot.y1, width])

  const quadBoxes: Record<Quadrant, Box & { anchor: 'start' | 'end' }> = useMemo(() => {
    const box = (label: string, right: boolean, bottom: boolean) => {
      const w = label.length * 10.5 * MONO_ADVANCE + 4
      return {
        x: right ? plot.x1 - 10 - w : plot.x0 + 10,
        y: bottom ? plot.y1 - 22 : plot.y0 + 6,
        w,
        h: 16,
        anchor: right ? ('end' as const) : ('start' as const),
      }
    }
    return {
      tl: box(p.quadrants.tl, false, false),
      tr: box(p.quadrants.tr, true, false),
      bl: box(p.quadrants.bl, false, true),
      br: box(p.quadrants.br, true, true),
    }
  }, [p.quadrants, plot.x0, plot.x1, plot.y0, plot.y1])

  // Place each mark label at the first candidate spot that stays inside the plot
  // and clears the corner labels, other marks and earlier labels.
  const labels = useMemo(() => {
    const placed: Box[] = []
    const markBoxes = p.marks.map((m) => ({ x: sx(m.x) - 9, y: sy(m.y) - 9, w: 18, h: 18 }))
    const obstacles: Box[] = [...Object.values(quadBoxes), ...markBoxes]
    return p.marks.map((m) => {
      const cx = sx(m.x)
      const cy = sy(m.y)
      const w = m.label.length * LABEL_FONT * MONO_ADVANCE + 16
      const gap = 12
      const preferLeft = cx > (plot.x0 + plot.x1) / 2
      const sides = preferLeft ? ['l', 'r'] : ['r', 'l']
      const candidates: Box[] = []
      for (const v of [-LABEL_H - 2, 4, -LABEL_H / 2]) {
        for (const s of sides) candidates.push({ x: s === 'l' ? cx - gap - w : cx + gap, y: cy + v, w, h: LABEL_H })
      }
      const inside = (b: Box) => b.x >= plot.x0 + 2 && b.x + b.w <= plot.x1 - 2 && b.y >= plot.y0 + 2 && b.y + b.h <= plot.y1 - 2
      const own = markBoxes[p.marks.indexOf(m)]
      const fits = (b: Box) => inside(b) && !obstacles.some((o) => o !== own && overlaps(b, o)) && !placed.some((o) => overlaps(b, o))
      const box = candidates.find(fits) ?? candidates.find(inside) ?? clampBox(candidates[0]!, plot)
      placed.push(box)
      return { ...box, mark: m }
    })
  }, [p.marks, sx, sy, quadBoxes, plot.x0, plot.x1, plot.y0, plot.y1])

  const all = useMemo(
    () => [
      ...p.points.map((d) => ({ id: d.id, name: d.name, x: d.x, y: d.y })),
      ...p.marks.filter((m) => !p.points.some((d) => d.id === m.id)).map((m) => ({ id: m.id, name: m.label, x: m.x, y: m.y })),
    ],
    [p.points, p.marks],
  )

  function nearest(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let best: { id: string; px: number; py: number; d: number } | null = null
    for (const d of all) {
      const px = sx(d.x)
      const py = sy(d.y)
      const dist = Math.hypot(px - mx, py - my)
      if (dist < 22 && (!best || dist < best.d)) best = { id: d.id, px, py, d: dist }
    }
    return best
  }

  const hovered = hover ? all.find((d) => d.id === hover.id) : null
  const ax = p.avgX == null ? null : sx(p.avgX)
  const ay = p.avgY == null ? null : sy(p.avgY)
  const xTick = p.xTick ?? p.formatX
  const yTick = p.yTick ?? p.formatY

  return (
    <figure className="scatter">
      <div className="axis-title axis-y">{p.yAxis}</div>
      <div className="scatter-plot" ref={ref}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={p.ariaLabel}
          onPointerMove={(e) => {
            if (e.pointerType !== 'mouse') return
            const n = nearest(e)
            setHover(n ? { id: n.id, px: n.px, py: n.py } : null)
          }}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => {
            const n = nearest(e)
            if (n && p.onPick) p.onPick(n.id)
          }}
          style={{ cursor: p.onPick ? 'pointer' : undefined }}
        >
          <rect className="plot-bg" x={plot.x0} y={plot.y0} width={plot.x1 - plot.x0} height={plot.y1 - plot.y0} rx={6} />
          {sx.ticks.map((t) => (
            <g key={`x${t}`}>
              <line className="grid" x1={sx(t)} x2={sx(t)} y1={plot.y0} y2={plot.y1} />
              <text className="tick" x={sx(t)} y={plot.y1 + 18} textAnchor="middle">{xTick(t)}</text>
            </g>
          ))}
          {sy.ticks.map((t) => (
            <g key={`y${t}`}>
              <line className="grid" x1={plot.x0} x2={plot.x1} y1={sy(t)} y2={sy(t)} />
              <text className="tick" x={plot.x0 - 8} y={sy(t) + 4} textAnchor="end">{yTick(t)}</text>
            </g>
          ))}
          {ax != null && <line className="avg" x1={ax} x2={ax} y1={plot.y0} y2={plot.y1} />}
          {ay != null && <line className="avg" x1={plot.x0} x2={plot.x1} y1={ay} y2={ay} />}

          {(Object.keys(quadBoxes) as Quadrant[]).map((q) => {
            const b = quadBoxes[q]
            // A highlighted mark or its label sitting on the corner label wins; fade the label.
            const covered = labels.some((l) => overlaps(l, b) || overlaps({ x: sx(l.mark.x) - 10, y: sy(l.mark.y) - 10, w: 20, h: 20 }, b))
            return (
              <text key={q} className="quad" opacity={covered ? 0.2 : 1} x={b.anchor === 'end' ? b.x + b.w : b.x} y={b.y + 12} textAnchor={b.anchor}>
                {p.quadrants[q].toUpperCase()}
              </text>
            )
          })}

          {p.points.map((d) =>
            d.fill ? (
              <circle key={d.id} className="dot team" cx={sx(d.x)} cy={sy(d.y)} r={5.5} style={{ fill: d.fill }} />
            ) : (
              <circle key={d.id} className="dot" cx={sx(d.x)} cy={sy(d.y)} r={5} />
            ),
          )}

          {p.marks.map((m) => {
            const cx = sx(m.x)
            const cy = sy(m.y)
            return m.shape === 'square' ? (
              <g key={m.id}>
                <rect x={cx - 9} y={cy - 9} width={18} height={18} rx={4} fill="var(--card)" stroke={m.color} strokeWidth={2} />
                <rect x={cx - 5} y={cy - 5} width={10} height={10} rx={2} fill={m.hollow ? 'var(--card)' : m.color} stroke={m.color} strokeWidth={2} />
              </g>
            ) : m.hollow ? (
              <circle key={m.id} cx={cx} cy={cy} r={7} fill="var(--card)" stroke={m.color} strokeWidth={3} />
            ) : (
              <g key={m.id}>
                <circle cx={cx} cy={cy} r={9.5} fill="var(--card)" stroke={m.color} strokeWidth={2} />
                <circle cx={cx} cy={cy} r={6} fill={m.color} />
              </g>
            )
          })}

          {labels.map((l) => (
            <g key={`l${l.mark.id}`} className="mark-label">
              <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={4} fill={l.mark.color} />
              <text x={l.x + l.w / 2} y={l.y + l.h / 2 + 4} textAnchor="middle">{l.mark.label}</text>
            </g>
          ))}

          {hover && <circle className="hover-ring" cx={hover.px} cy={hover.py} r={9} />}
        </svg>
        {hover && hovered && (
          <div
            className="tooltip"
            style={{
              left: Math.min(Math.max(hover.px, 90), width - 90),
              top: hover.py,
              transform: hover.py < 90 ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 14px))',
            }}
          >
            <strong>{hovered.name}</strong>
            <span>{stripArrow(p.xAxis)} <b>{p.formatX(hovered.x)}</b></span>
            <span>{stripArrow(p.yAxis)} <b>{p.formatY(hovered.y)}</b></span>
          </div>
        )}
      </div>
      <div className="axis-title axis-x">{p.xAxis}</div>
    </figure>
  )
}

const stripArrow = (s: string) => s.replace(/[↑→]/g, '').replace(/,.*$/, '').trim()

function clampBox(b: Box, plot: { x0: number; x1: number; y0: number; y1: number }): Box {
  return {
    ...b,
    x: Math.min(Math.max(b.x, plot.x0 + 2), plot.x1 - b.w - 2),
    y: Math.min(Math.max(b.y, plot.y0 + 2), plot.y1 - b.h - 2),
  }
}
