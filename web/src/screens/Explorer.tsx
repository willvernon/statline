import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ACCENT, ChartCard, chartData } from '../components/ChartCard.tsx'
import { Icon } from '../components/Icon.tsx'
import { PlayerSearch } from '../components/PlayerSearch.tsx'
import { Segmented } from '../components/Segmented.tsx'
import { PositionTabs, Shell } from '../components/Shell.tsx'
import { DESKTOP, useMedia } from '../components/useMedia.ts'
import { CHARTS, quadrantOf } from '../data/charts.ts'
import type { Position } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import { logoFor, METRICS, POSITION_NAMES } from '../data/derive.ts'
import { playerPath } from '../paths.ts'
import { NotFound } from './NotFound.tsx'

const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE']

export function Explorer() {
  const { pos = 'wr' } = useParams()
  const position = pos.toUpperCase() as Position
  if (!POSITIONS.includes(position)) return <NotFound />
  return <ExplorerFor key={position} position={position} />
}

function ExplorerFor({ position }: { position: Position }) {
  const { model, pool } = useData()
  const navigate = useNavigate()
  const desktop = useMedia(DESKTOP)
  const charts = CHARTS[position]
  const [chartId, setChartId] = useState(charts[charts.length - 1]!.id)
  const chart = charts.find((c) => c.id === chartId) ?? charts[0]!
  const p = pool(position, 'season')
  const q = model.data.meta.qualifiers[position]

  // Leaderboard: the selected player's quadrant, best first on the axis the
  // quadrant is named for. Default selection is the spotlight quadrant's leader.
  const data = useMemo(() => chartData(chart, p, model, []), [chart, p, model])
  const board = (quad: string) => {
    if (data.avgX == null || data.avgY == null) return []
    const sortKey = quad.endsWith('r') ? 'x' : 'y'
    return data.points
      .filter((d) => quadrantOf(d.x, d.y, data.avgX!, data.avgY!) === quad)
      .sort((a, b) => b[sortKey] - a[sortKey])
  }
  const spotlightLeader = board(chart.spotlight)[0]?.id
  const [picked, setPicked] = useState<string | null>(null)
  const selectedId = picked && p.byId.get(picked)?.qualified ? picked : spotlightLeader
  const selected = selectedId ? p.byId.get(selectedId) : undefined
  const sel = selectedId ? data.points.find((d) => d.id === selectedId) : undefined
  const quad = sel && data.avgX != null && data.avgY != null ? quadrantOf(sel.x, sel.y, data.avgX, data.avgY) : chart.spotlight
  const rows = board(quad).slice(0, 8)
  const mx = METRICS[chart.x]
  const my = METRICS[chart.y]
  const leadFirst = quad.endsWith('r') ? [mx, my] : [my, mx]

  return (
    <Shell position={position} example={selected}>
      <div className="explorer-head">
        <h1 className="display page-title">{POSITION_NAMES[position]}</h1>
        <p className="mono muted-2">{p.qualified.length} {position}s · {q.per_team_game}+ {q.stat} per team game</p>
      </div>
      {!desktop && <PositionTabs className="tabs-block" />}
      {!desktop && (
        <>
          <div className="eyebrow mono find-label">Find a player</div>
          <PlayerSearch position={position} />
        </>
      )}

      <div className="explorer-grid">
        <section className="card chart-card">
          <div className="explorer-chart-head">
            <Segmented value={chart.id} onChange={(v) => { setChartId(v); setPicked(null) }} options={charts.map((c) => [c.id, c.title])} label="Chart" variant="chip" />
          </div>
          <ChartCard chart={chart} pool={p} highlights={selected ? [{ agg: selected, color: ACCENT }] : []} onPick={setPicked} bare />
          {selected && (
            <Link className="selected-bar" to={playerPath(selected.player)}>
              <span className="sel-dot" />
              <span className="sel-name">{selected.player.name}</span>
              <span className="mono sel-go">Player page <Icon name="arrow" size={16} /></span>
            </Link>
          )}
        </section>

        <section className="card board">
          <h2 className="display">{chart.quadrants[quad]}</h2>
          <p className="mono small muted-2">{quad === chart.spotlight ? chart.spotlightBlurb : boardBlurb(quad, mx.phrase, my.phrase)}</p>
          <table>
            <thead>
              <tr className="mono">
                <th className="l" colSpan={2}>Player</th>
                <th>{shortLabel(leadFirst[0]!.key)}</th>
                <th>{shortLabel(leadFirst[1]!.key)}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const a = p.byId.get(d.id)!
                const on = d.id === selectedId
                const vals = quad.endsWith('r') ? [d.x, d.y] : [d.y, d.x]
                return (
                  <tr key={d.id} className={on ? 'on' : ''} onClick={() => (on ? navigate(playerPath(a.player)) : setPicked(d.id))}>
                    <td className="radio"><span className={on ? 'radio-on' : 'radio-off'} /></td>
                    <td className="l">
                      <div className="board-name">{a.player.name}</div>
                      <div className="mono small muted-2 team-inline"><img src={logoFor(model, a.player.team)} alt="" />{a.player.team}</div>
                    </td>
                    <td className="mono">{leadFirst[0]!.format(vals[0]!)}</td>
                    <td className="mono">{leadFirst[1]!.format(vals[1]!)}</td>
                  </tr>
                )
              })}
              {!rows.length && (
                <tr><td colSpan={4} className="muted-2">Nothing to rank until this chart has data.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </Shell>
  )
}

const SHORT: Partial<Record<keyof typeof METRICS, string>> = {
  sep_oe: 'Sep OE', target_share: 'Tgt %', epa_per_target: 'EPA/T', opp_share: 'Opp %', epa_per_touch: 'EPA/Tch',
  carry_share: 'Car %', dropbacks_pg: 'DB/G', epa_per_dropback: 'EPA/DB', comp_pct: 'Cmp %', pass_adot: 'aDOT',
}
const shortLabel = (k: keyof typeof METRICS) => SHORT[k] ?? METRICS[k].label

function boardBlurb(quad: string, xPhrase: string, yPhrase: string) {
  const x = quad.endsWith('r') ? 'above' : 'below'
  const y = quad.startsWith('t') ? 'above' : 'below'
  return `${cap(x)}-average ${xPhrase}, ${y}-average ${yPhrase}`
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
