# Statline

Local NFL lakehouse. Public box scores, schedules, rosters, and draft picks land in DuckLake, dbt cleans and tests them, and a Prefect flow runs that path from bronze to silver to gold. Gold is a star schema for analysis and a downstream sports app.

Each NFL week that same public data was being extracted and reshaped again. Statline keeps one queryable model, and it is the walkthrough for Data Engineer roles in Indianapolis, Chicago, and Austin. The original scope was Databricks, Unity Catalog, and Delta. One sport and about 25 seasons of box scores do not need distributed compute, so the stack is local.

**Built:** bronze ingest, silver staging, gold marts, local Prefect flow `nfl_weekly_refresh`.
**Ahead:** live game feeds, multi-sport ([map](docs/multi-sport-data.md)), a one-command 2000–2024 backfill.

A fresh clone loads the current season. Older seasons are one year per command.

## Flow

```
nflreadpy → Python load → lake.raw (bronze)
                       → dbt stg_* (silver)
                       → dbt dim_* / fact_* (gold)
                       → notebooks / sports app

Prefect flow nfl_weekly_refresh:
  seven bronze loaders → dbt build (silver + gold)
```

| Piece | Choice |
| --- | --- |
| Extract | Python + `nflreadpy` |
| Load | Python → DuckLake (`lake.raw`) |
| Storage | DuckLake (SQL catalog + Parquet) |
| Transform | dbt + `dbt-duckdb` |
| Orchestration | Prefect (local flow + paused schedule) |
| Env | `uv` + `pyproject.toml` |

```
ingestion/          DuckLake connect + raw loaders (load/, schemas/)
orchestration/      weekly.py — nfl_weekly_refresh; resources/ normalizes lake paths
scripts/            setup.py, ingestion_runner.py
cli/                Go: COPY one gold mart to parquet
statline_dbt/       dbt staging + marts
docs/               design notes
lake/               local catalog + parquet (gitignored)
notebooks/          exploration, not the pipeline
```

## Set up

Python ≥ 3.13 and [uv](https://docs.astral.sh/uv/getting-started/installation/). [Go 1.27.1](https://go.dev/dl/) matches `go.work` and is only for parquet export. The [DuckDB CLI](https://duckdb.org/install/) is for ad-hoc queries. Bootstrap needs uv. If uv is missing, `scripts/setup.py` exits and prints these links.

From the repository root:

```bash
git clone https://github.com/willvernon/statline.git
cd statline
uv run python scripts/setup.py
```

The bootstrap copies `.env` from `.env.example` when `.env` is missing, initializes DuckLake, loads current-season bronze, and runs `dbt build`. It exports the lake paths for that build.

Run ingest, dbt, Prefect, and the Go CLI from the repository root. Python loaders and the weekly flow read `.env`. Keep the paths relative to that root:

```bash
LAKE_CATALOG_PATH=lake/metadata.ducklake
LAKE_DATA_PATH=lake/data
```

A hand-run `dbt` needs those paths in the environment. Bash:

```bash
set -a && source .env && set +a
```

Nushell:

```nushell
$env.LAKE_CATALOG_PATH = "lake/metadata.ducklake"
$env.LAKE_DATA_PATH = "lake/data"
```

Fish:

```fish
set -x LAKE_CATALOG_PATH lake/metadata.ducklake
set -x LAKE_DATA_PATH lake/data
```

Without the bootstrap: `uv sync`, `cp .env.example .env`, then initialize, load, and build under Run.

## Run

Weekly flow, current season. A failed loader stops the flow before `dbt build`.

```bash
uv run python -m orchestration.weekly
```

One year. Teams and players stay full snapshots. The year reloads stats, schedules, rosters, and draft.

```bash
uv run python -m orchestration.weekly 2024
```

Clock. Deployment `nfl_weekly_refresh`. Schedule `tuesday-8am` is created paused: Tuesday 08:00 America/Indiana/Indianapolis. Start the server and the runner in two terminals, open http://127.0.0.1:4200, and unpause `tuesday-8am` when Tuesday runs are required. A run fires only while the `--serve` process is up.

```bash
uv run prefect server start
uv run python -m orchestration.weekly --serve
```

The flow makes lake paths absolute before `dbt build`. `profiles.yml` sets `override_data_path`, so parquet stays under `lake/`.

One season of bronze, then silver and gold. `dbt build` runs the `unique` and `not_null` key tests in `statline_dbt/models/*/schema.yml`. Export the lake paths first.

```bash
uv run python -m ingestion.ducklake
uv run python scripts/ingestion_runner.py            # current season
uv run python scripts/ingestion_runner.py 2024       # one season
uv run python ingestion/load/load_raw_nfl_teams.py   # one table; current season
uv run dbt debug --project-dir statline_dbt --profiles-dir statline_dbt
uv run dbt build --project-dir statline_dbt --profiles-dir statline_dbt
```

Individual loaders have no year flag.

Export one gold mart that already exists. `-dataMart`: `fact_player_game` (default), `fact_team_game`, `dim_player`, `dim_team`, `dim_game`. `-dest` is a `.parquet` file. Use `$HOME` or an absolute path.

```bash
go run ./cli -dataMart fact_player_game -dest "$HOME/Downloads/fact_player_game.parquet"
```

```bash
go build -o statline-export ./cli
./statline-export -dataMart dim_team -dest "$HOME/Downloads/dim_team.parquet"
```

Nushell dest: `($env.HOME | path join "Downloads" "fact_player_game.parquet")`

Query the same lake from the DuckDB CLI, a notebook, or the app.

- Exploration: `main_staging.stg_*`
- App and shared metrics: `main_marts.dim_*` / `fact_*`

## Model

dbt prefixes custom schemas with the target schema (`main`), so the names in the lake are `main_staging` and `main_marts`.

| Layer | Schema / objects | Owner |
| --- | --- | --- |
| Bronze | `lake.raw.nfl_*` | Python loaders. Source-shaped. No star renames. |
| Silver | `lake.main_staging.stg_*` | dbt views. Clean, rename, key filters. |
| Gold | `lake.main_marts.dim_*` / `fact_*` | dbt tables. Star schema for the app and shared metrics. |

Facts:

- `fact_player_game`: one row per player per game (wide box score)
- `fact_team_game`: one row per team per game

Dimensions:

- `dim_player`: natural key `gsis_id`. `player_id` on facts maps here.
- `dim_team`: natural key `team_abbr`
- `dim_game`: natural key `game_id`

Rosters and draft picks stay in silver.

## Limits

- There is no 2000–2024 loop.
- `statline_dbt/profiles.yml` sets `threads: 1`. Parallel materializations were flaky on local DuckLake.
- Python dependencies come from uv (`uv sync`, `uv run`).
- Feature branches and pull requests, including solo work. `main` stays merge-only.
- Do not commit `.env`, `lake/`, `*.duckdb`, dbt `target/`, `.dagster_home/`, or `.prefect/`.

## Troubleshooting

`Failed to spawn: prefect` (or `dbt`) after moving the repo. The scripts in `.venv/bin` keep the old absolute path to Python. Rebuild them.

```bash
uv sync --reinstall
```

`401 Unauthorized` from `api.prefect.cloud` on `--serve`. The active Prefect profile points at Prefect Cloud. Profiles live in `~/.prefect/profiles.toml`, per user, not per repo. Point one at the local server.

```bash
uv run prefect profile create local
uv run prefect profile use local
uv run prefect config set PREFECT_API_URL=http://127.0.0.1:4200/api
uv run prefect config view    # PREFECT_API_URL should be the local server
```
