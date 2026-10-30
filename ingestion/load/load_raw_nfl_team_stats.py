import nflreadpy as nfl

from ingestion.ducklake import get_connection


def main(season: int | None = None) -> None:
    if season is None:
        season = nfl.get_current_season()
    team_stats = nfl.load_team_stats(seasons=season)

    with get_connection() as conn:
        conn.register("team_stats", team_stats)
        table = "lake.raw.nfl_team_stats"
        table_name = "team_stats"

        lake_cols = {row[0] for row in conn.execute(f"DESCRIBE {table}").fetchall()}
        source_cols = set(team_stats.columns)
        new_cols = set(source_cols - lake_cols)
        if new_cols:
            source_types = {
                name: typ
                for name, typ, *_ in conn.execute(f"DESCRIBE {table_name}").fetchall()
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
            FROM {table_name}
        """
        )

        result = conn.execute(
            f"SELECT COUNT(*) FROM {table} WHERE season = {season}"
        ).fetchone()
        if result is None:
            raise RuntimeError("COUNT(*) returned no rows")
        print(f"Loaded {result[0]} rows into {table}")


if __name__ == "__main__":
    main()
