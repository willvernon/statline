// Turns mart rows into what the screens show. Every rate is a ratio of sums over
// the window. Nothing here reaches back into the pipeline; it only reads Dataset.

import type { Dataset, Game, Player, PlayerGame, Position, Team, TeamGame } from './contract.ts'

export type Window = 'season' | 'last4'

export interface Agg {
  player: Player
  position: Position
  /** Games with a snap or a touch. */
  games: number
  /** Team games in the window, the qualifier denominator. */
  teamGames: number
  rows: PlayerGame[]

  attempts: number
  completions: number
  pass_yds: number
  pass_td: number
  pass_int: number
  carries: number
  rush_yds: number
  rush_td: number
  targets: number
  receptions: number
  rec_yds: number
  rec_td: number
  air_yards: number
  team_targets: number
  team_carries: number
  offense_snaps: number
  team_offense_snaps: number
  ppr: number

  epa_targets: number | null
  epa_rush: number | null
  dropbacks: number | null
  epa_dropbacks: number | null
  ngs_sep: number | null
  ngs_targets: number | null

  qualified: boolean
  /** Volume stat used by the qualifier, and the line it has to clear. */
  volume: number
  line: number
}

export interface TeamAgg {
  team: Team
  games: number
  off_plays: number | null
  off_epa: number | null
  def_plays: number | null
  def_epa_allowed: number | null
  def_dropbacks: number | null
  def_pass_epa_allowed: number | null
  ppr_allowed: Record<Position, number>
  points_against: number
}

export interface Model {
  data: Dataset
  playersById: Map<string, Player>
  teamsByAbbr: Map<string, Team>
  rowsByPlayer: Map<string, PlayerGame[]>
  teamGamesByTeam: Map<string, TeamGame[]>
  gamesById: Map<string, Game>
}

export function buildModel(data: Dataset): Model {
  const group = <T, K>(xs: T[], key: (x: T) => K) => {
    const m = new Map<K, T[]>()
    for (const x of xs) {
      const k = key(x)
      const arr = m.get(k)
      if (arr) arr.push(x)
      else m.set(k, [x])
    }
    return m
  }
  const rowsByPlayer = group(data.playerGames, (r) => r.player_id)
  for (const rows of rowsByPlayer.values()) rows.sort((a, b) => a.week - b.week)
  const teamGamesByTeam = group(data.teamGames, (r) => r.team)
  for (const rows of teamGamesByTeam.values()) rows.sort((a, b) => a.week - b.week)
  return {
    data,
    playersById: new Map(data.players.map((p) => [p.player_id, p])),
    teamsByAbbr: new Map(data.teams.map((t) => [t.team, t])),
    rowsByPlayer,
    teamGamesByTeam,
    gamesById: new Map(data.schedule.map((g) => [g.game_id, g])),
  }
}

/** Weeks the team played, through thru_week, newest last. */
export function teamWeeks(m: Model, team: string): number[] {
  return (m.teamGamesByTeam.get(team) ?? []).map((t) => t.week)
}

function windowWeeks(m: Model, team: string, w: Window): Set<number> {
  const weeks = teamWeeks(m, team)
  return new Set(w === 'last4' ? weeks.slice(-4) : weeks)
}

const played = (r: PlayerGame) => r.offense_snaps > 0 || r.targets > 0 || r.carries > 0 || r.attempts > 0

/** Sum of a source-gated field: null when the source isn't loaded, nulls count as 0. */
function sumOpt(loaded: boolean, rows: PlayerGame[], f: (r: PlayerGame) => number | null | undefined): number | null {
  return loaded ? rows.reduce((a, r) => a + (f(r) ?? 0), 0) : null
}

export function aggregate(m: Model, player: Player, w: Window): Agg {
  const all = m.rowsByPlayer.get(player.player_id) ?? []
  const weeks = windowWeeks(m, player.team, w)
  const rows = all.filter((r) => weeks.has(r.week))
  const sum = (f: (r: PlayerGame) => number) => rows.reduce((a, r) => a + f(r), 0)
  const q = m.data.meta.qualifiers[player.position]
  const pass = player.position === 'QB'
  const { pbp, ngs } = m.data.meta.sources
  // NGS skips low-volume weeks, so separation covers only the weeks it has.
  const ngsRows = rows.filter((r) => r.ngs_separation_x_targets != null && r.ngs_targets != null)
  const agg: Agg = {
    player,
    position: player.position,
    games: rows.filter(played).length,
    teamGames: weeks.size,
    rows,
    attempts: sum((r) => r.attempts),
    completions: sum((r) => r.completions),
    pass_yds: sum((r) => r.pass_yds),
    pass_td: sum((r) => r.pass_td),
    pass_int: sum((r) => r.pass_int),
    carries: sum((r) => r.carries),
    rush_yds: sum((r) => r.rush_yds),
    rush_td: sum((r) => r.rush_td),
    targets: sum((r) => r.targets),
    receptions: sum((r) => r.receptions),
    rec_yds: sum((r) => r.rec_yds),
    rec_td: sum((r) => r.rec_td),
    air_yards: sum((r) => r.air_yards),
    team_targets: sum((r) => r.team_targets),
    team_carries: sum((r) => r.team_carries),
    offense_snaps: sum((r) => r.offense_snaps),
    team_offense_snaps: sum((r) => r.team_offense_snaps),
    ppr: sum((r) => r.fantasy_pts_ppr),
    epa_targets: sumOpt(pbp, rows, (r) => r.epa_targets),
    epa_rush: sumOpt(pbp, rows, (r) => r.epa_rush),
    dropbacks: pass ? sumOpt(pbp, rows, (r) => r.dropbacks) : null,
    epa_dropbacks: pass ? sumOpt(pbp, rows, (r) => r.epa_dropbacks) : null,
    ngs_sep: ngsRows.length ? sumOpt(ngs, ngsRows, (r) => r.ngs_separation_x_targets) : null,
    ngs_targets: ngsRows.length ? sumOpt(ngs, ngsRows, (r) => r.ngs_targets) : null,
    qualified: false,
    volume: 0,
    line: q.per_team_game * weeks.size,
  }
  agg.volume =
    q.stat === 'targets' ? agg.targets
    : q.stat === 'touches' ? agg.targets + agg.carries
    : agg.dropbacks ?? agg.attempts
  agg.qualified = agg.line > 0 && agg.volume >= agg.line
  return agg
}

export function aggregateTeam(m: Model, team: Team, w: Window): TeamAgg {
  const all = m.teamGamesByTeam.get(team.team) ?? []
  const rows = w === 'last4' ? all.slice(-4) : all
  const sum = (f: (r: TeamGame) => number) => rows.reduce((a, r) => a + f(r), 0)
  const pbp = m.data.meta.sources.pbp
  const opt = (f: (r: TeamGame) => number | null | undefined) => (pbp && rows.length ? rows.reduce((a, r) => a + (f(r) ?? 0), 0) : null)
  return {
    team,
    games: rows.length,
    off_plays: opt((r) => r.off_plays),
    off_epa: opt((r) => r.off_epa),
    def_plays: opt((r) => r.def_plays),
    def_epa_allowed: opt((r) => r.def_epa_allowed),
    def_dropbacks: opt((r) => r.def_dropbacks),
    def_pass_epa_allowed: opt((r) => r.def_pass_epa_allowed),
    ppr_allowed: {
      QB: sum((r) => r.ppr_allowed_qb),
      RB: sum((r) => r.ppr_allowed_rb),
      WR: sum((r) => r.ppr_allowed_wr),
      TE: sum((r) => r.ppr_allowed_te),
    },
    points_against: sum((r) => r.points_against),
  }
}

// ---------- metrics ----------

const ratio = (a: number | null, b: number | null) => (a == null || b == null || b === 0 ? null : a / b)

export type MetricKey =
  | 'ppr_pg' | 'targets_pg' | 'target_share' | 'epa_per_target' | 'sep' | 'sep_oe' | 'adot'
  | 'snap_share' | 'opp_share' | 'carry_share' | 'epa_per_touch' | 'touches_pg'
  | 'dropbacks_pg' | 'epa_per_dropback' | 'comp_pct' | 'pass_adot'

export interface Metric {
  key: MetricKey
  label: string
  /** Lowercase noun phrase for sentences: "1st in target share". */
  phrase: string
  /** Unit word appended in hover text, if any. */
  format: (v: number) => string
  get: (a: Agg, m: Model) => number | null
  /** Which way is better for edges. Null = style, no winner. */
  better: 'high' | 'low' | null
  needs?: 'pbp' | 'ngs'
}

export const minus = (s: string) => s.replace('-', '−')
const signed = (d: number) => (v: number) => minus((v > 0 ? '+' : '') + v.toFixed(d))
const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const fixed = (d: number) => (v: number) => minus(v.toFixed(d))

export const METRICS: Record<MetricKey, Metric> = {
  ppr_pg: { key: 'ppr_pg', label: 'PPR / game', phrase: 'PPR per game', format: fixed(1), better: 'high', get: (a) => ratio(a.ppr, a.games) },
  targets_pg: { key: 'targets_pg', label: 'Targets / game', phrase: 'targets per game', format: fixed(1), better: 'high', get: (a) => ratio(a.targets, a.games) },
  target_share: { key: 'target_share', label: 'Target share', phrase: 'target share', format: pct, better: 'high', get: (a) => ratio(a.targets, a.team_targets) },
  epa_per_target: { key: 'epa_per_target', label: 'EPA / target', phrase: 'EPA per target', format: signed(2), better: 'high', needs: 'pbp', get: (a) => ratio(a.epa_targets, a.targets) },
  sep: { key: 'sep', label: 'Separation', phrase: 'separation', format: (v) => `${v.toFixed(2)} yd`, better: 'high', needs: 'ngs', get: (a) => ratio(a.ngs_sep, a.ngs_targets) },
  sep_oe: {
    key: 'sep_oe', label: 'Separation over expected', phrase: 'separation over expected', format: signed(2), better: 'high', needs: 'ngs',
    get: (a, m) => {
      const fit = m.data.meta.separation_fit
      const sep = ratio(a.ngs_sep, a.ngs_targets)
      const adot = ratio(a.air_yards, a.targets)
      return fit && sep != null && adot != null ? sep - (fit.intercept + fit.slope * adot) : null
    },
  },
  adot: { key: 'adot', label: 'aDOT (yd)', phrase: 'average depth of target', format: fixed(1), better: null, get: (a) => ratio(a.air_yards, a.targets) },
  snap_share: { key: 'snap_share', label: 'Snap share', phrase: 'snap share', format: (v) => `${Math.round(v * 100)}%`, better: 'high', get: (a) => ratio(a.offense_snaps, a.team_offense_snaps) },
  opp_share: { key: 'opp_share', label: 'Opportunity share', phrase: 'opportunity share', format: pct, better: 'high', get: (a) => ratio(a.carries + a.targets, a.team_carries + a.team_targets) },
  carry_share: { key: 'carry_share', label: 'Carry share', phrase: 'carry share', format: pct, better: 'high', get: (a) => ratio(a.carries, a.team_carries) },
  epa_per_touch: {
    key: 'epa_per_touch', label: 'EPA / touch', phrase: 'EPA per touch', format: signed(2), better: 'high', needs: 'pbp',
    get: (a) => (a.epa_rush == null || a.epa_targets == null ? null : ratio(a.epa_rush + a.epa_targets, a.carries + a.targets)),
  },
  touches_pg: { key: 'touches_pg', label: 'Touches / game', phrase: 'touches per game', format: fixed(1), better: 'high', get: (a) => ratio(a.carries + a.targets, a.games) },
  dropbacks_pg: { key: 'dropbacks_pg', label: 'Dropbacks / game', phrase: 'dropbacks per game', format: fixed(1), better: 'high', needs: 'pbp', get: (a) => ratio(a.dropbacks, a.games) },
  epa_per_dropback: { key: 'epa_per_dropback', label: 'EPA / dropback', phrase: 'EPA per dropback', format: signed(2), better: 'high', needs: 'pbp', get: (a) => ratio(a.epa_dropbacks, a.dropbacks) },
  comp_pct: { key: 'comp_pct', label: 'Completion %', phrase: 'completion rate', format: pct, better: 'high', get: (a) => ratio(a.completions, a.attempts) },
  pass_adot: { key: 'pass_adot', label: 'Pass aDOT (yd)', phrase: 'average depth of throw', format: fixed(1), better: null, get: (a) => ratio(a.air_yards, a.attempts) },
}

// ---------- position pool ----------

export interface Pool {
  position: Position
  window: Window
  all: Agg[]
  qualified: Agg[]
  byId: Map<string, Agg>
}

export function pool(m: Model, position: Position, w: Window): Pool {
  const all = m.data.players
    .filter((p) => p.position === position && m.rowsByPlayer.has(p.player_id))
    .map((p) => aggregate(m, p, w))
    .filter((a) => a.games > 0)
  return { position, window: w, all, qualified: all.filter((a) => a.qualified), byId: new Map(all.map((a) => [a.player.player_id, a])) }
}

export interface Rank {
  rank: number
  of: number
}

/** Rank among qualified players with a value. Unqualified players get null. */
export function rankOf(p: Pool, m: Model, key: MetricKey, id: string): Rank | null {
  const metric = METRICS[key]
  const a = p.byId.get(id)
  if (!a?.qualified) return null
  const mine = metric.get(a, m)
  if (mine == null) return null
  const vals = p.qualified.map((x) => metric.get(x, m)).filter((v): v is number => v != null)
  const dir = metric.better === 'low' ? -1 : 1
  return { rank: 1 + vals.filter((v) => dir * v > dir * mine).length, of: vals.length }
}

export function mean(p: Pool, m: Model, key: MetricKey): number | null {
  const vals = p.qualified.map((x) => METRICS[key].get(x, m)).filter((v): v is number => v != null)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

// ---------- matchups ----------

export interface Matchup {
  game: Game
  week: number
  opponent: string
  isHome: boolean
  /** Points the team is favored by; negative = underdog. */
  favoredBy: number | null
  total: number | null
  impliedTotal: number | null
}

export function nextGame(m: Model, team: string): Matchup | null {
  const week = m.data.meta.thru_week + 1
  const game = m.data.schedule.find((g) => g.week === week && (g.home_team === team || g.away_team === team))
  if (!game) return null
  const isHome = game.home_team === team
  const favoredBy = game.spread_line == null ? null : isHome ? game.spread_line : -game.spread_line
  const impliedTotal = game.total_line == null || favoredBy == null ? null : (game.total_line + favoredBy) / 2
  return { game, week, opponent: isHome ? game.away_team : game.home_team, isHome, favoredBy, total: game.total_line, impliedTotal }
}

export interface DefenseRanks {
  /** 1 = toughest (least EPA per dropback allowed). */
  passD: Rank | null
  passEpaPerDropback: number | null
  /** 1 = fewest PPR allowed to the position. */
  pprAllowed: Rank
  pprAllowedPerGame: number
  /** 1 = least EPA per play allowed. */
  defEpa: Rank | null
  defEpaPerPlay: number | null
}

export function defenseRanks(m: Model, team: string, position: Position, w: Window = 'season'): DefenseRanks {
  const teams = m.data.teams.map((t) => aggregateTeam(m, t, w)).filter((t) => t.games > 0)
  const rankAsc = (f: (t: TeamAgg) => number | null): Rank | null => {
    const mine = teams.find((t) => t.team.team === team)
    const v = mine ? f(mine) : null
    if (v == null) return null
    const vals = teams.map(f).filter((x): x is number => x != null)
    return { rank: 1 + vals.filter((x) => x < v).length, of: vals.length }
  }
  const mine = teams.find((t) => t.team.team === team)
  const passEpa = (t: TeamAgg) => ratio(t.def_pass_epa_allowed, t.def_dropbacks)
  const defEpa = (t: TeamAgg) => ratio(t.def_epa_allowed, t.def_plays)
  const ppr = (t: TeamAgg) => t.ppr_allowed[position] / t.games
  return {
    passD: rankAsc(passEpa),
    passEpaPerDropback: mine ? passEpa(mine) : null,
    pprAllowed: rankAsc(ppr) ?? { rank: 0, of: teams.length },
    pprAllowedPerGame: mine ? ppr(mine) : 0,
    defEpa: rankAsc(defEpa),
    defEpaPerPlay: mine ? defEpa(mine) : null,
  }
}

// ---------- names and copy helpers ----------

export const POSITION_NAMES: Record<Position, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends',
}

/** Team logo URL: the data's own, else the bundled badge in public/logos. */
export function logoFor(m: Model, team: string): string {
  return m.teamsByAbbr.get(team)?.logo || `/logos/${team}.svg`
}

export function shortName(name: string): string {
  const parts = name.split(' ')
  if (parts.length < 2) return name
  return `${parts[0]![0]}. ${parts.slice(1).join(' ')}`
}

export function lastName(name: string): string {
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ')
  return parts.slice(1).join(' ') || name
}

export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function formatKickoff(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(d)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(d)
  return `${day.replace(',', '')} · ${time} ET`
}

export function formatKickoffShort(iso: string): string {
  const d = new Date(iso)
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'America/New_York' }).format(d)
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(d)
  return `${day} ${time} ET`
}

export function spreadText(team: string, favoredBy: number | null): string | null {
  if (favoredBy == null) return null
  if (favoredBy === 0) return 'PK'
  return `${team} ${minus(String(-favoredBy > 0 ? '+' + -favoredBy : -favoredBy))}`
}
