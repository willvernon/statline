import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Dataset } from './contract.ts'
import { buildModel, pool, type Model, type Pool, type Window } from './derive.ts'
import type { Position } from './contract.ts'

const BASE = (import.meta.env.VITE_DATA_BASE as string | undefined)?.replace(/\/$/, '') ?? '/data/mock'

async function load(): Promise<Dataset> {
  const get = async <T,>(name: string): Promise<T> => {
    const res = await fetch(`${BASE}/${name}`)
    if (!res.ok) throw new Error(`${name}: ${res.status} ${res.statusText}`)
    return res.json() as Promise<T>
  }
  const [meta, teams, players, schedule, playerGames, teamGames] = await Promise.all([
    get<Dataset['meta']>('meta.json'),
    get<Dataset['teams']>('teams.json'),
    get<Dataset['players']>('players.json'),
    get<Dataset['schedule']>('schedule.json'),
    get<Dataset['playerGames']>('player_games.json'),
    get<Dataset['teamGames']>('team_games.json'),
  ])
  return { meta, teams, players, schedule, playerGames, teamGames }
}

interface Ctx {
  model: Model
  pool: (position: Position, w: Window) => Pool
}

const DataCtx = createContext<Ctx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ data?: Dataset; error?: string }>({})

  useEffect(() => {
    load().then(
      (data) => setState({ data }),
      (e: unknown) => setState({ error: e instanceof Error ? e.message : String(e) }),
    )
  }, [])

  const ctx = useMemo<Ctx | null>(() => {
    if (!state.data) return null
    const model = buildModel(state.data)
    const cache = new Map<string, Pool>()
    return {
      model,
      pool: (position, w) => {
        const key = `${position}:${w}`
        let p = cache.get(key)
        if (!p) cache.set(key, (p = pool(model, position, w)))
        return p
      },
    }
  }, [state.data])

  if (state.error) {
    return (
      <div className="boot">
        <p className="boot-title">Couldn't load data</p>
        <p className="mono">{state.error}</p>
        <p className="muted">Looking in <code>{BASE}</code>. Set <code>VITE_DATA_BASE</code> to the folder with the exported JSON.</p>
      </div>
    )
  }
  if (!ctx) return <div className="boot" aria-busy="true"><span className="brand-mark" /> Loading</div>
  return <DataCtx.Provider value={ctx}>{children}</DataCtx.Provider>
}

export function useData(): Ctx {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData outside DataProvider')
  return c
}
