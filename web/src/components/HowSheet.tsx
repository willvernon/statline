import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { CHARTS } from '../data/charts.ts'
import type { Position } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import { METRICS, lastName, minus, type Agg } from '../data/derive.ts'
import { Icon } from './Icon.tsx'

const REPO = 'https://github.com/willvernon/statline/tree/main/statline_dbt/models/marts'

// Target state from the fantasy marts plan. Steps not built yet say so.
const lineage = (pbp: boolean, ngs: boolean) => [
  {
    layer: 'Source',
    name: ['nflverse', ngs && 'NGS'].filter(Boolean).join(' + '),
    note: ['Weekly player stats', pbp && 'play-by-play', ngs && 'Next Gen Stats'].filter(Boolean).join(', '),
  },
  { layer: 'Bronze', name: 'DuckLake lake.raw.nfl_*', note: 'Source-shaped tables, season-scoped reloads' },
  { layer: 'Silver', name: 'dbt stg_nfl_*', note: 'Typed, deduped, keyed on gsis_id and team_abbr' },
  { layer: 'Gold', name: 'fact_player_game', note: 'One row per player per game', hot: true },
  { layer: 'Mart', name: 'mart_fantasy_player_game', note: 'Additive measures only: targets, team targets, air yards, EPA sums', hot: true },
  { layer: 'Serve', name: 'Static JSON (planned)', note: 'Versioned files, published after dbt tests pass' },
  { layer: 'You', name: 'This page', note: 'Ratios computed from sums, plotted on your phone' },
]

export function HowSheet({ position, example }: { position?: Position; example?: Agg }) {
  const [params, setParams] = useSearchParams()
  const how = params.get('how')
  const ref = useRef<HTMLDialogElement>(null)
  const { model, pool } = useData()
  const { meta } = model.data

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (how && !d.open) d.showModal()
    if (!how && d.open) d.close()
  }, [how])

  const close = () => setParams((p) => (p.delete('how'), p), { replace: true })
  const pos = position ?? 'WR'
  const chart = how && how !== 'pipeline' ? CHARTS[pos].find((c) => c.id === how) : undefined
  const q = meta.qualifiers[pos]
  const plotted = pool(pos, 'season').qualified.length
  const fit = meta.separation_fit

  let example_line: string | null = null
  if (chart?.how.formula === 'sep_oe' && fit && example) {
    const sep = METRICS.sep.get(example, model)
    const adot = METRICS.adot.get(example, model)
    if (sep != null && adot != null) {
      const exp = fit.intercept + fit.slope * adot
      example_line = `${lastName(example.player.name)}: ${sep.toFixed(2)} yd at a ${adot.toFixed(1)} aDOT, ${exp.toFixed(2)} expected, so ${minus((sep - exp).toFixed(2))}.`
    }
  }

  return (
    <dialog ref={ref} className="sheet" onClose={close} onClick={(e) => e.target === e.currentTarget && close()} aria-labelledby="how-title">
      {how && (
        <div className="sheet-body">
          <div className="sheet-grip" />
          <div className="sheet-head">
            <div>
              <div className="eyebrow mono">{chart ? 'How this chart is built' : 'How these charts are built'}</div>
              <h2 id="how-title" className="display">{chart ? chart.title : 'Where the numbers come from'}</h2>
            </div>
            <button className="icon-btn round" aria-label="Close" onClick={close}><Icon name="close" /></button>
          </div>

          {chart && (
            <>
              <h3>Across: {METRICS[chart.x].phrase}</h3>
              <p>{chart.how.across}</p>
              {chart.how.formula === 'sep_oe' && fit && (
                <>
                  <pre className="formula">{`sep_oe = separation\n  ${minus('-')} (${fit.intercept.toFixed(2)} ${fit.slope < 0 ? '−' : '+'} ${Math.abs(fit.slope).toFixed(3)} × aDOT)`}</pre>
                  <p className="mono small muted-2">
                    Fit across {fit.n} qualified WRs and TEs this season.{example_line ? ` ${example_line}` : ''}
                  </p>
                </>
              )}
              <h3>Up: {METRICS[chart.y].phrase}</h3>
              <p>{chart.how.up}</p>
              <div className="legend-cards">
                <div className="legend-card">
                  <div className="eyebrow mono"><span className="dot-key" /> Plotted</div>
                  <p>{q.per_team_game}+ {q.stat} per team game. {plotted} {pos}s this week.</p>
                </div>
                <div className="legend-card">
                  <div className="eyebrow mono"><span className="dot-key hollow" /> Hollow</div>
                  <p>Below the line. Shown when selected, left out of averages and the fit.</p>
                </div>
              </div>
            </>
          )}

          <div className="fresh-block">
            <div className="eyebrow mono">Freshness</div>
            <strong>Through Week {meta.thru_week}</strong>
            <p>
              Week {meta.thru_week + 1} has {meta.next_week_games_final} of {meta.next_week_games_total} games final. A week
              publishes only once every game is final, so numbers never mix complete and partial weeks.
            </p>
          </div>

          <h3>Where the numbers come from</h3>
          <ol className="lineage">
            {lineage(meta.sources.pbp, meta.sources.ngs).map((s) => (
              <li key={s.layer} className={s.hot ? 'hot' : ''}>
                <span className="mono lineage-layer">{s.layer}</span>
                <div>
                  <code>{s.name}</code>
                  <p>{s.note}</p>
                </div>
              </li>
            ))}
          </ol>
          <a className="btn-outline" href={REPO} target="_blank" rel="noreferrer">View the dbt models</a>
        </div>
      )}
    </dialog>
  )
}
