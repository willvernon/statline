import { useNavigate, useParams } from 'react-router'
import { WeekBars } from '../charts/WeekBars.tsx'
import { ACCENT, BLUE, ChartCard, chartData } from '../components/ChartCard.tsx'
import { Icon } from '../components/Icon.tsx'
import { weeklyBars } from '../components/PlayerParts.tsx'
import { PlayerSearch } from '../components/PlayerSearch.tsx'
import { Shell, ThroughWeek, useShare } from '../components/Shell.tsx'
import { DESKTOP, useMedia } from '../components/useMedia.ts'
import { CHARTS, COMPARE_ROWS } from '../data/charts.ts'
import type { Player } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import {
  aggregate, defenseRanks, formatKickoffShort, lastName, METRICS, nextGame, type Agg, type Model,
} from '../data/derive.ts'
import { comparePath } from '../paths.ts'
import { NotFound } from './NotFound.tsx'

type Side = 'a' | 'b' | null

interface Row {
  label: string
  a: string
  b: string
  edge: Side
  style?: boolean
}

function edgeOf(va: number | null, vb: number | null, better: 'high' | 'low' | null): Side {
  if (better == null || va == null || vb == null || va === vb) return null
  return (better === 'high' ? va > vb : va < vb) ? 'a' : 'b'
}

function buildRows(model: Model, a: Player, b: Player): Row[] {
  const rows: Row[] = []
  const aggs = { season: [aggregate(model, a, 'season'), aggregate(model, b, 'season')], last4: [aggregate(model, a, 'last4'), aggregate(model, b, 'last4')] }
  for (const r of COMPARE_ROWS[a.position]) {
    const m = METRICS[r.key]
    const [x, y] = aggs[r.window ?? 'season'] as [Agg, Agg]
    const va = m.get(x, model)
    const vb = m.get(y, model)
    rows.push({
      label: `${m.label}${r.window === 'last4' ? ', last 4' : ''}`,
      a: va == null ? '—' : m.format(va),
      b: vb == null ? '—' : m.format(vb),
      edge: edgeOf(va, vb, m.better),
      style: m.better == null,
    })
  }
  // Matchup rows: opponent defense rank (32 = softest) and implied team total.
  const ga = nextGame(model, a.team)
  const gb = nextGame(model, b.team)
  const da = ga ? defenseRanks(model, ga.opponent, a.position) : null
  const db = gb ? defenseRanks(model, gb.opponent, b.position) : null
  const ra = da?.passD?.rank ?? null
  const rb = db?.passD?.rank ?? null
  if (a.position !== 'RB' && (ra != null || rb != null)) {
    rows.push({
      label: 'Opp pass D rank (32 = softest)',
      a: ga && ra != null ? `${ga.opponent} ${ra}` : '—',
      b: gb && rb != null ? `${gb.opponent} ${rb}` : '—',
      edge: edgeOf(ra, rb, 'high'),
    })
  }
  rows.push({
    label: 'Implied team total',
    a: ga?.impliedTotal != null ? ga.impliedTotal.toFixed(1) : '—',
    b: gb?.impliedTotal != null ? gb.impliedTotal.toFixed(1) : '—',
    edge: edgeOf(ga?.impliedTotal ?? null, gb?.impliedTotal ?? null, 'high'),
  })
  return rows
}

export function Compare() {
  const { a: aId = '', b: bId } = useParams()
  const { model } = useData()
  const navigate = useNavigate()
  const a = model.playersById.get(aId)
  const b = bId ? model.playersById.get(bId) : undefined
  if (!a) return <NotFound what="player" />
  if (bId && !b) return <NotFound what="player" />

  if (!b) {
    return (
      <Shell variant="detail" position={a.position}>
        <div className="title-row">
          <h1 className="display page-title">Start or sit</h1>
          <ThroughWeek />
        </div>
        <div className="compare-cards">
          <PlayerCard player={a} color={ACCENT} />
          <span className="swap"><Icon name="swap" /></span>
          <div className="pcard pick">
            <div className="eyebrow mono">Compare with</div>
            <PlayerSearch position={a.position} exclude={a.player_id} placeholder={`Another ${a.position}`} autoFocus onPick={(p) => navigate(comparePath(a, p), { replace: true })} />
          </div>
        </div>
      </Shell>
    )
  }
  return <CompareBoth a={a} b={b} />
}

function CompareBoth({ a, b }: { a: Player; b: Player }) {
  const { model, pool } = useData()
  const desktop = useMedia(DESKTOP)
  const navigate = useNavigate()
  const { share, toast } = useShare()
  const rows = buildRows(model, a, b)
  const aWins = rows.filter((r) => r.edge === 'a').length
  const bWins = rows.filter((r) => r.edge === 'b').length
  const style = rows.filter((r) => r.style).length
  const p = pool(a.position, 'season')
  const aggA = p.byId.get(a.player_id) ?? aggregate(model, a, 'season')
  const aggB = p.byId.get(b.player_id) ?? aggregate(model, b, 'season')
  const charts = CHARTS[a.position]
  const barsA = weeklyBars(model, aggA, (r) => r.fantasy_pts_ppr)
  const barsB = weeklyBars(model, aggB, (r) => r.fantasy_pts_ppr)
  const max = Math.max(1, ...barsA.map((x) => x.value ?? 0), ...barsB.map((x) => x.value ?? 0))
  const thru = model.data.meta.thru_week
  const highlights = [{ agg: aggA, color: ACCENT }, { agg: aggB, color: BLUE, shape: 'square' as const }]

  return (
    <Shell variant="detail" onShare={() => share(`${a.name} vs ${b.name} · Statline`)} position={a.position}>
      <div className="title-row">
        <h1 className="display page-title">Start or sit</h1>
        <ThroughWeek />
      </div>
      <div className="compare-cards">
        <PlayerCard player={a} color={ACCENT} />
        <button className="swap" aria-label="Swap sides" onClick={() => navigate(comparePath(b, a), { replace: true })}>
          <Icon name="swap" />
        </button>
        <PlayerCard player={b} color={BLUE} square onClear={() => navigate(comparePath(a), { replace: true })} />
      </div>

      <div className="edges">
        <div className="edge a"><div className="eyebrow mono">{lastName(a.name)} edges</div><div className="display">{aWins}</div></div>
        <div className="edge b"><div className="eyebrow mono">{lastName(b.name)} edges</div><div className="display">{bWins}</div></div>
        <div className="edge s"><div className="eyebrow mono">Style only</div><div className="display">{style}</div></div>
      </div>

      <div className={desktop ? 'compare-grid' : ''}>
        <section className="card compare-table">
          {rows.map((r) => (
            <div className="crow" key={r.label}>
              <span className={`cval l${r.edge === 'a' ? ' win' : ''}`}>{r.edge === 'a' && <i className="dot a" />}{r.a}</span>
              <span className="clabel mono">{r.label}</span>
              <span className={`cval r${r.edge === 'b' ? ' win' : ''}`}>{r.b}{r.edge === 'b' && <i className="dot b" />}</span>
            </div>
          ))}
        </section>

        <div className="stack">
          {charts.map((c) => (
            <ChartCard key={c.id} chart={c} pool={p} highlights={highlights} sub={compareBlurb(model, c, p, aggA, aggB) ?? c.blurb} />
          ))}
          <section className="card">
            <div className="card-head">
              <h2 className="display">Weekly PPR</h2>
              <span className="mono muted-2 small">Weeks 1 to {thru}</span>
            </div>
            <div className="legend mono"><span><i className="key circle" style={{ background: ACCENT }} /> {a.name}</span></div>
            <WeekBars bars={barsA} color={ACCENT} max={max} format={(v) => v.toFixed(1)} height={110} showWeek={false} ariaLabel={`Weekly PPR for ${a.name}`} />
            <div className="legend mono"><span><i className="key square" style={{ background: BLUE }} /> {b.name}</span></div>
            <WeekBars bars={barsB} color={BLUE} max={max} format={(v) => v.toFixed(1)} height={110} ariaLabel={`Weekly PPR for ${b.name}`} />
            <p className="mono small muted-2 fineprint">
              Implied team total = (game total ± spread) / 2 from the betting line in nflverse schedules. Edges count only;
              Statline does not make the call.
            </p>
          </section>
        </div>
      </div>
      {toast}
    </Shell>
  )
}

/** One line on how the two compare on a chart, from the plotted values. */
function compareBlurb(model: Model, chart: (typeof CHARTS)['WR'][number], p: ReturnType<ReturnType<typeof useData>['pool']>, a: Agg, b: Agg): string | null {
  const d = chartData(chart, p, model, [{ agg: a, color: '' }, { agg: b, color: '' }])
  const [ma, mb] = d.marks
  if (!ma || !mb || d.avgX == null || d.avgY == null) return null
  const spanX = Math.max(...d.points.map((x) => x.x)) - Math.min(...d.points.map((x) => x.x))
  const spanY = Math.max(...d.points.map((x) => x.y)) - Math.min(...d.points.map((x) => x.y))
  const closeX = Math.abs(ma.x - mb.x) < spanX * 0.08
  const closeY = Math.abs(ma.y - mb.y) < spanY * 0.08
  const mx = METRICS[chart.x]
  const my = METRICS[chart.y]
  const ahead = (k: 'x' | 'y') => lastName((ma[k] > mb[k] ? a : b).player.name)
  if (closeX && closeY) return `Nearly the same spot on both axes.`
  if (closeX) return `Near-identical ${mx.phrase}. ${ahead('y')} is ahead on ${my.phrase}.`
  if (closeY) return `Near-identical ${my.phrase}. ${ahead('x')} is ahead on ${mx.phrase}.`
  return `${ahead('x')} leads on ${mx.phrase}, ${ahead('y')} on ${my.phrase}.`
}

function PlayerCard({ player, color, square, onClear }: { player: Player; color: string; square?: boolean; onClear?: () => void }) {
  const { model } = useData()
  const mu = nextGame(model, player.team)
  const parts = player.name.split(' ')
  return (
    <div className="pcard">
      <div className="pcard-top mono">
        <span><i className={`key ${square ? 'square' : 'circle'}`} style={{ background: color }} /> {player.position} · {player.team}</span>
      </div>
      <div className="display pcard-name">
        <span>{parts[0]}</span>
        <span>{parts.slice(1).join(' ')}</span>
      </div>
      <p className="mono small muted-2">
        {mu ? (
          <>Wk {mu.week} {mu.isHome ? 'vs' : '@'} {mu.opponent}<br />{formatKickoffShort(mu.game.kickoff)}</>
        ) : (
          <>Bye in Week {model.data.meta.thru_week + 1}</>
        )}
      </p>
      {onClear && <button className="link-btn mono" onClick={onClear}>Change player</button>}
    </div>
  )
}
