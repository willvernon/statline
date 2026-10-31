// The files the app reads. This is the seam between the pipeline and the UI:
// produce these five JSON files (arrays of objects, one per row) and the app
// renders. Field names follow the fantasy marts plan.
//
// Rules the UI relies on:
// - `player_id` is the gsis_id, `team` / `opponent` are team_abbr (Rams = LA).
// - Row measures are additive (counts and sums). The UI builds every rate as a
//   ratio of sums over the selected window, never an average of weekly rates.
// - Only weeks <= meta.thru_week are present in player_games / team_games.
// - Optional fields come from play-by-play (EPA) and Next Gen Stats, which the
//   pipeline does not load yet. meta.sources says which are loaded; charts that
//   need a missing source render an "unavailable" state.
// - Once play-by-play is loaded, coalesce EPA fields to 0 in dbt, so null only
//   ever means "not loaded". NGS is different: nflverse only publishes
//   player-weeks above a target minimum, so null NGS rows are expected and the UI
//   sums NGS over the weeks that have it.

export type Position = 'QB' | 'RB' | 'WR' | 'TE'

/** meta.json — one object. */
export interface Meta {
  season: number
  /** Last week where every regular-season game is final (int_complete_weeks). */
  thru_week: number
  /** Count of final games in the week after thru_week, for the freshness line. */
  next_week_games_final: number
  next_week_games_total: number
  generated_at: string
  /** 'mock' shows a banner so fixture numbers never pass as real. */
  source: 'mock' | 'statline'
  /** Which optional sources are loaded. Gates the charts that need them. */
  sources: { pbp: boolean; ngs: boolean }
  /** Qualifier: targets (or the position's volume stat) per team game. */
  qualifiers: Record<Position, { stat: QualifierStat; per_team_game: number }>
  /**
   * Expected separation given aDOT, fit in dbt across qualified WRs and TEs.
   * sep_oe = separation - (intercept + slope * aDOT). Null until NGS is loaded.
   */
  separation_fit: { intercept: number; slope: number; n: number } | null
}

export type QualifierStat = 'targets' | 'touches' | 'dropbacks'

/** teams.json — one row per team_abbr (dim_team). */
export interface Team {
  team: string
  name: string
  /** Primary color, hex, for team dots on the teams chart. */
  color: string
}

/** players.json — one row per player_id (dim_player), as of thru_week. */
export interface Player {
  player_id: string
  name: string
  team: string
  position: Position
}

/** schedule.json — one row per game_id (dim_game), whole season incl. future weeks. */
export interface Game {
  game_id: string
  season: number
  week: number
  game_type: 'REG' | 'POST'
  home_team: string
  away_team: string
  /** ISO 8601 with offset. */
  kickoff: string
  /** nflverse convention: positive = home team favored by that many points. */
  spread_line: number | null
  total_line: number | null
  home_score: number | null
  away_score: number | null
}

/** player_games.json — one row per player_id per game_id (mart_fantasy_player_game). */
export interface PlayerGame {
  player_id: string
  game_id: string
  season: number
  week: number
  team: string
  opponent: string
  is_home: boolean
  /** Position as of that game. */
  position: Position

  attempts: number
  completions: number
  pass_yds: number
  pass_td: number
  pass_int: number
  sacks_taken: number
  pass_2pt: number

  carries: number
  rush_yds: number
  rush_td: number
  rush_2pt: number

  targets: number
  receptions: number
  rec_yds: number
  rec_td: number
  rec_2pt: number
  air_yards: number
  yac: number

  fumbles_lost: number

  team_targets: number
  team_carries: number
  team_air_yards: number
  /** Counts, not snap_pct, so snap share can be summed over a window. */
  offense_snaps: number
  team_offense_snaps: number

  fantasy_pts_std: number
  fantasy_pts_half: number
  fantasy_pts_ppr: number

  /** Sum of EPA on plays where this player was the target. Needs play-by-play. */
  epa_targets?: number | null
  /** Sum of EPA on this player's carries. Needs play-by-play. */
  epa_rush?: number | null
  /** QB: dropbacks and summed EPA on them. Needs play-by-play. */
  dropbacks?: number | null
  epa_dropbacks?: number | null
  /** NGS: average separation x NGS targets, so it sums. Null for weeks NGS skips. */
  ngs_separation_x_targets?: number | null
  ngs_targets?: number | null
}

/** team_games.json — one row per team per game_id (mart_fantasy_team_defense_game + offense). */
export interface TeamGame {
  team: string
  game_id: string
  season: number
  week: number
  opponent: string

  points_for: number
  points_against: number

  // Group B: fantasy points allowed to position (the matchup lens).
  ppr_allowed_qb: number
  ppr_allowed_rb: number
  ppr_allowed_wr: number
  ppr_allowed_te: number
  targets_allowed_wr: number
  targets_allowed_te: number
  targets_allowed_rb: number
  pass_yds_allowed: number

  /** Offensive plays and summed EPA. Needs play-by-play. */
  off_plays?: number | null
  off_epa?: number | null
  /** Defensive plays faced and summed EPA allowed. Needs play-by-play. */
  def_plays?: number | null
  def_epa_allowed?: number | null
  /** Opponent dropbacks and summed EPA allowed on them. Needs play-by-play. */
  def_dropbacks?: number | null
  def_pass_epa_allowed?: number | null
}

export interface Dataset {
  meta: Meta
  teams: Team[]
  players: Player[]
  schedule: Game[]
  playerGames: PlayerGame[]
  teamGames: TeamGame[]
}
