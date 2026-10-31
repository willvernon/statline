// Generates the mock dataset in public/data/mock. Seeded, so reruns are stable.
// Run: npm run fixtures
//
// Everything here is invented. The goal is data with the same shape and rough
// distributions as the real marts, plus a handful of players pinned to the
// numbers in the design screens so the UI can be checked against them.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Game, Meta, Player, PlayerGame, Position, Team, TeamGame } from '../src/data/contract.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'mock')
const SEASON = 2026
const THRU_WEEK = 7
const NEXT_WEEK = 8

// ---------- rng ----------
let seed = 20261030
function rand() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function normal(mean = 0, sd = 1) {
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
function pick<T>(xs: readonly T[]): T {
  return xs[Math.floor(rand() * xs.length)]!
}
function shuffle<T>(xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j]!, xs[i]!]
  }
  return xs
}
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const r2 = (x: number) => Math.round(x * 100) / 100
const count = (mean: number) => Math.max(0, Math.round(normal(mean, Math.sqrt(Math.max(mean, 0.1)))))

// ---------- teams ----------
const TEAMS: Team[] = [
  ['ARI', 'Arizona Cardinals', '#97233F'], ['ATL', 'Atlanta Falcons', '#A71930'],
  ['BAL', 'Baltimore Ravens', '#241773'], ['BUF', 'Buffalo Bills', '#00338D'],
  ['CAR', 'Carolina Panthers', '#0085CA'], ['CHI', 'Chicago Bears', '#0B162A'],
  ['CIN', 'Cincinnati Bengals', '#FB4F14'], ['CLE', 'Cleveland Browns', '#311D00'],
  ['DAL', 'Dallas Cowboys', '#003594'], ['DEN', 'Denver Broncos', '#FB4F14'],
  ['DET', 'Detroit Lions', '#0076B6'], ['GB', 'Green Bay Packers', '#203731'],
  ['HOU', 'Houston Texans', '#03202F'], ['IND', 'Indianapolis Colts', '#002C5F'],
  ['JAX', 'Jacksonville Jaguars', '#006778'], ['KC', 'Kansas City Chiefs', '#E31837'],
  ['LA', 'Los Angeles Rams', '#003594'], ['LAC', 'Los Angeles Chargers', '#0080C6'],
  ['LV', 'Las Vegas Raiders', '#000000'], ['MIA', 'Miami Dolphins', '#008E97'],
  ['MIN', 'Minnesota Vikings', '#4F2683'], ['NE', 'New England Patriots', '#002244'],
  ['NO', 'New Orleans Saints', '#D3BC8D'], ['NYG', 'New York Giants', '#0B2265'],
  ['NYJ', 'New York Jets', '#125740'], ['PHI', 'Philadelphia Eagles', '#004C54'],
  ['PIT', 'Pittsburgh Steelers', '#101820'], ['SEA', 'Seattle Seahawks', '#002244'],
  ['SF', 'San Francisco 49ers', '#AA0000'], ['TB', 'Tampa Bay Buccaneers', '#D50A0A'],
  ['TEN', 'Tennessee Titans', '#0C2340'], ['WAS', 'Washington Commanders', '#5A1414'],
].map(([team, name, color]) => ({ team: team!, name: name!, color: color! }))
const ABBRS = TEAMS.map((t) => t.team)

// Offensive and defensive strength, EPA per play. Negative defense = stingy.
const strength: Record<string, { off: number; def: number }> = {}
for (const t of ABBRS) strength[t] = { off: normal(0, 0.07), def: normal(0, 0.06) }
Object.assign(strength, {
  SEA: { off: 0.12, def: -0.13 },
  CHI: { off: 0.03, def: 0.0 },
  DAL: { off: 0.05, def: 0.14 },
  CLE: { off: -0.12, def: -0.08 },
  LV: { off: -0.06, def: 0.07 },
  NYJ: { off: 0.0, def: -0.02 },
  ARI: { off: 0.02, def: 0.03 },
  PIT: { off: 0.01, def: -0.04 },
})

// ---------- schedule ----------
// Fixed pairs are [home, away]. Everything else is random matching.
const FIXED: Record<number, [string, string][]> = {
  1: [['SEA', 'NE']],
  2: [['ARI', 'SEA']],
  3: [['WAS', 'SEA']],
  4: [['SEA', 'LAC']],
  5: [['SEA', 'SF']],
  6: [['DEN', 'SEA']],
  7: [['SEA', 'KC']],
  8: [['SEA', 'CHI'], ['DAL', 'ARI'], ['PIT', 'CLE'], ['NYJ', 'LV']],
}
const WEEK1_THURSDAY = Date.UTC(2026, 8, 10) // Sep 10 2026

function etIso(dayMs: number, hh: number, mm: number) {
  // US DST 2026 ends Sun Nov 1 at 2am ET.
  const dstEnd = Date.UTC(2026, 10, 1, 6)
  const offset = dayMs + hh * 3600e3 < dstEnd ? 4 : 5
  const d = new Date(dayMs + (hh + offset) * 3600e3 + mm * 60e3)
  return d.toISOString().replace('.000Z', 'Z')
}

const schedule: Game[] = []
for (let week = 1; week <= NEXT_WEEK; week++) {
  const fixed = FIXED[week] ?? []
  const used = new Set(fixed.flat())
  let rest = shuffle(ABBRS.filter((t) => !used.has(t)))
  if (week === NEXT_WEEK) rest = rest.slice(4) // four byes
  const pairs: [string, string][] = [...fixed]
  for (let i = 0; i < rest.length; i += 2) pairs.push([rest[i]!, rest[i + 1]!])

  const thu = WEEK1_THURSDAY + (week - 1) * 7 * 86400e3
  const sun = thu + 3 * 86400e3
  const mon = thu + 4 * 86400e3
  // Slot order: TNF, SNF, MNF, then Sunday afternoon.
  const heroMonday = week === NEXT_WEEK
  const slots = shuffle(pairs.map((_, i) => i))
  pairs.forEach(([home, away], i) => {
    let kickoff: string
    const slot = slots.indexOf(i)
    if (heroMonday && home === 'SEA') kickoff = etIso(mon, 20, 15)
    else if (fixed.some((f) => f[0] === home) && week === NEXT_WEEK) kickoff = etIso(sun, 13, 0)
    else if (slot === 0) kickoff = etIso(thu, 20, 15)
    else if (slot === 1) kickoff = etIso(sun, 20, 20)
    else if (slot === 2 && !heroMonday) kickoff = etIso(mon, 20, 15)
    else kickoff = etIso(sun, slot % 3 === 0 ? 16 : 13, slot % 3 === 0 ? 25 : 0)

    const edge = strength[home]!.off - strength[home]!.def - (strength[away]!.off - strength[away]!.def)
    let spread = Math.round((edge * 40 + 1.5) * 2) / 2
    let total = Math.round((44 + (strength[home]!.off + strength[away]!.off) * 30) * 2) / 2
    if (week === NEXT_WEEK && home === 'SEA') [spread, total] = [3, 46.5]
    if (week === NEXT_WEEK && home === 'DAL') [spread, total] = [0, 47.5]
    if (week === NEXT_WEEK && home === 'PIT') [spread, total] = [5, 38]
    if (week === NEXT_WEEK && home === 'NYJ') [spread, total] = [1.5, 41.5]

    schedule.push({
      game_id: `${SEASON}_${String(week).padStart(2, '0')}_${away}_${home}`,
      season: SEASON,
      week,
      game_type: 'REG',
      home_team: home,
      away_team: away,
      kickoff,
      spread_line: spread,
      total_line: total,
      home_score: null,
      away_score: null,
    })
  })
}
// Week 8: only the Thursday game is final.
const week8Thursday = schedule
  .filter((g) => g.week === NEXT_WEEK)
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]!

// ---------- rosters ----------
type Slot = 'QB1' | 'QB2' | 'RB1' | 'RB2' | 'WR1' | 'WR2' | 'WR3' | 'WR4' | 'TE1' | 'TE2'
const SLOTS: { slot: Slot; pos: Position; tgt: number; car: number; snap: number }[] = [
  { slot: 'QB1', pos: 'QB', tgt: 0, car: 0.07, snap: 1 },
  { slot: 'QB2', pos: 'QB', tgt: 0, car: 0, snap: 0 },
  { slot: 'RB1', pos: 'RB', tgt: 0.1, car: 0.6, snap: 0.64 },
  { slot: 'RB2', pos: 'RB', tgt: 0.05, car: 0.3, snap: 0.36 },
  { slot: 'WR1', pos: 'WR', tgt: 0.24, car: 0.01, snap: 0.9 },
  { slot: 'WR2', pos: 'WR', tgt: 0.19, car: 0.01, snap: 0.86 },
  { slot: 'WR3', pos: 'WR', tgt: 0.13, car: 0.01, snap: 0.68 },
  { slot: 'WR4', pos: 'WR', tgt: 0.04, car: 0, snap: 0.24 },
  { slot: 'TE1', pos: 'TE', tgt: 0.17, car: 0, snap: 0.82 },
  { slot: 'TE2', pos: 'TE', tgt: 0.05, car: 0, snap: 0.4 },
]

const FIRST = ['Marcus', 'Tyler', 'Jalen', 'Devin', 'Chris', 'Andre', 'Malik', 'Cole', 'Trey', 'Isaiah', 'Brandon', 'Xavier',
  'Darius', 'Logan', 'Quentin', 'Rashad', 'Elijah', 'Garrett', 'Hunter', 'Kendall', 'Jordan', 'Mason', 'Nate', 'Omari',
  'Peyton', 'Reggie', 'Sam', 'Terrell', 'Vince', 'Wes', 'Zay', 'Cam', 'Dante', 'Evan', 'Jace', 'Keon', 'Luke', 'Micah']
const LAST = ['Holloway', 'Brennan', 'Okafor', 'Castillo', 'Whitfield', 'Ashby', 'Lindqvist', 'Mercer', 'Prater', 'Dunlap',
  'Fairley', 'Gaines', 'Hightower', 'Ivory', 'Jessup', 'Kessler', 'Lomax', 'Moton', 'Nwosu', 'Orr', 'Pruitt', 'Quarles',
  'Rhodes', 'Sistrunk', 'Tolbert', 'Underwood', 'Vance', 'Whitlock', 'Yarbrough', 'Ziegler', 'Abara', 'Bowles', 'Crowder',
  'Dorsett', 'Ellison', 'Frazier', 'Granger', 'Hatcher', 'Ingram', 'Joiner']
const usedNames = new Set<string>()
function fakeName() {
  for (;;) {
    const n = `${pick(FIRST)} ${pick(LAST)}`
    if (!usedNames.has(n)) return usedNames.add(n), n
  }
}

// Weekly line: [targets, receptions, rec_yds, rec_td, snap_pct]. Null = no row that week.
type Line = [number, number, number, number, number] | null

interface Hero {
  name: string
  team: string
  slot: Slot
  share: number
  epa: number
  sepOE: number
  adot: number
  lines?: Line[]
}
const HEROES: Hero[] = [
  {
    name: 'Jaxon Smith-Njigba', team: 'SEA', slot: 'WR1', share: 0.363, epa: 0.75, sepOE: -0.34, adot: 10.7,
    lines: [[11, 8, 122, 1, 0.9], [11, 9, 155, 3, 0.67], [14, 10, 128, 2, 0.87], [6, 5, 76, 0, 0.88],
      [8, 5, 102, 1, 0.84], [16, 12, 134, 0, 0.92], [12, 9, 150, 1, 0.77]],
  },
  {
    name: 'Omar Cooper Jr.', team: 'NYJ', slot: 'WR4', share: 0.161, epa: 1.44, sepOE: 0.51, adot: 13.1,
    lines: [[1, 1, 30, 0, 0.07], null, null, null, null, [7, 6, 103, 1, 0.82], [5, 4, 125, 1, 0.64]],
  },
  {
    name: 'Michael Wilson', team: 'ARI', slot: 'WR1', share: 0.243, epa: -0.1, sepOE: -0.4, adot: 10.8,
    lines: fromPpr([10.6, 3.8, 25.9, 16.5, 7.3, 7.2, 10.6], [9, 9, 12, 10, 9, 8, 9]),
  },
  {
    name: 'DK Metcalf', team: 'PIT', slot: 'WR1', share: 0.236, epa: 0.06, sepOE: -0.26, adot: 12.5,
    lines: fromPpr([8.0, 6.7, 12.1, 16.5, 5.3, 20.3, 7.6], [8, 7, 9, 9, 7, 10, 8]),
  },
  { name: 'Darnell Mooney', team: 'NYG', slot: 'WR3', share: 0.094, epa: 0.31, sepOE: 1.91, adot: 9.6 },
  { name: 'Isaac TeSlaa', team: 'DET', slot: 'WR3', share: 0.096, epa: 0.42, sepOE: 1.47, adot: 11.2 },
  { name: 'DeMario Douglas', team: 'NE', slot: 'WR2', share: 0.163, epa: 0.18, sepOE: 1.19, adot: 7.4 },
  { name: 'Jaylin Noel', team: 'HOU', slot: 'WR3', share: 0.1, epa: 0.22, sepOE: 1.02, adot: 9.9 },
  { name: 'Dohnte Meyers', team: 'CIN', slot: 'WR3', share: 0.093, epa: 0.27, sepOE: 0.92, adot: 10.3 },
]

/** Back out a box score line from a target PPR total. */
function fromPpr(ppr: number[], tgts: number[]): Line[] {
  return ppr.map((p, i) => {
    const tgt = tgts[i]!
    const td = p >= 20 ? 1 : 0
    let rec = Math.max(1, Math.round(tgt * 0.62))
    while (rec > 1 && (p - 6 * td - rec) * 10 < rec * 6) rec--
    const yds = Math.round((p - 6 * td - rec) * 10)
    return [tgt, rec, yds, td, 0.85 + normal(0, 0.04)]
  })
}

interface RosterPlayer {
  player: Player
  slot: Slot
  tgtW: number
  carW: number
  snap: number
  epaTgt: number
  epaCar: number
  adot: number
  sepOE: number
  catch: number
  ypc: number
  hero?: Hero
}

const roster: Record<string, RosterPlayer[]> = {}
let gsis = 31000
for (const team of ABBRS) {
  const heroes = HEROES.filter((h) => h.team === team)
  roster[team] = SLOTS.map((s) => {
    const hero = heroes.find((h) => h.slot === s.slot)
    const pos = s.pos
    const adot = hero?.adot ?? (pos === 'WR' ? normal(11, 2.6) : pos === 'TE' ? normal(7.2, 1.6) : pos === 'RB' ? normal(0.4, 1.2) : 0)
    return {
      player: { player_id: `00-00${gsis++}`, name: hero?.name ?? fakeName(), team, position: pos },
      slot: s.slot,
      tgtW: hero ? hero.share : s.tgt * clamp(normal(1, 0.22), 0.5, 1.45),
      carW: s.car,
      snap: s.snap,
      epaTgt: hero?.epa ?? clamp(normal(pos === 'RB' ? 0.05 : 0.2, 0.28), -0.6, 1.1),
      epaCar: normal(-0.04, 0.09),
      adot,
      sepOE: hero?.sepOE ?? clamp(normal(pos === 'TE' ? 0.15 : 0, 0.42), -1, 0.88),
      catch: pos === 'RB' ? 0.8 : pos === 'TE' ? 0.72 : clamp(0.78 - adot * 0.012, 0.5, 0.78),
      ypc: normal(4.3, 0.5),
      hero,
    }
  })
  // Renormalise the non-hero target weights so team shares sum to 1.
  const heroW = roster[team]!.filter((r) => r.hero).reduce((a, r) => a + r.tgtW, 0)
  const restW = roster[team]!.filter((r) => !r.hero).reduce((a, r) => a + r.tgtW, 0)
  for (const r of roster[team]!) if (!r.hero) r.tgtW *= (1 - heroW) / restW
}

// ---------- games ----------
const playerGames: PlayerGame[] = []
const teamGames: TeamGame[] = []
const completed = schedule.filter((g) => g.week <= THRU_WEEK || g.game_id === week8Thursday.game_id)

function scoring(r: PlayerGame) {
  const base = r.pass_yds * 0.04 + r.pass_td * 4 - r.pass_int * 2 + r.rush_yds * 0.1 + r.rush_td * 6 +
    r.rec_yds * 0.1 + r.rec_td * 6 - r.fumbles_lost * 2 + (r.pass_2pt + r.rush_2pt + r.rec_2pt) * 2
  r.fantasy_pts_std = r2(base)
  r.fantasy_pts_half = r2(base + r.receptions * 0.5)
  r.fantasy_pts_ppr = r2(base + r.receptions)
}

for (const g of completed) {
  const sides = [
    { team: g.home_team, opp: g.away_team, home: true },
    { team: g.away_team, opp: g.home_team, home: false },
  ]
  const offense: Record<string, { rows: PlayerGame[]; plays: number; epa: number; dropbacks: number; passEpa: number; points: number }> = {}

  for (const side of sides) {
    const rp = roster[side.team]!
    const env = strength[side.team]!.off + strength[side.opp]!.def
    // Team pass volume. Pinned heroes set the team total so their share lands.
    const pinned = rp.map((r) => r.hero?.lines?.[g.week - 1])
    const pinnedIdx = pinned.findIndex((l) => l != null)
    let teamTargets = Math.round(normal(33, 4))
    if (pinnedIdx >= 0) teamTargets = Math.round(pinned[pinnedIdx]![0] / rp[pinnedIdx]!.tgtW + normal(0, 1.5))
    const carriesTotal = Math.round(normal(25, 4))
    const sacks = count(2.4 + env * -6)
    const scrambles = count(2)
    const plays = teamTargets + 2 + sacks + scrambles + carriesTotal
    const snapsTotal = clamp(Math.round(plays * 0.98 + normal(0, 2)), 52, 78)

    const absent = rp.map((r) => r.hero?.lines != null && r.hero.lines[g.week - 1] === null)
    const presentW = rp.reduce((a, r, i) => a + (absent[i] || pinned[i] ? 0 : r.tgtW), 0)
    const pinnedTgts = pinned.reduce((a, l) => a + (l ? l[0] : 0), 0)

    const rows: PlayerGame[] = []
    rp.forEach((r, i) => {
      if (absent[i]) return
      const pos = r.player.position
      if (r.slot === 'QB2') return
      const line = pinned[i]
      const free = Math.max(0, teamTargets - pinnedTgts)
      const targets = line ? line[0] : count(free * (r.tgtW / presentW))
      const receptions = line ? line[1] : Math.min(targets, Math.round(targets * r.catch + normal(0, 0.8)))
      const recYds = line ? line[2] : Math.max(0, Math.round(receptions * (r.adot * 0.75 + 5.5 + normal(0, 2.2))))
      const recTd = line ? line[3] : count(targets * 0.045)
      const snapPct = line ? line[4] : clamp(r.snap + normal(0, 0.05), 0, 1)
      const carries = count(carriesTotal * r.carW)
      const rushYds = Math.round(carries * (r.ypc + normal(0, 1.2)))
      const rushTd = count(carries * 0.03)

      const row: PlayerGame = {
        player_id: r.player.player_id, game_id: g.game_id, season: SEASON, week: g.week,
        team: side.team, opponent: side.opp, is_home: side.home, position: pos,
        attempts: 0, completions: 0, pass_yds: 0, pass_td: 0, pass_int: 0, sacks_taken: 0, pass_2pt: 0,
        carries, rush_yds: rushYds, rush_td: rushTd, rush_2pt: 0,
        targets, receptions, rec_yds: recYds, rec_td: recTd, rec_2pt: !line && rand() < 0.015 ? 1 : 0,
        air_yards: Math.round(targets * (r.adot + normal(0, 1.5))),
        yac: Math.round(recYds * clamp(0.38 - r.adot * 0.012 + normal(0, 0.05), 0.08, 0.75)),
        fumbles_lost: !line && rand() < 0.02 ? 1 : 0,
        team_targets: 0, team_carries: 0, team_air_yards: 0,
        offense_snaps: Math.round(snapsTotal * snapPct), team_offense_snaps: snapsTotal,
        fantasy_pts_std: 0, fantasy_pts_half: 0, fantasy_pts_ppr: 0,
        epa_targets: r2(targets * (r.epaTgt + env * 0.5) + normal(0, 1.2 * Math.sqrt(targets))),
        epa_rush: r2(carries * (r.epaCar + env * 0.5) + normal(0, 0.9 * Math.sqrt(carries))),
        dropbacks: null, epa_dropbacks: null,
        ngs_separation_x_targets: null, ngs_targets: null,
      }
      if (pos === 'WR' || pos === 'TE') {
        const ngsT = Math.max(0, targets - (rand() < 0.3 ? 1 : 0))
        const sep = 4.06 - 0.109 * r.adot + r.sepOE + normal(0, 0.35)
        row.ngs_targets = ngsT
        row.ngs_separation_x_targets = r2(ngsT * Math.max(0.6, sep))
      }
      rows.push(row)
    })

    // QB line is the sum of the passing game it threw to.
    const qbRow = rows.find((x) => x.position === 'QB')!
    const recvs = rows.filter((x) => x !== qbRow)
    qbRow.attempts = recvs.reduce((a, x) => a + x.targets, 0) + 2
    qbRow.completions = recvs.reduce((a, x) => a + x.receptions, 0)
    qbRow.pass_yds = recvs.reduce((a, x) => a + x.rec_yds, 0)
    qbRow.pass_td = recvs.reduce((a, x) => a + x.rec_td, 0)
    qbRow.pass_int = count(0.75 + env * -3)
    qbRow.sacks_taken = sacks
    qbRow.carries += scrambles
    qbRow.rush_yds += scrambles * 6
    qbRow.air_yards = recvs.reduce((a, x) => a + x.air_yards, 0)
    qbRow.dropbacks = qbRow.attempts + sacks + scrambles
    const passEpa = recvs.reduce((a, x) => a + (x.epa_targets ?? 0), 0) - sacks * 1.6 - qbRow.pass_int * 3.5 + scrambles * 0.3
    qbRow.epa_dropbacks = r2(passEpa)

    const tTargets = rows.reduce((a, x) => a + x.targets, 0)
    const tCarries = rows.reduce((a, x) => a + x.carries, 0)
    const tAir = recvs.reduce((a, x) => a + x.air_yards, 0)
    for (const x of rows) {
      x.team_targets = tTargets
      x.team_carries = tCarries
      x.team_air_yards = tAir
      scoring(x)
    }
    const epa = passEpa + rows.reduce((a, x) => a + (x.epa_rush ?? 0), 0)
    const offPlays = (qbRow.dropbacks ?? 0) + tCarries - scrambles
    const points = clamp(Math.round(21 + (epa / offPlays) * 70 + normal(0, 6)), 0, 52)
    offense[side.team] = { rows, plays: offPlays, epa, dropbacks: qbRow.dropbacks ?? 0, passEpa, points }
    playerGames.push(...rows)
  }

  for (const side of sides) {
    const o = offense[side.team]!
    const d = offense[side.opp]!
    const allowed = (pos: Position, f: (x: PlayerGame) => number) =>
      r2(d.rows.filter((x) => x.position === pos).reduce((a, x) => a + f(x), 0))
    teamGames.push({
      team: side.team, game_id: g.game_id, season: SEASON, week: g.week, opponent: side.opp,
      points_for: o.points, points_against: d.points,
      ppr_allowed_qb: allowed('QB', (x) => x.fantasy_pts_ppr),
      ppr_allowed_rb: allowed('RB', (x) => x.fantasy_pts_ppr),
      ppr_allowed_wr: allowed('WR', (x) => x.fantasy_pts_ppr),
      ppr_allowed_te: allowed('TE', (x) => x.fantasy_pts_ppr),
      targets_allowed_wr: allowed('WR', (x) => x.targets),
      targets_allowed_te: allowed('TE', (x) => x.targets),
      targets_allowed_rb: allowed('RB', (x) => x.targets),
      pass_yds_allowed: allowed('QB', (x) => x.pass_yds),
      off_plays: o.plays, off_epa: r2(o.epa),
      def_plays: d.plays, def_epa_allowed: r2(d.epa),
      def_dropbacks: d.dropbacks, def_pass_epa_allowed: r2(d.passEpa),
    })
  }
  const home = offense[g.home_team]!
  const away = offense[g.away_team]!
  g.home_score = home.points
  g.away_score = away.points === home.points ? away.points + 3 : away.points
}

// Pin hero season EPA per target and separation exactly, so the design numbers hold.
for (const h of HEROES) {
  const r = roster[h.team]!.find((x) => x.hero === h)!
  const rows = playerGames.filter((x) => x.player_id === r.player.player_id && x.week <= THRU_WEEK)
  const tgts = rows.reduce((a, x) => a + x.targets, 0)
  const epaGap = h.epa * tgts - rows.reduce((a, x) => a + (x.epa_targets ?? 0), 0)
  const ngs = rows.reduce((a, x) => a + (x.ngs_targets ?? 0), 0)
  const air = rows.reduce((a, x) => a + x.air_yards, 0)
  const sepGoal = (4.06 - 0.109 * (air / tgts) + h.sepOE) * ngs
  const sepGap = sepGoal - rows.reduce((a, x) => a + (x.ngs_separation_x_targets ?? 0), 0)
  for (const x of rows) {
    x.epa_targets = r2((x.epa_targets ?? 0) + epaGap * (x.targets / tgts))
    if (ngs) x.ngs_separation_x_targets = r2((x.ngs_separation_x_targets ?? 0) + sepGap * ((x.ngs_targets ?? 0) / ngs))
  }
}

// ---------- separation fit (what dbt would compute) ----------
const teamGamesPlayed: Record<string, number> = {}
for (const t of teamGames) if (t.week <= THRU_WEEK) teamGamesPlayed[t.team] = (teamGamesPlayed[t.team] ?? 0) + 1
const byPlayer = new Map<string, PlayerGame[]>()
for (const x of playerGames) if (x.week <= THRU_WEEK) byPlayer.set(x.player_id, [...(byPlayer.get(x.player_id) ?? []), x])
const pts: [number, number][] = []
for (const [, rows] of byPlayer) {
  const pos = rows[0]!.position
  if (pos !== 'WR' && pos !== 'TE') continue
  const tgts = rows.reduce((a, x) => a + x.targets, 0)
  const team = rows[rows.length - 1]!.team
  if (tgts < 2.5 * (teamGamesPlayed[team] ?? 0)) continue
  const ngs = rows.reduce((a, x) => a + (x.ngs_targets ?? 0), 0)
  const sep = rows.reduce((a, x) => a + (x.ngs_separation_x_targets ?? 0), 0) / ngs
  const adot = rows.reduce((a, x) => a + x.air_yards, 0) / tgts
  pts.push([adot, sep])
}
const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length
const my = pts.reduce((a, p) => a + p[1], 0) / pts.length
const slope = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)

const players: Player[] = Object.values(roster).flat().map((r) => r.player)

const meta: Meta = {
  season: SEASON,
  thru_week: THRU_WEEK,
  next_week_games_final: 1,
  next_week_games_total: schedule.filter((g) => g.week === NEXT_WEEK).length,
  generated_at: '2026-10-30T12:00:00Z',
  source: 'mock',
  sources: { pbp: true, ngs: true },
  qualifiers: {
    QB: { stat: 'dropbacks', per_team_game: 14 },
    RB: { stat: 'touches', per_team_game: 6 },
    WR: { stat: 'targets', per_team_game: 2.5 },
    TE: { stat: 'targets', per_team_game: 2.5 },
  },
  separation_fit: { intercept: r2(my - slope * mx), slope: Math.round(slope * 1000) / 1000, n: pts.length },
}

// Week 8 rows are not published: only thru_week makes it into the marts.
const publishedPlayerGames = playerGames.filter((x) => x.week <= THRU_WEEK)
const publishedTeamGames = teamGames.filter((x) => x.week <= THRU_WEEK)

mkdirSync(OUT, { recursive: true })
const write = (name: string, data: unknown) => writeFileSync(join(OUT, name), JSON.stringify(data))
write('meta.json', meta)
write('teams.json', TEAMS)
write('players.json', players)
write('schedule.json', schedule)
write('player_games.json', publishedPlayerGames)
write('team_games.json', publishedTeamGames)
console.log(`wrote ${players.length} players, ${publishedPlayerGames.length} player-games, ${publishedTeamGames.length} team-games, fit n=${pts.length} ${meta.separation_fit!.intercept} ${meta.separation_fit!.slope}`)
