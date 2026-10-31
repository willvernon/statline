import { QuadrantScatter, type ScatterMark, type ScatterPoint } from '../charts/QuadrantScatter.tsx'
import { WeekBars } from '../charts/WeekBars.tsx'
import { TILES } from '../data/charts.ts'
import type { PlayerGame, Position, Team } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import {
  aggregateTeam, defenseRanks, formatKickoff, METRICS, nextGame, ordinal, rankOf, spreadText, teamWeeks,
  type Agg, type Matchup, type Model, type Pool,
} from '../data/derive.ts'
import { ACCENT, BLUE } from './ChartCard.tsx'

// ---------- stat tiles ----------

export function StatTiles({ agg, pool }: { agg: Agg; pool: Pool }) {
  const { model } = useData()
  if (!agg.qualified) return <SmallSampleTiles agg={agg} />
  return (
    <div className="tiles">
      {TILES[agg.position].map((key) => {
        const metric = METRICS[key]
        const v = metric.get(agg, model)
        const r = rankOf(pool, model, key, agg.player.player_id)
        return (
          <div className="tile" key={key}>
            <div className="tile-label mono">{metric.label}</div>
            <div className="tile-value display">{v == null ? '—' : metric.format(v)}</div>
            <div className="tile-rank mono">{r ? `${ordinal(r.rank)} of ${r.of} ${agg.position}` : v == null ? 'needs play-by-play' : ''}</div>
          </div>
        )
      })}
    </div>
  )
}

function SmallSampleTiles({ agg }: { agg: Agg }) {
  const { model } = useData()
  const last2 = agg.rows.filter((r) => r.offense_snaps > 0 || r.targets > 0).slice(-2)
  const last2Ppg = last2.length ? last2.reduce((a, r) => a + r.fantasy_pts_ppr, 0) / last2.length : null
  const epa = METRICS.epa_per_target.get(agg, model)
  return (
    <div className="tiles">
      <div className="tile">
        <div className="tile-label mono">PPR / game</div>
        <div className="tile-value display">{METRICS.ppr_pg.format(METRICS.ppr_pg.get(agg, model) ?? 0)}</div>
        <div className="tile-rank mono muted-2">{agg.games} games</div>
      </div>
      <div className="tile">
        <div className="tile-label mono">Last {last2.length} games</div>
        <div className="tile-value display">{last2Ppg == null ? '—' : last2Ppg.toFixed(1)}</div>
        <div className="tile-rank mono muted-2">PPR / game</div>
      </div>
      <div className="tile">
        <div className="tile-label mono">EPA / target</div>
        <div className="tile-value display">{epa == null ? '—' : METRICS.epa_per_target.format(epa)}</div>
        <div className="tile-rank mono muted-2">{agg.targets} targets</div>
      </div>
    </div>
  )
}

export function SmallSampleNote({ agg, model }: { agg: Agg; model: Model }) {
  const q = model.data.meta.qualifiers[agg.position]
  return (
    <div className="small-sample">
      <span className="ring" />
      <div>
        <strong>Small sample</strong>
        <p>
          {agg.volume} {q.stat} in {agg.games} {agg.games === 1 ? 'game' : 'games'}. The line is {q.per_team_game} per team game
          ({agg.line} so far). Plotted hollow and left out of the averages.
        </p>
      </div>
    </div>
  )
}

// ---------- matchup ----------

export function cityName(model: Model, team: string): string {
  const t = model.teamsByAbbr.get(team)
  if (!t) return team
  const city = t.name.split(' ').slice(0, -1).join(' ')
  const shared = model.data.teams.filter((x) => x.name.startsWith(city + ' ')).length > 1
  return shared ? t.name.split(' ').slice(-1)[0]! : city
}

const PPR_KEY: Record<Position, string> = { QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' }

export function MatchupCard({ agg, compact }: { agg: Agg; compact?: boolean }) {
  const { model } = useData()
  const team = agg.player.team
  const mu = nextGame(model, team)
  const week = model.data.meta.thru_week + 1
  if (!mu) {
    return (
      <section className="card matchup">
        <div className="eyebrow mono">Week {week} matchup</div>
        <h2 className="display matchup-title">Bye</h2>
        <p className="muted-2 mono">{team} is off in Week {week}.</p>
      </section>
    )
  }
  const d = defenseRanks(model, mu.opponent, agg.position)
  const spread = spreadText(team, mu.favoredBy)
  const title = `${mu.isHome ? 'vs' : '@'} ${cityName(model, mu.opponent)}`

  if (compact) {
    return (
      <section className="card matchup compact">
        <div className="eyebrow mono">Week {mu.week} matchup</div>
        <h2 className="display matchup-title">{title}</h2>
        <p className="mono small muted-2">
          {formatKickoff(mu.game.kickoff)}{spread ? ` · ${spread}` : ''}{mu.total != null ? ` · O/U ${mu.total}` : ''}
        </p>
        <div className="matchup-mini">
          {d.passD && (
            <div>
              <div className="eyebrow mono">Pass D</div>
              <div className="display">{ordinal(d.passD.rank)}</div>
            </div>
          )}
          <div>
            <div className="eyebrow mono">{agg.position} PPR allowed</div>
            <div className="display">{d.pprAllowedPerGame.toFixed(1)}/g</div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="card matchup">
      <div className="matchup-top">
        <div>
          <div className="eyebrow mono">Week {mu.week} matchup</div>
          <h2 className="display matchup-title">{title}</h2>
          <p className="mono small muted-2">{formatKickoff(mu.game.kickoff)}</p>
        </div>
        <div className="badges">
          {spread && <span className="badge mono">{spread}</span>}
          {mu.total != null && <span className="badge mono">O/U {mu.total}</span>}
        </div>
      </div>
      {d.passD && agg.position !== 'RB' && (
        <Slider
          label={`${mu.opponent} pass defense`}
          value={`${ordinal(d.passD.rank)} of ${d.passD.of}`}
          at={(d.passD.rank - 1) / Math.max(1, d.passD.of - 1)}
          note={`${METRICS.epa_per_target.format(d.passEpaPerDropback ?? 0)} EPA per dropback allowed`}
        />
      )}
      <Slider
        label={`PPR allowed to ${PPR_KEY[agg.position]}`}
        value={`${ordinal(d.pprAllowed.rank)} fewest`}
        at={(d.pprAllowed.rank - 1) / Math.max(1, d.pprAllowed.of - 1)}
        note={`${d.pprAllowedPerGame.toFixed(1)} per game`}
      />
      <div className="slider-scale mono"><span>Tougher</span><span>Softer</span></div>
    </section>
  )
}

function Slider({ label, value, at, note }: { label: string; value: string; at: number; note: string }) {
  return (
    <div className="slider">
      <div className="slider-row">
        <span className="slider-label">{label}</span>
        <span className="mono slider-value">{value}</span>
      </div>
      <div className="slider-track" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(at * 100)} aria-label={`${label}: ${value}`}>
        <span className="slider-knob" style={{ left: `${at * 100}%` }} />
      </div>
      <p className="mono small muted-2">{note}</p>
    </div>
  )
}

// ---------- teams chart (week matchup) ----------

const TEAM_QUADS = { tl: 'Defense-led', tr: 'Good O, good D', bl: 'Struggling', br: 'Offense-led' }

export function teamEpa(model: Model) {
  return model.data.teams.map((t) => {
    const a = aggregateTeam(model, t, 'season')
    const off = a.off_epa != null && a.off_plays ? a.off_epa / a.off_plays : null
    const def = a.def_epa_allowed != null && a.def_plays ? a.def_epa_allowed / a.def_plays : null
    return { team: t, off, def, agg: a }
  })
}

export function TeamScatter({ highlight, ariaLabel }: { highlight: { team: Team; color: string; shape: 'circle' | 'square' }[]; ariaLabel: string }) {
  const { model } = useData()
  const rows = teamEpa(model).filter((r) => r.off != null && r.def != null)
  const ids = new Set(highlight.map((h) => h.team.team))
  const points: ScatterPoint[] = rows
    .filter((r) => !ids.has(r.team.team))
    .map((r) => ({ id: r.team.team, x: r.off!, y: r.def!, name: r.team.name, fill: r.team.color }))
  const marks: ScatterMark[] = highlight.flatMap((h) => {
    const r = rows.find((x) => x.team.team === h.team.team)
    return r ? [{ id: h.team.team, x: r.off!, y: r.def!, label: h.team.team, color: h.color, shape: h.shape }] : []
  })
  if (!model.data.meta.sources.pbp) {
    return (
      <div className="unavailable">
        <p className="mono">Not available yet</p>
        <p>Needs team EPA from nflverse play-by-play, which the pipeline does not load yet.</p>
      </div>
    )
  }
  const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length
  const signed = METRICS.epa_per_target.format
  return (
    <QuadrantScatter
      points={points}
      marks={marks}
      avgX={avg((r) => r.off!)}
      avgY={avg((r) => r.def!)}
      quadrants={TEAM_QUADS}
      xAxis="Offense EPA per play →"
      yAxis="↑ Better defense (EPA allowed)"
      formatX={signed}
      formatY={signed}
      xTick={(v) => (v === 0 ? '0.0' : signed(v).replace(/0$/, ''))}
      yTick={(v) => (v === 0 ? '0.0' : signed(v).replace(/0$/, ''))}
      invertY
      ariaLabel={ariaLabel}
    />
  )
}

export function MatchupChartCard({ agg }: { agg: Agg }) {
  const { model } = useData()
  const mu: Matchup | null = nextGame(model, agg.player.team)
  if (!mu) return null
  const own = model.teamsByAbbr.get(agg.player.team)!
  const opp = model.teamsByAbbr.get(mu.opponent)!
  const oppD = defenseRanks(model, opp.team, agg.position)
  const ownD = defenseRanks(model, own.team, agg.position)
  return (
    <section className="card chart-card">
      <div className="card-head">
        <div>
          <h2 className="display">Week {mu.week} matchup</h2>
          <p className="sub">Team EPA per play, offense against defense. Not schedule-adjusted.</p>
        </div>
      </div>
      <div className="legend mono">
        <span><i className="key circle" style={{ background: ACCENT }} /> {own.team} (player's team)</span>
        <span><i className="key square" style={{ background: BLUE }} /> {opp.team} (opponent)</span>
      </div>
      <TeamScatter
        highlight={[
          { team: own, color: ACCENT, shape: 'circle' },
          { team: opp, color: BLUE, shape: 'square' },
        ]}
        ariaLabel={`Team EPA per play. ${own.team} and ${opp.team} highlighted.`}
      />
      {oppD.defEpa && ownD.defEpa && (
        <div className="verdict">
          <span className="verdict-dot square" style={{ ['--c' as string]: BLUE }} />
          <p>
            <strong>{opp.team} defense:</strong> {ordinal(oppD.defEpa.rank)} in EPA per play allowed. {own.team} allows the{' '}
            {ownD.defEpa.rank === 1 ? 'fewest' : `${ordinal(ownD.defEpa.rank)} fewest`}.
          </p>
        </div>
      )}
    </section>
  )
}

// ---------- game log ----------

interface Col {
  head: string
  get: (r: PlayerGame) => number
  total?: (rows: PlayerGame[]) => string
}

const pctSnap = (rows: PlayerGame[]) => {
  const s = rows.reduce((a, r) => a + r.offense_snaps, 0)
  const t = rows.reduce((a, r) => a + r.team_offense_snaps, 0)
  return t ? `${Math.round((s / t) * 100)}%` : '—'
}
const SNAP: Col = { head: 'Snap', get: (r) => r.offense_snaps / Math.max(1, r.team_offense_snaps), total: pctSnap }

const LOG_COLS: Record<Position, Col[]> = {
  WR: [{ head: 'Tgt', get: (r) => r.targets }, { head: 'Rec', get: (r) => r.receptions }, { head: 'Yds', get: (r) => r.rec_yds }, { head: 'TD', get: (r) => r.rec_td }, SNAP],
  TE: [{ head: 'Tgt', get: (r) => r.targets }, { head: 'Rec', get: (r) => r.receptions }, { head: 'Yds', get: (r) => r.rec_yds }, { head: 'TD', get: (r) => r.rec_td }, SNAP],
  RB: [{ head: 'Car', get: (r) => r.carries }, { head: 'Yds', get: (r) => r.rush_yds }, { head: 'Tgt', get: (r) => r.targets }, { head: 'TD', get: (r) => r.rush_td + r.rec_td }, SNAP],
  QB: [{ head: 'Cmp', get: (r) => r.completions }, { head: 'Att', get: (r) => r.attempts }, { head: 'Yds', get: (r) => r.pass_yds }, { head: 'TD', get: (r) => r.pass_td }, { head: 'Int', get: (r) => r.pass_int }],
}

export function GameLog({ agg }: { agg: Agg }) {
  const { model } = useData()
  const cols = LOG_COLS[agg.position]
  const rows = (model.rowsByPlayer.get(agg.player.player_id) ?? []).filter((r) => r.offense_snaps > 0 || r.targets > 0 || r.carries > 0 || r.attempts > 0)
  const max = Math.max(1, ...rows.map((r) => r.fantasy_pts_ppr))
  const total = rows.reduce((a, r) => a + r.fantasy_pts_ppr, 0)
  return (
    <section className="card gamelog">
      <div className="card-head">
        <h2 className="display">Game log</h2>
        <span className="mono muted-2 small">{model.data.meta.season} · PPR</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr className="mono">
              <th className="l">Wk</th>
              <th className="l">Opp</th>
              {cols.map((c) => <th key={c.head}>{c.head}</th>)}
              <th>PPR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.game_id}>
                <td className="l mono muted-2">{r.week}</td>
                <td className="l mono strong">{r.is_home ? '' : '@'}{r.opponent}</td>
                {cols.map((c) => (
                  <td key={c.head} className="mono">{c === SNAP ? `${Math.round(c.get(r) * 100)}%` : c.get(r)}</td>
                ))}
                <td className="mono ppr">
                  <span>{r.fantasy_pts_ppr.toFixed(1)}</span>
                  <i style={{ width: `${(r.fantasy_pts_ppr / max) * 100}%` }} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="l" colSpan={2}>Season</td>
              {cols.map((c) => (
                <td key={c.head} className="mono">{c.total ? c.total(rows) : rows.reduce((a, r) => a + c.get(r), 0)}</td>
              ))}
              <td className="mono">{rows.length ? (total / rows.length).toFixed(1) : '0.0'}/g</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

// ---------- weekly bars ----------

/** One bar per week through thru_week. Bye weeks are null, missed games zero. */
export function weeklyBars(model: Model, agg: Agg, f: (r: PlayerGame) => number, sub?: (r: PlayerGame) => string) {
  const played = new Set(teamWeeks(model, agg.player.team))
  const rows = new Map((model.rowsByPlayer.get(agg.player.player_id) ?? []).map((r) => [r.week, r]))
  return Array.from({ length: model.data.meta.thru_week }, (_, i) => {
    const week = i + 1
    const r = rows.get(week)
    return { week, value: played.has(week) ? (r ? f(r) : 0) : null, sub: r && sub ? sub(r) : undefined }
  })
}

export function WeeklyPprCard({ agg }: { agg: Agg }) {
  const { model } = useData()
  const vol = agg.position === 'QB' ? (r: PlayerGame) => String(r.attempts) : agg.position === 'RB' ? (r: PlayerGame) => String(r.carries + r.targets) : (r: PlayerGame) => String(r.targets)
  const what = agg.position === 'QB' ? 'Attempts' : agg.position === 'RB' ? 'Touches' : 'Targets'
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="display">Weekly PPR</h2>
          <p className="sub">{what} under each bar</p>
        </div>
      </div>
      <WeekBars
        bars={weeklyBars(model, agg, (r) => r.fantasy_pts_ppr, vol)}
        color={ACCENT}
        format={(v) => v.toFixed(1)}
        height={190}
        ariaLabel={`Weekly PPR for ${agg.player.name}`}
      />
    </section>
  )
}

export function RoleTrendCard({ agg }: { agg: Agg }) {
  const { model } = useData()
  const bars = weeklyBars(model, agg, (r) => r.offense_snaps / Math.max(1, r.team_offense_snaps))
  const rows = (model.rowsByPlayer.get(agg.player.player_id) ?? []).filter((r) => r.targets > 0)
  const zeros = bars.filter((b) => b.value === 0).map((b) => b.week)
  return (
    <section className="card">
      <div className="card-head">
        <h2 className="display">Role trend</h2>
        <span className="mono muted-2 small">Offensive snap share</span>
      </div>
      <WeekBars bars={bars} color={ACCENT} format={(v) => `${Math.round(v * 100)}%`} height={150} ariaLabel={`Snap share by week for ${agg.player.name}`} />
      <p className="role-notes mono small">
        {rows.map((r) => (
          <span key={r.week}><b>W{r.week}</b> {r.targets} tgt · {r.fantasy_pts_ppr.toFixed(1)}</span>
        ))}
      </p>
      {zeros.length > 0 && <p className="mono small muted-2">No offensive snaps recorded in {weekRange(zeros)}.</p>}
    </section>
  )
}

function weekRange(weeks: number[]): string {
  const contiguous = weeks.every((w, i) => i === 0 || w === weeks[i - 1]! + 1)
  if (weeks.length === 1) return `Week ${weeks[0]}`
  if (contiguous) return `Weeks ${weeks[0]} to ${weeks[weeks.length - 1]}`
  return `Weeks ${weeks.slice(0, -1).join(', ')} and ${weeks[weeks.length - 1]}`
}
