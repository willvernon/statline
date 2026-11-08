import sys

import sentry_sdk

from ingestion.load.load_raw_nfl_draft_picks import main as load_draft_picks
from ingestion.load.load_raw_nfl_player_stats import main as load_player_stats
from ingestion.load.load_raw_nfl_players import main as load_players
from ingestion.load.load_raw_nfl_rosters import main as load_rosters
from ingestion.load.load_raw_nfl_schedules import main as load_schedules
from ingestion.load.load_raw_nfl_team_stats import main as load_team_stats
from ingestion.load.load_raw_nfl_teams import main as load_teams
from orchestration.resources.sentry import init_sentry


def _run(load, *args) -> str | None:
    """Run one loader. Return its module name when it fails.

    Loaders raise whatever the source or lake throws. Catching Exception
    here is deliberate so a later loader still runs.
    """
    name = load.__module__
    try:
        load(*args)
    except Exception as exc:  # noqa: BLE001
        # Swallowed so later loaders still run, so report it explicitly.
        sentry_sdk.capture_exception(exc)
        print(f"FAILED {name}: {exc}")
        return name
    print(f"OK {name}")
    return None


def main(season: int | None = None) -> None:
    """Run all raw loaders.

    seasonal loaders: pass season (None → each loader uses current season).
    snapshot loaders: full delete+reload (teams, players).
    """
    seasonal = [
        load_draft_picks,
        load_player_stats,
        load_rosters,
        load_schedules,
        load_team_stats,
    ]
    snapshots = [
        load_players,
        load_teams,
    ]

    failed: list[str] = []
    for load in seasonal:
        if failure := _run(load, season):
            failed.append(failure)
    for load in snapshots:
        if failure := _run(load):
            failed.append(failure)

    if failed:
        print(f"Done with {len(failed)} failure(s): {failed}")
        sys.exit(1)

    print("All loaders succeeded")


if __name__ == "__main__":
    init_sentry("loaders")
    season_arg = int(sys.argv[1]) if len(sys.argv) > 1 else None
    main(season_arg)
