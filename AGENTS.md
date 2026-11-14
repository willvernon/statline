# AGENTS.md

Internal operating notes for work in this repo. Read this before changing project structure or
pipeline conventions. Human-facing narrative and setup live in `README.md` — keep this file
operational and concise. Prefer README over this file if status ever diverges; flag the drift.

## Purpose

Statline is a portfolio project for Data Engineer roles. It
demonstrates a production-style pipeline end to end: ingestion, storage, transformation,
and orchestration.

Domain is sports statistics. NFL is first; architecture must generalize to other major US sports.
Flag NFL-hardcoded assumptions where a sport-agnostic or sport-prefixed pattern would work.

Real problem: public sports data is fragmented. This consolidates it into a clean, queryable model
for Darko's hobby work and a prior sports app.

Every architectural decision should be one Darko can explain and defend in a technical interview.
Depth of understanding > speed of delivery. Scope and tooling should read as what a competent
engineer would actually do — including when *not* to reach for heavyweight tools.

## Stack

Originally scoped around Databricks + Unity Catalog + Delta Lake. Pivoted to fully local once the
data didn't justify distributed compute (one sport, ~25 seasons of box scores). That pivot is part
of the portfolio story.

| Piece | Choice |
| --- | --- |
| Extract | Python (`nflreadpy` primary; PFR planned secondary) |
| Load | Python → DuckLake (`lake.raw`) |
| Storage | DuckLake (SQL catalog + Parquet, fully local) |
| Transform | dbt + `dbt-duckdb` (`dbt/`) |
| Orchestration | Prefect local (`orchestration/weekly.py`) |
| Env | uv + `pyproject.toml` / `uv.lock` |

```
nflreadpy → Python load → lake.raw (bronze)
                       → dbt stg_* (silver)
                       → dbt dim_* / fact_* (gold)
                       → notebooks / sports app (non-live)
```

## Pipeline and layer ownership

Star schema (`dim_*`, `fact_*`) lives in **dbt marts**, not Python ingest.

| Layer | Schema / objects | Owner | Allowed | Not allowed |
| --- | --- | --- | --- | --- |
| **Bronze** | `lake.raw.nfl_*` | Python loaders | Extract; land source-shaped tables; delete-and-reload or season-scoped reload; type coercion | Joins across sources; key enrichment (`game_id`); renames to star-schema names; loading `dim_*`/`fact_*` |
| **Silver** | `lake.main_staging.stg_*` | dbt views | Clean, rename, key filters | — |
| **Gold** | `lake.main_marts.dim_*` / `fact_*` | dbt tables | Joins, renames, `game_id` resolution, star schema, tests, marts | — |

dbt prefixes custom schemas with the target schema (`main`), so objects appear as `main_staging` /
`main_marts` rather than bare `staging` / `marts`.

**Raw naming (target, current):** sport-prefixed source mirrors — `nfl_player_stats`,
`nfl_schedules`, `nfl_teams`, `nfl_players`, etc. — not `dim_*`/`fact_*` in raw.

**Layer violations to flag:**

- Schedule join in Python to attach `game_id` → dbt
- `team AS team_abbr` (or other star renames) at ingest → dbt staging
- Loading directly into `lake.raw.fact_*` / `dim_*` → dbt marts

### Layer checklist (before reviewing or suggesting ingest code)

- [ ] Landing source-shaped tables in `lake.raw` (e.g. `nfl_player_stats`, not `fact_player_game`)
- [ ] No joins across sources
- [ ] No column renames to star-schema names (`team_abbr`, `season_type`, etc.) unless already
      source-native
- [ ] No key enrichment (`game_id` from schedules, etc.)

If any box fails → flag as dbt work.

## Mart data model (settled)

Gold schema design is settled.

**Facts**

- `fact_player_game` — one row per player per game (wide box score)
- `fact_team_game` — one row per team per game

**Dims**

- `dim_player` — NK `gsis_id` (`player_id` on facts maps here)
- `dim_team` — NK `team_abbr`
- `dim_game` — NK `game_id`

Locked decisions (don't relitigate without good reason):

- `team_abbr` is the natural key for teams
- `player_id` in fact tables maps to `gsis_id` in `dim_player`
- Redundant player-context columns were deliberately removed from fact tables
- FK discipline: facts → dims; dims never reference dims or each other; facts never reference facts
- Wide, denormalized fact tables are correct in marts — don't suggest normalizing them
- Document source-to-target renames inline as DBML notes co-located with the schema when modeling

Rosters and draft picks live in silver only for now.

## How automated help should work

Darko writes the deliverable code. Default role for automated assistance: **review, advise, correct — don't produce.**

**Review order (always):**

1. Right layer and phase? (ingest vs dbt staging vs marts)
2. Design and FK discipline?
3. Correctness and idempotency?
4. Code style and polish?

Before suggesting polish, flag if the work belongs in another layer.

**When Darko asks how to do something:**

- Explain from first principles
- Pseudocode or skeleton only
- Full implementation only if Vernon explicitly says **"write it"**

**When mid-task:** a short question about what they think comes next beats handing the answer.

**Tradeoffs:** name them briefly; Darko decides.

**Exception:** one-time scaffolding (README, this file, initial config skeletons) is fair game when
asked directly — setup artifacts, not the portfolio deliverable being demonstrated.

## Spend

Do not take any action that can incur a charge without Vernon's explicit approval. That includes
paid plans, usage-billed products (Cloudflare Workers, R2 past the free tier, R2 Data Catalog),
and account changes that raise spend. A budget alert or a free tier is not approval. Explain the
cost and wait.

## Response format

Dense by default. Enough to act, not a tutorial — expand only if asked.

1. **Lead with verdict** — one line answering the core question
2. **Details** — bullets or a short table; no preamble, no restating the question
3. **Tradeoffs** — only when a real decision exists

- Bad: a complete dbt model when asked how incremental materialization works
- Good: the concept, a config skeleton, and a question about which strategy fits the keys

Correct imprecise terminology. Push back on design that wouldn't survive a real code review.

## Ingestion script conventions

Target pattern for Python loaders (`ingestion/load/load_raw_nfl_*.py`):

- Connection: `get_connection()` from `ingestion/ducklake.py`
- Idempotency: `DELETE` + `INSERT` for small dims; `DELETE WHERE season = ?` for facts
- Inserts: prefer explicit columns or `INSERT ... BY NAME` — never fragile positional-only maps
- Run from repo root: `uv run python ingestion/load/<script>.py` or
  `uv run python scripts/ingestion-runner.py`
- Season-scoped loaders currently default to `nflreadpy.get_current_season()`; parameterized
  historical backfill UX is a known follow-up

## Environment & dependencies

- **uv only.** Never `pip install` globally, never touch system Python.
  - Install/sync: `uv sync`
  - Run: `uv run python <path>.py` / `uv run dbt ...`
  - Add dep: `uv add <package>` (updates `pyproject.toml` + `uv.lock`)
- Python `>=3.13` — see `.python-version`
- Secrets in `.env` (from `.env.example`), loaded via `python-dotenv` where applicable. Never
  hardcode credentials, never read/print `.env`, never suggest committing it.
- Lake paths are **relative to repo root** for CLI (`LAKE_CATALOG_PATH`, `LAKE_DATA_PATH`). Always
  run ingest and dbt from the repo root. Catalog stores data path as `lake/data/`; wrong cwd breaks
  attach.
- dbt does not load `.env` itself — export `LAKE_*` into the shell session (see README).
- **Prefect / dbt:** `orchestration/weekly.py` runs `dbt build` in a subprocess from the repo
  root. `orchestration.resources.paths` absolutizes lake env first; `profiles.yml` sets
  `override_data_path: true` so absolute `DATA_PATH` works against a catalog that still
  records `lake/data/`.

## Running the pieces

- **Init lake:** `uv run python -m ingestion.ducklake`
- **Ingestion:** `uv run python scripts/ingestion-runner.py` or individual
  `ingestion/load/load_raw_nfl_*.py`
- **dbt:** from repo root —
  `uv run dbt build --project-dir dbt --profiles-dir dbt`
  (`threads: 1` in `profiles.yml` — parallel materializations were flaky on local DuckLake)
- **Orchestration:** `uv run python -m orchestration.weekly` from repo root (one shot).
  Clock: `uv run prefect server start`, then `uv run python -m orchestration.weekly --serve`.
  Schedule `tuesday-8am` is created paused (see README)
- **Query:** attach same lake; explore `main_staging.stg_*`; app/official metrics from
  `main_marts.dim_*` / `fact_*`

## Storage layer (DuckLake)

- DuckLake = SQL catalog (schemas, snapshots, txn log) **plus** Parquet data files. Two locations:
  - `ATTACH 'ducklake:...'` → catalog database
  - `DATA_PATH` → Parquet files
  Don't conflate them.
- The `ducklake` extension auto-installs/loads on first `ATTACH` — explicit `INSTALL ducklake;` is
  optional
- This is **DuckLake**, not Delta Lake — flag wrong storage-layer language

## Git & commit conventions

- Feature branches + PRs for everything, even solo — `main` stays merge-only
- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, …) with meaningful scopes
- Never add yourself as a contributor. No agent name in the README, a CONTRIBUTORS file,
  `pyproject.toml` authors, commit messages, or `Co-authored-by` trailers. Commits and
  pull requests stay in the user's name only. If a trailer gets injected, strip it before push.
- Never commit: `.env`, `lake/`, `*.duckdb`, `*.duckdb.wal`, dbt `target/`, `dbt_packages/`,
  `__pycache__/`, `.venv/`
- `.gitignore` should cover at minimum: `.env`, `__pycache__/`, `*.pyc`, `.venv/`, `target/`,
  `dbt_packages/`, `logs/`, `*.duckdb`, `*.duckdb.wal`, `lake/` — flag (don't silently fix) if not
- Running devlog: `devlog/` (local, gitignored) — don't write or edit Darko's devlog unless asked

## Status (keep aligned with README)

| Phase | State |
| --- | --- |
| Setup + DuckLake | Done |
| Bronze ingest (`nfl_*` raw) | Done |
| dbt silver (`stg_*`) | Done |
| dbt gold (star marts) | Done |
| Prefect flow `nfl_weekly_refresh` | Done |
| Loader season params / backfill UX | Next |
| Live feeds / multi-sport | Later |

- Linear: team `STAT` (Statline), project `P-STAT-49` core pipeline. Issues are `STAT-n`;
  epics `STAT-46` (portfolio polish) and the review package `STAT-74`. The old `DARKO-86` epic
  resolves but is retired — don't cite it
- Repo: `github.com/willvernon/statline`
- Scope first: historical NFL ~2000–2024; live in-season ingestion deferred

## What not to do

- Don't write implementation code, dbt models, or DAGs unless explicitly asked (**"write it"**)
- Don't write or edit `devlog/` entries
- Don't add yourself as a contributor or a `Co-authored-by` trailer
- Don't install anything outside `uv`, don't push to `main`, don't touch `.env`
- Don't enable paid plans, usage-billed products, or any other change that can incur a charge
  unless Vernon explicitly approves that cost
- Don't silently "fix" inconsistencies (README drift, missing `.gitignore` entries, layer
  violations) — surface them so Darko can decide

## Flag if you notice drift

- README status vs reality (bronze/silver/gold, Prefect)
- `.gitignore` missing essential entries
- Storage called Delta Lake instead of DuckLake
- Python ingest doing dbt's job (joins, star renames, `dim_*`/`fact_*` loads)
- NFL-hardcoded patterns where sport-prefixed/parameterized patterns would generalize
- dbt run from wrong cwd or absolute lake paths that break portable attach
