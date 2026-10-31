# Statline web

Mobile-first frontend for the fantasy marts. React + TypeScript on Bun, which installs packages, runs the dev server and bundles the build. The charts are hand-rolled SVG with no chart library. The app reads six static JSON files and does no other I/O.

```bash
cd web
bun install
bun run dev          # http://localhost:5173, hot reload, mock data
bun run build        # typecheck + production bundle in dist/
bun run preview      # serve dist/ locally
bun run fixtures     # regenerate public/data/mock (seeded, stable)
```

`server.ts` is the local server for both `dev` and `preview`. It serves `public/data` and `public/fonts` from disk and falls back to `index.html` for client routes. Set `PORT` to change the port.

## Wiring real data

Set `PUBLIC_DATA_BASE` (see `.env.example`) to a folder or URL that holds these files. Bun inlines `PUBLIC_*` variables into the browser bundle at build time (`bunfig.toml` for dev, `--env` in the build script), so restart `dev` or rebuild after changing it. Each file is a JSON array of row objects, except `meta.json`. The field-level contract is `src/data/contract.ts`.

| File | Grain | Source in the plan |
| --- | --- | --- |
| `meta.json` | one object | `int_complete_weeks` (thru_week), qualifier lines, separation fit |
| `teams.json` | team_abbr | `dim_team` + a color column |
| `players.json` | player_id (gsis) | `dim_player`, position and team as of thru_week |
| `schedule.json` | game_id | `dim_game`, including the next week (spread, total, kickoff) |
| `player_games.json` | player_id × game_id | `mart_fantasy_player_game` |
| `team_games.json` | team × game_id | `mart_fantasy_team_defense_game` (Group B) + team EPA sums |

DuckDB can write these directly, e.g. `COPY (select * from main_marts.mart_fantasy_player_game where season = 2026) TO 'player_games.json' (FORMAT JSON, ARRAY true)`.

What the UI assumes:

- Rows carry only additive measures. Shares, per-game rates, EPA per target, separation and snap share are all computed in the browser as sum / sum over the selected window ("Season" or "Last 4" team games).
- Snaps are counts (`offense_snaps`, `team_offense_snaps`), not `snap_pct`. The plan lists `snap_pct`, but a percentage can't be summed across a window.
- Only weeks `<= meta.thru_week` are present in the two game-grain files.
- Optional fields (`epa_*`, `dropbacks`, `ngs_*`, team `off_*`/`def_*`) come from play-by-play and Next Gen Stats, which aren't loaded yet. `meta.sources.pbp` / `meta.sources.ngs` say which sources are loaded. Charts that need a missing source show "Not available yet" and the rest still work. Ship `{ "pbp": false, "ngs": false }` until those loaders exist.
- Once play-by-play is loaded, coalesce EPA fields to 0 in dbt. NGS is the exception: nflverse skips low-volume player-weeks, so null NGS rows are normal. The UI sums separation over the weeks NGS covers.
- Separation is stored as `ngs_separation_x_targets` (avg separation × NGS targets) so that it sums. `meta.separation_fit` holds the intercept and slope from the dbt fit across qualified WRs and TEs. The UI never refits.
- Routes use the History API. Whatever serves `dist/` needs an `index.html` fallback for unknown paths, or deep links like `/player/…` will 404. `bun run dev` and `bun run preview` handle this already.

## Screens

| Route | Screen |
| --- | --- |
| `/wr`, `/rb`, `/qb`, `/te` | Position explorer: quadrant chart, tap a dot, quadrant leaderboard |
| `/teams` | Offense vs defense EPA, team rankings incl. PPR allowed by position |
| `/player/:gsis/:slug` | Player page: tiles, next matchup, charts, game log (small-sample variant below the qualifier) |
| `/compare/:a/:b` | Start or sit: edge counts, metric rows, both charts, weekly PPR |
| `/player/:gsis/:slug/card` | 1200×630 share card layout |
| `?how=<chart>` / `?how=pipeline` | "How this chart is built" sheet |

The WR charts follow the design. The QB, RB and TE axes and qualifier lines in `src/data/charts.ts` and `meta.qualifiers` are first guesses.

## Layout

```
src/data/contract.ts   file shapes (the pipeline boundary)
src/data/derive.ts     window aggregation, metrics, ranks, matchups
src/data/charts.ts     per-position chart definitions
src/charts/            SVG scatter, week bars
src/components/        shell, search, cards, how-it's-built sheet
src/screens/           routes
scripts/make-fixtures.ts  mock data generator
```
