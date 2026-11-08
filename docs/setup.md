# Setup

## Prerequisites

| Tool | Needed for | Get it |
| --- | --- | --- |
| Python ≥ 3.13 | everything | managed by uv (`.python-version`) |
| uv | everything | [install](https://docs.astral.sh/uv/getting-started/installation/) |
| Go 1.27.1 | Parquet export CLI only | [download](https://go.dev/dl/) |
| DuckDB CLI | ad-hoc queries only | [install](https://duckdb.org/install/) |

## What `scripts/setup.py` does

| Step | Command it runs |
| --- | --- |
| 1. Check uv, warn about optional tools | — |
| 2. Copy `.env.example` → `.env` if missing | — |
| 3. Create the DuckLake catalog + raw tables | `uv run python -m ingestion.ducklake` |
| 4. Load the current season into bronze | `uv run python -m scripts.ingestion_runner` |
| 5. Build silver + gold, run tests | `uv run dbt build --project-dir dbt --profiles-dir dbt` |

Without it: `uv sync`, `cp .env.example .env`, then steps 3–5.

## Environment

| Variable | Default | Used by |
| --- | --- | --- |
| `LAKE_CATALOG_PATH` | `lake/metadata.ducklake` | loaders, dbt, CLI |
| `LAKE_DATA_PATH` | `lake/data` | loaders, dbt, CLI |
| `SENTRY_DSN` | empty = Sentry off | pipeline |
| `SENTRY_ENVIRONMENT` | `development` | pipeline |

Python reads `.env` itself. **dbt doesn't**, so export `LAKE_*` before a hand-run `dbt`:

```bash
set -a && source .env && set +a                 # bash / zsh
```

```nushell
$env.LAKE_CATALOG_PATH = "lake/metadata.ducklake"  # nushell
$env.LAKE_DATA_PATH = "lake/data"
```

```fish
set -x LAKE_CATALOG_PATH lake/metadata.ducklake  # fish
set -x LAKE_DATA_PATH lake/data
```

Paths stay relative to the repo root, so always run from there. The weekly flow makes them absolute before `dbt build`; `dbt/profiles.yml` sets `override_data_path` so that still works.

## Sentry

| Thing | Value |
| --- | --- |
| Project | `willvernondev/statline` |
| Turn on | set `SENTRY_DSN` in `.env` |
| Tags | `component` = `pipeline` (weekly flow) or `loaders` (runner) |

Some VPN exits get a `403` from Sentry ingest over IPv4. Switch exit nodes if events don't arrive.

## Working in the repo

| Rule | Detail |
| --- | --- |
| Deps | `uv add <pkg>`, never `pip install` |
| Branches | `feature/stat-NN-…` from Linear, PR into `main` |
| Commits | Conventional Commits (`feat:`, `fix:`, `docs:`, …) |
| Never commit | `.env`, `lake/`, `*.duckdb`, `target/`, `.prefect/` |
| dbt threads | `threads: 1`; parallel builds flake on local DuckLake |
