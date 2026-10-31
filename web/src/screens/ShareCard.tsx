import { useParams } from 'react-router'
import { ACCENT, ChartCard } from '../components/ChartCard.tsx'
import { Brand } from '../components/Shell.tsx'
import { useWidth } from '../charts/useWidth.ts'
import { CHARTS, TILES } from '../data/charts.ts'
import { useData } from '../data/DataContext.tsx'
import { METRICS, ordinal, rankOf } from '../data/derive.ts'
import { NotFound } from './NotFound.tsx'

// A 1200x630 card, scaled to fit the viewport. This is the layout for a link
// preview; generating the actual image belongs to the serve layer, since a
// static SPA cannot answer per-player og:image requests.
const W = 1200
const H = 630

export function ShareCard() {
  const { id = '' } = useParams()
  const { model, pool } = useData()
  const [ref, width] = useWidth<HTMLDivElement>(W)
  const player = model.playersById.get(id)
  if (!player) return <NotFound what="player" />
  const p = pool(player.position, 'season')
  const agg = p.byId.get(id)
  if (!agg) return <NotFound what="player" />
  const team = model.teamsByAbbr.get(player.team)
  const [k1, k0] = [TILES[player.position][1]!, TILES[player.position][0]!]
  const stat = (k: typeof k1) => {
    const v = METRICS[k].get(agg, model)
    const r = rankOf(p, model, k, id)
    return { v: v == null ? '—' : METRICS[k].format(v), r: r ? `, ${ordinal(r.rank)}` : '', label: METRICS[k].phrase }
  }
  const s1 = stat(k1)
  const s0 = stat(k0)
  // useWidth reads clientWidth, which includes the wrapper padding.
  const scale = Math.min(1, (width - 32) / W)

  return (
    <div className="share-wrap" ref={ref}>
      <div style={{ height: H * scale, overflow: 'hidden' }}>
        <div className="share-card" style={{ width: W, height: H, transform: `scale(${scale})` }}>
          <div className="share-left">
            <Brand />
            <div className="mono share-team">{player.position} · {team?.name.toUpperCase()}</div>
            <h1 className="display share-name">{player.name}</h1>
            <div className="share-stats">
              <div><div className="display accent">{s1.v}</div><div className="mono">{s1.label}{s1.r}</div></div>
              <div><div className="display">{s0.v}</div><div className="mono">{s0.label}{s0.r}</div></div>
            </div>
            <div className="mono share-foot">{model.data.meta.season} · through Week {model.data.meta.thru_week} · nflverse + Next Gen Stats</div>
          </div>
          <div className="share-right card">
            <h2 className="display">{CHARTS[player.position][0]!.title}</h2>
            <ChartCard chart={CHARTS[player.position][0]!} pool={p} highlights={[{ agg, color: ACCENT }]} bare noModeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}
