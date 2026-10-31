import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ACCENT, ChartCard } from '../components/ChartCard.tsx'
import { Icon } from '../components/Icon.tsx'
import { GameLog, MatchupCard, MatchupChartCard, RoleTrendCard, SmallSampleNote, StatTiles, WeeklyPprCard } from '../components/PlayerParts.tsx'
import { Segmented } from '../components/Segmented.tsx'
import { Freshness, Shell, useShare } from '../components/Shell.tsx'
import { DESKTOP, useMedia } from '../components/useMedia.ts'
import { CHARTS } from '../data/charts.ts'
import { useData } from '../data/DataContext.tsx'
import { aggregate, type Window } from '../data/derive.ts'
import { comparePath } from '../paths.ts'
import { NotFound } from './NotFound.tsx'

export function PlayerPage() {
  const { id = '' } = useParams()
  const { model, pool } = useData()
  const desktop = useMedia(DESKTOP)
  const [win, setWin] = useState<Window>('season')
  const { share, toast } = useShare()
  const player = model.playersById.get(id)
  if (!player) return <NotFound what="player" />

  const team = model.teamsByAbbr.get(player.team)
  const season = aggregate(model, player, 'season')
  const seasonPool = pool(player.position, 'season')
  const chartPool = pool(player.position, win)
  const chartAgg = chartPool.byId.get(id) ?? aggregate(model, player, win)
  const small = !season.qualified
  const charts = CHARTS[player.position]
  const n = seasonPool.qualified.length
  const q = model.data.meta.qualifiers[player.position]

  const onShare = () => share(`${player.name} · Statline`)

  const header = (
    <div className="player-head">
      <div>
        <div className="team-line">
          <span className="team-chip mono"><i style={{ background: team?.color }} />{player.team}</span>
          <span className="mono muted-2">{player.position} {desktop ? '· ' : ''}{team?.name.toUpperCase()}</span>
        </div>
        <h1 className="display player-name">{player.name}</h1>
        {!desktop && <Freshness />}
      </div>
      <div className="actions">
        <Link className="btn-outline" to={comparePath(player)}><Icon name="swap" size={18} /> Compare</Link>
        <button className="btn-dark" onClick={onShare}><Icon name="share" size={18} /> Share link</button>
      </div>
    </div>
  )

  const highlight = [{ agg: chartAgg, color: ACCENT }]
  const subFor = (i: number) =>
    i === 0 && !small ? `${n} ${player.position}s with ${q.per_team_game}+ ${q.stat} per team game.${desktop ? '' : ` Dashed lines mark the ${player.position} average.`}` : undefined
  const chartCards = (small ? [...charts].reverse() : charts).map((c, i) => (
    <ChartCard
      key={c.id}
      chart={c}
      pool={chartPool}
      highlights={highlight}
      verdictFor={chartAgg}
      sub={small && i === 0 ? 'Hollow dot: not enough volume to qualify yet.' : subFor(i)}
    />
  ))

  const toggle = <Segmented value={win} onChange={setWin} options={[['season', 'Season'], ['last4', 'Last 4']]} label="Chart window" />

  if (desktop) {
    return (
      <Shell variant="detail" onShare={onShare} position={player.position} example={season}>
        {header}
        <div className="player-grid">
          <div className="col-left">
            {small && <SmallSampleNote agg={season} model={model} />}
            <StatTiles agg={season} pool={seasonPool} />
            <MatchupCard agg={season} compact />
            <GameLog agg={season} />
          </div>
          <div className="col-right">
            <div className="charts-head">{toggle}</div>
            <div className="chart-grid">
              {chartCards}
              <MatchupChartCard agg={season} />
              {small ? <RoleTrendCard agg={season} /> : <WeeklyPprCard agg={season} />}
            </div>
          </div>
        </div>
        {toast}
      </Shell>
    )
  }

  return (
    <Shell variant="detail" onShare={onShare} position={player.position} example={season}>
      {header}
      {small && <SmallSampleNote agg={season} model={model} />}
      <StatTiles agg={season} pool={seasonPool} />
      {small && <RoleTrendCard agg={season} />}
      {!small && <MatchupCard agg={season} />}
      <div className="section-head">
        <h2 className="display section-title">Charts</h2>
        {toggle}
      </div>
      {chartCards}
      {small ? <MatchupCard agg={season} /> : <MatchupChartCard agg={season} />}
      <GameLog agg={season} />
      {toast}
    </Shell>
  )
}
