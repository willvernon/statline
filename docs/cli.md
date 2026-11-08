# Export CLI (Go)

Copies one gold mart from the lake to a Parquet file. Needs Go 1.27.1. Run from the repo root.

| Flag | Values |
| --- | --- |
| `-dataMart` | `fact_player_game` (default), `fact_team_game`, `dim_player`, `dim_team`, `dim_game` |
| `-dest` | a `.parquet` path. Use `$HOME` or an absolute path; `~` isn't expanded |

```bash
go run ./cli -dataMart fact_player_game -dest "$HOME/Downloads/fact_player_game.parquet"
```

```bash
go build -o statline-export ./cli
./statline-export -dataMart dim_team -dest "$HOME/Downloads/dim_team.parquet"
```

```nushell
go run ./cli -dataMart fact_player_game -dest ($env.HOME | path join "Downloads" "fact_player_game.parquet")
```

**Known issues (STAT-80):** `-dest` has no real default, some failures exit `0`, and the lake path is hardcoded to `lake/`. Whether to finish or drop the CLI is STAT-50.
