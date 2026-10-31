import type { Player } from './data/contract.ts'
import { slug } from './data/derive.ts'

// Routes key on player_id (gsis). The name slug is cosmetic and ignored on read.
export const playerPath = (p: Player) => `/player/${p.player_id}/${slug(p.name)}`
export const cardPath = (p: Player) => `/player/${p.player_id}/${slug(p.name)}/card`
export const comparePath = (a: Player, b?: Player) => `/compare/${a.player_id}${b ? `/${b.player_id}` : ''}`
export const positionPath = (pos: string) => `/${pos.toLowerCase()}`
