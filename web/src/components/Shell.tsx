import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router'
import { useData } from '../data/DataContext.tsx'
import { positionPath } from '../paths.ts'
import type { Position } from '../data/contract.ts'
import type { Agg } from '../data/derive.ts'
import { HowSheet } from './HowSheet.tsx'
import { Icon } from './Icon.tsx'
import { PlayerSearch } from './PlayerSearch.tsx'
import { DESKTOP, useMedia } from './useMedia.ts'

const TABS = ['QB', 'RB', 'WR', 'TE', 'Teams'] as const

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Statline home">
      <span className="brand-mark" />
      STATLINE
    </Link>
  )
}

export function ThroughWeek() {
  const { meta } = useData().model.data
  return <span className="pill-dark mono">Through week {meta.thru_week}</span>
}

export function Freshness() {
  const { meta } = useData().model.data
  return (
    <div className="freshness">
      <ThroughWeek />
      <span className="mono muted-2">
        Week {meta.thru_week + 1}: {meta.next_week_games_final} of {meta.next_week_games_total} games final
      </span>
    </div>
  )
}

export function PositionTabs({ className = '', current }: { className?: string; current?: string }) {
  return (
    <nav className={`tabs ${className}`} aria-label="Positions">
      {TABS.map((t) => (
        <NavLink key={t} to={positionPath(t)} className={({ isActive }) => `tab mono${isActive || t === current ? ' active' : ''}`}>
          {t}
        </NavLink>
      ))}
    </nav>
  )
}

function MockBanner() {
  const { meta } = useData().model.data
  if (meta.source !== 'mock') return null
  return (
    <div className="mock-banner mono" role="note">
      Mock data. Numbers are generated fixtures, not real {meta.season} stats.
    </div>
  )
}

interface Props {
  children: ReactNode
  /** Mobile header: "detail" shows back, centered brand and actions. */
  variant?: 'home' | 'detail'
  onShare?: () => void
  /** Context for the "how this chart is built" sheet. */
  position?: Position
  example?: Agg
}

export function Shell({ children, variant = 'home', onShare, position, example }: Props) {
  const desktop = useMedia(DESKTOP)
  const navigate = useNavigate()
  const [searching, setSearching] = useState(false)

  return (
    <div className="app">
      <MockBanner />
      {desktop ? (
        <header className="topbar desktop">
          <Brand />
          <PositionTabs className="tabs-inline" current={position} />
          <div className="topbar-right">
            <div className="topbar-search"><PlayerSearch placeholder="Search players" /></div>
            <ThroughWeek />
          </div>
        </header>
      ) : variant === 'detail' ? (
        <header className="topbar detail">
          <button className="icon-btn" aria-label="Back" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/'))}>
            <Icon name="back" />
          </button>
          <Brand />
          <div className="topbar-actions">
            <button className="icon-btn" aria-label="Search players" onClick={() => setSearching((s) => !s)}>
              <Icon name="search" />
            </button>
            {onShare && (
              <button className="icon-btn" aria-label="Share" onClick={onShare}>
                <Icon name="share" />
              </button>
            )}
          </div>
        </header>
      ) : (
        <header className="topbar home">
          <Brand />
          <ThroughWeek />
        </header>
      )}
      {searching && !desktop && (
        <div className="search-drop">
          <PlayerSearch placeholder="Search players" autoFocus />
        </div>
      )}
      <main className="page">{children}</main>
      <Footer />
      <HowSheet position={position} example={example} />
    </div>
  )
}

function Footer() {
  const [, setParams] = useSearchParams()
  const { sources } = useData().model.data.meta
  const feeds = ['nflverse player stats', sources.pbp && 'play-by-play', sources.ngs && 'NFL Next Gen Stats'].filter(Boolean).join(', ')
  return (
    <footer className="footer">
      <button className="howlink" onClick={() => setParams((p) => (p.set('how', 'pipeline'), p))}>
        <span>How these charts are built</span>
        <Icon name="arrow" />
      </button>
      <p className="mono">
        Data: {feeds}. Refreshed once every game in a week is final.
      </p>
      <p className="mono">
        Built on Statline. Pipeline and data model hand-built; interface built with AI.{' '}
        <button className="howlink-inline" onClick={() => setParams((p) => (p.set('how', 'pipeline'), p))}>How these charts are built</button>
      </p>
    </footer>
  )
}

export function useShare() {
  const [toast, setToast] = useState<string | null>(null)
  const share = async (title: string, url = location.href) => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setToast('Link copied')
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setToast('Copy failed. Use the address bar.')
    }
    setTimeout(() => setToast(null), 2200)
  }
  const node = toast ? <div className="toast" role="status">{toast}</div> : null
  return { share, toast: node }
}
