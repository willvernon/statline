// Quadrant chart definitions per position. WR comes straight from the design.
// QB, RB and TE axes are first guesses that follow the same idea: volume on one
// axis, what the player does with it on the other.

import type { Position } from './contract.ts'
import type { MetricKey } from './derive.ts'

export type Quadrant = 'tl' | 'tr' | 'bl' | 'br'

export interface ChartDef {
  id: string
  title: string
  /** Shown under the title on the player page. */
  blurb: string
  x: MetricKey
  y: MetricKey
  xAxis: string
  yAxis: string
  /** Corner labels; "t" = above the y average, "r" = right of the x average. */
  quadrants: Record<Quadrant, string>
  /** Which metric the verdict sentence names first. */
  lead: 'x' | 'y'
  /** Default leaderboard on the explorer: the quadrant worth surfacing. */
  spotlight: Quadrant
  spotlightBlurb: string
  how: { across: string; up: string; formula?: 'sep_oe' }
}

const volumeVsEfficiencyWR: ChartDef = {
  id: 'volume-efficiency',
  title: 'Volume vs efficiency',
  blurb: 'Target share against EPA per target.',
  x: 'target_share',
  y: 'epa_per_target',
  xAxis: 'Target share →',
  yAxis: '↑ EPA per target',
  quadrants: { tl: 'Efficient, underfed', tr: 'Fed + efficient', bl: 'Neither', br: 'Fed, inefficient' },
  lead: 'x',
  spotlight: 'tl',
  spotlightBlurb: 'Most EPA per target, below-average target share',
  how: {
    across: 'Targets divided by team targets in the games played. Summed first, then divided, never an average of weekly shares.',
    up: 'Expected points added on plays where the player was targeted, divided by targets. From nflverse play-by-play.',
  },
}

const gettingOpen: ChartDef = {
  id: 'getting-open',
  title: 'Getting open',
  blurb: 'Separation when the ball arrives, minus what target depth predicts.',
  x: 'sep_oe',
  y: 'target_share',
  xAxis: 'Separation over expected, yd →',
  yAxis: '↑ Target share',
  quadrants: { tl: 'Fed, not open', tr: 'Open + fed', bl: 'Neither', br: 'Open, not fed' },
  lead: 'y',
  spotlight: 'br',
  spotlightBlurb: 'Most separation over expected, below-average target share',
  how: {
    across: 'Average separation when the ball arrives (Next Gen Stats), minus what average target depth predicts. Deep targets come with less separation, so the raw number mostly measures route depth.',
    up: 'Targets divided by team targets in the games played. Summed first, then divided, never an average of weekly shares.',
    formula: 'sep_oe',
  },
}

export const CHARTS: Record<Position, ChartDef[]> = {
  WR: [volumeVsEfficiencyWR, gettingOpen],
  TE: [volumeVsEfficiencyWR, gettingOpen],
  RB: [
    {
      id: 'volume-efficiency',
      title: 'Volume vs efficiency',
      blurb: 'Share of team carries and targets against EPA per touch.',
      x: 'opp_share',
      y: 'epa_per_touch',
      xAxis: 'Opportunity share →',
      yAxis: '↑ EPA per touch',
      quadrants: { tl: 'Efficient, underused', tr: 'Workhorse + efficient', bl: 'Neither', br: 'Workhorse, inefficient' },
      lead: 'x',
      spotlight: 'tl',
      spotlightBlurb: 'Most EPA per touch, below-average opportunity share',
      how: {
        across: 'Carries plus targets, divided by team carries plus team targets in the games played.',
        up: 'EPA on carries plus EPA on targets, divided by carries plus targets. From nflverse play-by-play.',
      },
    },
    {
      id: 'role',
      title: 'Ground vs air',
      blurb: 'Carry share against target share.',
      x: 'carry_share',
      y: 'target_share',
      xAxis: 'Carry share →',
      yAxis: '↑ Target share',
      quadrants: { tl: 'Receiving back', tr: 'Three-down back', bl: 'Committee', br: 'Early-down back' },
      lead: 'x',
      spotlight: 'tr',
      spotlightBlurb: 'Above-average share on the ground and through the air',
      how: {
        across: 'Carries divided by team carries in the games played.',
        up: 'Targets divided by team targets in the games played.',
      },
    },
  ],
  QB: [
    {
      id: 'volume-efficiency',
      title: 'Volume vs efficiency',
      blurb: 'Dropbacks per game against EPA per dropback.',
      x: 'dropbacks_pg',
      y: 'epa_per_dropback',
      xAxis: 'Dropbacks per game →',
      yAxis: '↑ EPA per dropback',
      quadrants: { tl: 'Efficient, low volume', tr: 'Volume + efficient', bl: 'Neither', br: 'Volume, inefficient' },
      lead: 'y',
      spotlight: 'tl',
      spotlightBlurb: 'Most EPA per dropback on below-average volume',
      how: {
        across: 'Dropbacks (pass attempts, sacks and scrambles) divided by games played.',
        up: 'Expected points added on dropbacks, divided by dropbacks. From nflverse play-by-play.',
      },
    },
    {
      id: 'depth-accuracy',
      title: 'Depth vs accuracy',
      blurb: 'How far downfield the passes go against how often they land.',
      x: 'pass_adot',
      y: 'comp_pct',
      xAxis: 'Average depth of throw, yd →',
      yAxis: '↑ Completion %',
      quadrants: { tl: 'Short + accurate', tr: 'Deep + accurate', bl: 'Short, misses', br: 'Deep, misses' },
      lead: 'y',
      spotlight: 'tr',
      spotlightBlurb: 'Above-average depth and above-average completion rate',
      how: {
        across: 'Air yards divided by pass attempts.',
        up: 'Completions divided by pass attempts.',
      },
    },
  ],
}

/** Tiles at the top of the player page, by position. */
export const TILES: Record<Position, MetricKey[]> = {
  WR: ['ppr_pg', 'target_share', 'epa_per_target'],
  TE: ['ppr_pg', 'target_share', 'epa_per_target'],
  RB: ['ppr_pg', 'opp_share', 'epa_per_touch'],
  QB: ['ppr_pg', 'epa_per_dropback', 'dropbacks_pg'],
}

/** Rows on the start-or-sit screen. Matchup rows are appended by the screen. */
export const COMPARE_ROWS: Record<Position, { key: MetricKey; window?: 'last4' }[]> = {
  WR: [{ key: 'ppr_pg' }, { key: 'ppr_pg', window: 'last4' }, { key: 'targets_pg' }, { key: 'target_share' }, { key: 'epa_per_target' }, { key: 'sep_oe' }, { key: 'adot' }],
  TE: [{ key: 'ppr_pg' }, { key: 'ppr_pg', window: 'last4' }, { key: 'targets_pg' }, { key: 'target_share' }, { key: 'epa_per_target' }, { key: 'sep_oe' }, { key: 'adot' }],
  RB: [{ key: 'ppr_pg' }, { key: 'ppr_pg', window: 'last4' }, { key: 'touches_pg' }, { key: 'opp_share' }, { key: 'target_share' }, { key: 'epa_per_touch' }],
  QB: [{ key: 'ppr_pg' }, { key: 'ppr_pg', window: 'last4' }, { key: 'dropbacks_pg' }, { key: 'epa_per_dropback' }, { key: 'comp_pct' }, { key: 'pass_adot' }],
}

export function quadrantOf(x: number, y: number, ax: number, ay: number): Quadrant {
  return `${y >= ay ? 't' : 'b'}${x >= ax ? 'r' : 'l'}` as Quadrant
}
