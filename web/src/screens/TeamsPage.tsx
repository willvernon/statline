import { useState } from 'react'
import { PositionTabs, Shell } from '../components/Shell.tsx'
import { TeamScatter, teamEpa } from '../components/PlayerParts.tsx'
import { DESKTOP, useMedia } from '../components/useMedia.ts'
import type { Position } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import { METRICS } from '../data/derive.ts'

type Sort = 'off' | 'def' | Position

export function TeamsPage() {
  const { model } = useData()
  const desktop = useMedia(DESKTOP)
  const [sort, setSort] = useState<Sort>('off')
  const rows = teamEpa(model).map((r) => ({
    ...r,
    allowed: Object.fromEntries((['QB', 'RB', 'WR', 'TE'] as Position[]).map((p) => [p, r.agg.games ? r.agg.ppr_allowed[p] / r.agg.games : 0])) as Record<Position, number>,
  }))
  const val = (r: (typeof rows)[number]) => (sort === 'off' ? -(r.off ?? 0) : sort === 'def' ? (r.def ?? 0) : -r.allowed[sort])
  rows.sort((a, b) => val(a) - val(b))
  const signed = METRICS.epa_per_target.format
  const th = (k: Sort, label: string) => (
    <th aria-sort={sort === k ? 'descending' : 'none'}>
      <button className={`mono sort${sort === k ? ' on' : ''}`} onClick={() => setSort(k)}>{label}</button>
    </th>
  )

  return (
    <Shell>
      <div className="explorer-head">
        <h1 className="display page-title">Teams</h1>
        <p className="mono muted-2">EPA per play and fantasy points allowed, through Week {model.data.meta.thru_week}</p>
      </div>
      {!desktop && <PositionTabs className="tabs-block" />}
      <div className="explorer-grid">
        <section className="card chart-card">
          <div className="card-head">
            <div>
              <h2 className="display">Offense vs defense</h2>
              <p className="sub">Team EPA per play. Not schedule-adjusted.</p>
            </div>
          </div>
          <TeamScatter highlight={[]} ariaLabel="All 32 teams, offense EPA per play across, defense EPA allowed up." />
        </section>
        <section className="card board">
          <h2 className="display">Rankings</h2>
          <p className="mono small muted-2">PPR allowed is per game. Tap a column to sort.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr className="mono">
                  <th className="l">Team</th>
                  {th('off', 'Off EPA')}
                  {th('def', 'Def EPA')}
                  {th('WR', 'WR PPR')}
                  {th('RB', 'RB PPR')}
                  {th('TE', 'TE PPR')}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.team.team}>
                    <td className="l">
                      <span className="team-chip mono"><i style={{ background: r.team.color }} />{r.team.team}</span>
                    </td>
                    <td className="mono">{r.off == null ? '—' : signed(r.off)}</td>
                    <td className="mono">{r.def == null ? '—' : signed(r.def)}</td>
                    <td className="mono">{r.allowed.WR.toFixed(1)}</td>
                    <td className="mono">{r.allowed.RB.toFixed(1)}</td>
                    <td className="mono">{r.allowed.TE.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  )
}
