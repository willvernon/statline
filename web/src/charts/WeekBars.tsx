export interface WeekBar {
  week: number
  /** Null = team bye. Zero = on the schedule, no snaps or points. */
  value: number | null
  sub?: string
}

interface Props {
  bars: WeekBar[]
  color: string
  format: (v: number) => string
  height?: number
  /** Fixed ceiling so two series share a scale. */
  max?: number
  ariaLabel: string
  /** Week label under each bar; off when the caller prints its own. */
  showWeek?: boolean
}

export function WeekBars({ bars, color, format, height = 150, max, ariaLabel, showWeek = true }: Props) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value ?? 0))
  return (
    <div className="weekbars" role="img" aria-label={ariaLabel} style={{ ['--bar' as string]: color }}>
      {bars.map((b) => (
        <div key={b.week} className="weekbar" title={b.value == null ? `Week ${b.week}: bye` : `Week ${b.week}: ${format(b.value)}`}>
          <div className="weekbar-track" style={{ height }}>
            {b.value == null ? (
              <span className="weekbar-value muted">Bye</span>
            ) : b.value === 0 ? (
              <>
                <span className="weekbar-value muted">0</span>
                <div className="weekbar-zero" />
              </>
            ) : (
              <>
                <span className="weekbar-value">{format(b.value)}</span>
                <div className="weekbar-fill" style={{ height: `max(3px, calc(${b.value / top} * (100% - 22px)))` }} />
              </>
            )}
          </div>
          {showWeek && <div className="weekbar-label">W{b.week}{b.sub ? ` · ${b.sub}` : ''}</div>}
        </div>
      ))}
    </div>
  )
}
