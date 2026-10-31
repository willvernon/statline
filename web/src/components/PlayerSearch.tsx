import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Player, Position } from '../data/contract.ts'
import { useData } from '../data/DataContext.tsx'
import { playerPath } from '../paths.ts'
import { Icon } from './Icon.tsx'

interface Props {
  placeholder?: string
  position?: Position
  exclude?: string
  onPick?: (p: Player) => void
  autoFocus?: boolean
}

export function PlayerSearch({ placeholder = 'Name or team', position, exclude, onPick, autoFocus }: Props) {
  const { model } = useData()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const teamHit = (p: Player) => p.team.toLowerCase() === term || model.teamsByAbbr.get(p.team)?.name.toLowerCase().includes(term)
    return model.data.players
      .filter((p) => (!position || p.position === position) && p.player_id !== exclude && model.rowsByPlayer.has(p.player_id))
      .filter((p) => p.name.toLowerCase().includes(term) || teamHit(p))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(term)) - Number(a.name.toLowerCase().startsWith(term)) || a.name.localeCompare(b.name))
      .slice(0, 8)
  }, [q, model, position, exclude])

  const pick = (p: Player) => {
    setQ('')
    if (onPick) onPick(p)
    else navigate(playerPath(p))
  }

  return (
    <div className="search">
      <span className="search-icon"><Icon name="search" size={18} /></span>
      <input
        type="search"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && results[active]) pick(results[active])
          else if (e.key === 'Escape') setQ('')
          else return
          e.preventDefault()
        }}
      />
      {results.length > 0 && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((p, i) => (
            <li key={p.player_id} role="option" aria-selected={i === active}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)} onMouseEnter={() => setActive(i)}>
                <span className="search-name">{p.name}</span>
                <span className="search-meta mono">{p.position} · {p.team}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
