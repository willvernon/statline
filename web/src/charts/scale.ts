export interface Scale {
  (v: number): number
  domain: [number, number]
  ticks: number[]
}

/** Round tick steps (1, 2, 2.5, 5 x 10^k) aiming for about `count` ticks. */
export function niceStep(span: number, count: number): number {
  const raw = span / Math.max(1, count)
  const pow = 10 ** Math.floor(Math.log10(raw))
  const n = raw / pow
  const m = n <= 1.5 ? 1 : n <= 2.25 ? 2 : n <= 3.5 ? 2.5 : n <= 7 ? 5 : 10
  return m * pow
}

export function linear(values: number[], range: [number, number], opts: { pad?: number; ticks?: number } = {}): Scale {
  const pad = opts.pad ?? 0.07
  let lo = Math.min(...values)
  let hi = Math.max(...values)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) [lo, hi] = [0, 1]
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1]
  const span = hi - lo
  lo -= span * pad
  hi += span * pad
  const step = niceStep(hi - lo, opts.ticks ?? 4)
  const ticks: number[] = []
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t / step) * step)
  const [r0, r1] = range
  const s = ((v: number) => r0 + ((v - lo) / (hi - lo)) * (r1 - r0)) as Scale
  s.domain = [lo, hi]
  s.ticks = ticks
  return s
}
