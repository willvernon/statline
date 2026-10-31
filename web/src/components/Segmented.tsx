interface Props<T extends string> {
  value: T
  onChange: (v: T) => void
  options: [T, string][]
  label: string
  variant?: 'pill' | 'chip'
}

export function Segmented<T extends string>({ value, onChange, options, label, variant = 'pill' }: Props<T>) {
  return (
    <div className={`segmented ${variant}`} role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {text}
        </button>
      ))}
    </div>
  )
}
