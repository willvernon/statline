// Placeholder team badges in public/logos: the team abbreviation on its primary
// color. Original artwork, so it can ship anywhere. Real logos replace these by
// dropping files with the same names in, or by setting `logo` in teams.json.
// Run: bun run logos

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Team } from '../src/data/contract.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'public', 'logos')
const teams = JSON.parse(readFileSync(join(here, '..', 'public', 'data', 'mock', 'teams.json'), 'utf8')) as Team[]

/** Relative luminance, to pick white or near-black text on the team color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}

mkdirSync(OUT, { recursive: true })
for (const t of teams) {
  const ink = luminance(t.color) > 0.4 ? '#141413' : '#ffffff'
  const size = t.team.length > 2 ? 23 : 28
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="31" fill="${t.color}"/>
  <circle cx="32" cy="32" r="27.5" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="2"/>
  <text x="32" y="${32 + size * 0.36}" text-anchor="middle" font-family="'Arial Narrow', 'Helvetica Neue', Arial, sans-serif" font-weight="800" font-size="${size}" letter-spacing="-0.5" fill="${ink}">${t.team}</text>
</svg>
`
  writeFileSync(join(OUT, `${t.team}.svg`), svg)
}
console.log(`wrote ${teams.length} badges to public/logos`)
