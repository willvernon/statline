# Query the lake

## Start querying

Run from the repo root. `mise.toml` pins the DuckDB CLI to match the project's Python duckdb.

| Tool | Command | Then |
| --- | --- | --- |
| **Notebook** (browser) | `duckdb -cmd "ATTACH 'ducklake:lake/metadata.ducklake' AS lake (DATA_PATH 'lake/data'); USE lake;" -ui` | opens http://localhost:4213. Query `main_marts.*` directly |
| **Terminal** | the same command without `-ui` | a SQL prompt, already in `lake` |
| **Python** | `uv run python`, or a notebook on the project venv | the attach below |

First time in this repo: `mise install` (gets DuckDB 2.0.0).

## Attach

```sql
ATTACH 'ducklake:lake/metadata.ducklake' AS lake (DATA_PATH 'lake/data');
USE lake;
```

```python
import duckdb
con = duckdb.connect()
con.execute("ATTACH 'ducklake:lake/metadata.ducklake' AS lake (DATA_PATH 'lake/data', READ_ONLY)")
con.execute("SELECT count(*) FROM lake.main_marts.fact_player_game").fetchall()
```

Add `READ_ONLY` inside the parentheses when you only want to look.

## Exploring safely

| Want to | Do | Not |
| --- | --- | --- |
| Scratch table | `CREATE TEMP TABLE x AS …` (gone on exit) | `CREATE TABLE x …`, which writes into the lake after `USE lake` |
| Run loaders or Prefect | **close the notebook / prompt first** | leave it open; even read-only locks the catalog |

## What to query

| Schema | Objects | Use for |
| --- | --- | --- |
| `raw` | `nfl_*` | source-shaped bronze; debugging loads |
| `main_staging` | `stg_nfl_*` | clean, renamed; exploration |
| `main_marts` | `dim_*`, `fact_*` | star schema; app and shared metrics |
| `main_marts` | `agg_player_season`, `agg_team_season` | season totals; leaderboards without a `GROUP BY` |

```sql
SHOW ALL TABLES;                          -- everything in the lake
DESCRIBE main_marts.fact_player_game;     -- columns
```

## Example: 2024 PPR leaders

```sql
SELECT
    p.display_name                       AS player,
    f.position,
    count(*)                             AS games,
    round(sum(f.fantasy_points_ppr), 1)  AS ppr_points,
    round(avg(f.fantasy_points_ppr), 1)  AS ppr_per_game
FROM main_marts.fact_player_game AS f
JOIN main_marts.dim_player       AS p ON p.gsis_id = f.player_id
WHERE f.season = 2024
  AND f.season_type = 'REG'
  AND f.position IN ('QB', 'RB', 'WR', 'TE')
GROUP BY ALL
ORDER BY ppr_points DESC
LIMIT 10;
```

## Example: 2024 rushing leaders (season aggregate)

Same idea, no `GROUP BY`: `agg_player_season` already holds season totals and rates.

```sql
SELECT p.display_name AS player, s.position, s.gp, s.rushing_yards, round(s.rush_ypc, 2) AS ypc
FROM main_marts.agg_player_season AS s
JOIN main_marts.dim_player        AS p ON p.gsis_id = s.player_id
WHERE s.season = 2024 AND s.season_type = 'REG'
ORDER BY s.rushing_yards DESC
LIMIT 5;
```

Load 2024 first: `uv run python -m orchestration.weekly 2024`. A fresh setup loads only the current season. Check what's loaded:

```sql
SELECT season, max(week) AS last_week, count(*) AS rows
FROM main_marts.fact_player_game
GROUP BY season;
```

## Version match

| Check | Command | Should be |
| --- | --- | --- |
| Python duckdb | `uv run python -c "import duckdb; print(duckdb.__version__)"` | the same |
| CLI | `duckdb --version` (from the repo root) | the same |

When you upgrade duckdb in `uv.lock`, bump `mise.toml` to match.

## Troubleshoot

| Symptom | Fix |
| --- | --- |
| `version number 69, but we can only read versions between 64 and 68` | CLI is older than the project's duckdb → `mise install`, run from the repo root |
| `duckdb --version` still old in the repo | mise isn't on your PATH → activate mise in your shell, or use `mise exec -- duckdb` |
| `Could not set lock on file` | another session has the lake open → close it |
| `Cannot open file … metadata.ducklake` | wrong directory, or no lake yet → run from the repo root, or `scripts/setup.py` |
