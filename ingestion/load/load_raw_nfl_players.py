import nflreadpy as nfl

from ingestion.ducklake import get_connection


def main() -> None:
    players = nfl.load_players()

    with get_connection() as conn:
        conn.register("players", players)
        table = "lake.raw.nfl_players"

        lake_cols = {row[0] for row in conn.execute(f"DESCRIBE {table}").fetchall()}
        source_cols = set(players.columns)
        new_cols = set(source_cols - lake_cols)
        if new_cols:
            source_types = {
                name: typ for name, typ, *_ in conn.execute("DESCRIBE players").fetchall()
            }
            for col in new_cols:
                print(f"new cols: adding {col}")
                dtype = source_types[col]
                conn.sql(f'ALTER TABLE {table} ADD "{col}" {dtype}')
        print("no new cols")
        conn.sql(f"DELETE FROM {table}")
        conn.sql(
            f"""
            INSERT INTO {table} BY NAME
            SELECT *
            FROM players
        """
        )

        result = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        if result is None:
            raise RuntimeError("COUNT(*) returned no rows")
        print(f"Loaded {result[0]} rows into {table}")


if __name__ == "__main__":
    main()
