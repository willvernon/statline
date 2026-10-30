import nflreadpy as nfl

from ingestion.ducklake import get_connection


def main(season: int | None = None) -> None:
    if season is None:
        season = nfl.get_current_season()
    rosters = nfl.load_rosters(seasons=season)
    with get_connection() as conn:
        conn.register("rosters", rosters)
        table = "lake.raw.nfl_rosters"
        table_name = "rosters"

        lake_cols = {row[0] for row in conn.execute(f"DESCRIBE {table}").fetchall()}
        source_cols = set(rosters.columns)
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
            FROM rosters
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
