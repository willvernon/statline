import nflreadpy as nfl

from ingestion.ducklake import get_connection


def main(season: int | None = None) -> None:
    if season is None:
        season = nfl.get_current_season()
    player_stats = nfl.load_player_stats(seasons=season)
    table = "lake.raw.nfl_player_stats"

    with get_connection() as conn:
        conn.register("player_stats", player_stats)

        # fixes problem of new or changed cols
        lake_cols = {row[0] for row in conn.execute(f"DESCRIBE {table}").fetchall()}
        source_cols = set(player_stats.columns)
        new_cols = set(source_cols - lake_cols)
        if new_cols:
            source_types = {
                name: typ
                for name, typ, *_ in conn.execute("DESCRIBE player_stats").fetchall()
            }
            for col in new_cols:
                print(f"new cols: adding {col}")
                dtype = source_types[col]
                conn.sql(f'ALTER TABLE {table} ADD "{col}" {dtype}')
        print("no new cols")
        conn.sql(f"DELETE FROM {table} WHERE season = {season}")
        conn.sql(
            f"""
            INSERT INTO {table} BY NAME
            SELECT *
            FROM player_stats
        """
        )
        result = conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE season = {season}"
        ).fetchone()
        if result is None:
            raise RuntimeError("COUNT(*) returned no rows")
        print(f"Loaded {result[0]} rows into {table} for season {season}")


if __name__ == "__main__":
    main()
