import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { QuadrantScatter, type ScatterMark, type ScatterPoint } from '../charts/QuadrantScatter.tsx'
import { quadrantOf, type ChartDef } from '../data/charts.ts'
import { useData } from '../data/DataContext.tsx'
import { METRICS, mean, ordinal, rankOf, shortName, type Agg, type Model, type Pool } from '../data/derive.ts'
import { Icon } from './Icon.tsx'

export const ACCENT = '#C2410C'
export const BLUE = '#1D4ED8'

export interface Highlight {
  agg: Agg
  color: string
  shape?: 'circle' | 'square'
}

export interface ChartData {
  points: ScatterPoint[]
  marks: ScatterMark[]
  avgX: number | null
  avgY: number | null
  missing: 'pbp' | 'ngs' | null
}

export function chartData(chart: ChartDef, pool: Pool, model: Model, highlights: Highlight[]): ChartData {
  const mx = METRICS[chart.x]
  const my = METRICS[chart.y]
  const points: ScatterPoint[] = []
  for (const a of pool.qualified) {
    const x = mx.get(a, model)
    const y = my.get(a, model)
    if (x != null && y != null) points.push({ id: a.player.player_id, x, y, name: a.player.name })
  }
  const marks: ScatterMark[] = []
  for (const h of highlights) {
    const x = mx.get(h.agg, model)
    const y = my.get(h.agg, model)
    if (x == null || y == null) continue
    const hollow = !h.agg.qualified
    marks.push({
      id: h.agg.player.player_id, x, y, color: h.color, shape: h.shape, hollow,
      label: `${shortName(h.agg.player.name)}${hollow ? ' · small sample' : ''}`,
    })
  }
  const loaded = model.data.meta.sources
  const missing = [mx.needs, my.needs].find((n) => n && !loaded[n]) ?? null
  return { points, marks, avgX: mean(pool, model, chart.x), avgY: mean(pool, model, chart.y), missing }
}

export function verdict(chart: ChartDef, pool: Pool, model: Model, agg: Agg, data: ChartData): { head: string; body: string } | null {
  const mark = data.marks.find((m) => m.id === agg.player.player_id)
  if (!mark || data.avgX == null || data.avgY == null) return null
  const head = chart.quadrants[quadrantOf(mark.x, mark.y, data.avgX, data.avgY)]
  const mx = METRICS[chart.x]
  const my = METRICS[chart.y]
  if (!agg.qualified) {
    const [a, b] = chart.lead === 'x' ? [[mx, mark.x], [my, mark.y]] as const : [[my, mark.y], [mx, mark.x]] as const
    return { head, body: `${a[0].format(a[1])} ${a[0].phrase} on ${b[0].format(b[1])} ${b[0].phrase}.` }
  }
  const phrase = (key: typeof chart.x) => {
    const r = rankOf(pool, model, key, agg.player.player_id)
    if (!r) return null
    const of = r.of === data.points.length ? '' : ` of ${r.of}`
    return `${ordinal(r.rank)}${of} in ${METRICS[key].phrase}`
  }
  const parts = (chart.lead === 'x' ? [chart.x, chart.y] : [chart.y, chart.x]).map(phrase).filter(Boolean)
  return { head, body: `${parts.join(', ')}.` }
}

const MISSING: Record<'pbp' | 'ngs', string> = {
  pbp: 'Needs EPA from nflverse play-by-play, which the pipeline does not load yet.',
  ngs: 'Needs Next Gen Stats separation, which the pipeline does not load yet.',
}

interface Props {
  chart: ChartDef
  pool: Pool
  highlights: Highlight[]
  /** Subtitle override; defaults to the chart blurb. */
  sub?: ReactNode
  /** Verdict for this player, shown under the plot. */
  verdictFor?: Agg
  footer?: ReactNode
  onPick?: (id: string) => void
  bare?: boolean
}

export function ChartCard({ chart, pool, highlights, sub, verdictFor, footer, onPick, bare }: Props) {
  const { model } = useData()
  const [, setParams] = useSearchParams()
  const data = chartData(chart, pool, model, highlights)
  const v = verdictFor ? verdict(chart, pool, model, verdictFor, data) : null
  const mx = METRICS[chart.x]
  const my = METRICS[chart.y]
  const verdictColor = highlights.find((h) => h.agg === verdictFor)?.color ?? ACCENT
  const hollow = verdictFor && !verdictFor.qualified

  const body = data.missing ? (
    <div className="unavailable">
      <p className="mono">Not available yet</p>
      <p>{MISSING[data.missing]}</p>
    </div>
  ) : (
    <QuadrantScatter
      points={data.points}
      marks={data.marks}
      avgX={data.avgX}
      avgY={data.avgY}
      quadrants={chart.quadrants}
      xAxis={chart.xAxis}
      yAxis={chart.yAxis}
      formatX={mx.format}
      formatY={my.format}
      xTick={tickFormat(chart.x)}
      yTick={tickFormat(chart.y)}
      onPick={onPick}
      ariaLabel={`${chart.title}: ${data.points.length} ${pool.position}s, ${mx.phrase} across, ${my.phrase} up.${v ? ` ${v.head}. ${v.body}` : ''}`}
    />
  )

  if (bare) return body

  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <h2 className="display">{chart.title}</h2>
          <p className="sub">{sub ?? chart.blurb}</p>
        </div>
        <button className="icon-btn" aria-label={`How ${chart.title} is built`} onClick={() => setParams((p) => (p.set('how', chart.id), p))}>
          <Icon name="info" />
        </button>
      </div>
      {body}
      {v && !data.missing && (
        <div className="verdict">
          <span className={`verdict-dot${hollow ? ' hollow' : ''}`} style={{ ['--c' as string]: verdictColor }} />
          <p><strong>{v.head}.</strong> {v.body}</p>
        </div>
      )}
      {footer}
    </section>
  )
}

/** Axis ticks: whole percents for shares, signed for EPA and separation. */
function tickFormat(key: keyof typeof METRICS): (v: number) => string {
  const f = METRICS[key].format
  if (f(0.5).endsWith('%')) return (v) => `${Math.round(v * 100)}%`
  if (f(0.5).startsWith('+')) return (v) => (v === 0 ? '0' : f(v).replace(/\.?0+$/, ''))
  return (v) => String(Number(v.toFixed(2)))
}
