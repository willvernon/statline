"""Weekly NFL refresh: bronze loaders, then dbt build.

From the repo root:

    uv run python -m orchestration.weekly
    uv run python -m orchestration.weekly 2024
    uv run python -m orchestration.weekly --serve

A plain run executes the flow once. ``--serve`` only listens for scheduled
runs, and the Tuesday schedule is created paused. Start
``uv run prefect server start`` in another terminal first if you want the UI.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

# Before Prefect is imported. The server heartbeat and the SDK analytics
# client both start during import.
os.environ['PREFECT_SERVER_ANALYTICS_ENABLED'] = 'false'
os.environ['DO_NOT_TRACK'] = '1'

import sentry_sdk
from prefect import flow, task
from prefect.schedules import Cron

from ingestion.load.load_raw_nfl_draft_picks import main as draft_picks_main
from ingestion.load.load_raw_nfl_player_stats import main as player_stats_main
from ingestion.load.load_raw_nfl_players import main as players_main
from ingestion.load.load_raw_nfl_rosters import main as rosters_main
from ingestion.load.load_raw_nfl_schedules import main as schedules_main
from ingestion.load.load_raw_nfl_team_stats import main as team_stats_main
from ingestion.load.load_raw_nfl_teams import main as teams_main
from orchestration.resources.paths import REPO_ROOT, normalize_lake_env
from orchestration.resources.sentry import init_sentry

# Module level so served runs, which import this module in a fresh process,
# report too.
init_sentry('pipeline')

DBT_PROJECT_DIR = REPO_ROOT / 'statline_dbt'
WEEKLY_CRON = '0 8 * * 2'
WEEKLY_TIMEZONE = 'America/Indiana/Indianapolis'
USAGE = 'usage: python -m orchestration.weekly [--serve | SEASON]'


@task(log_prints=True)
def load_teams() -> None:
    teams_main()


@task(log_prints=True)
def load_players() -> None:
    players_main()


@task(log_prints=True)
def load_player_stats(season: int | None = None) -> None:
    player_stats_main(season)


@task(log_prints=True)
def load_team_stats(season: int | None = None) -> None:
    team_stats_main(season)


@task(log_prints=True)
def load_schedules(season: int | None = None) -> None:
    schedules_main(season)


@task(log_prints=True)
def load_rosters(season: int | None = None) -> None:
    rosters_main(season)


@task(log_prints=True)
def load_draft_picks(season: int | None = None) -> None:
    draft_picks_main(season)


@task(log_prints=True)
def dbt_build() -> None:
    """Run ``dbt build`` from the repo root with absolute lake paths."""
    normalize_lake_env()
    dbt = shutil.which('dbt')
    if dbt is None:
        raise RuntimeError('dbt is not on PATH. Run this with `uv run`.')
    subprocess.run(
        [
            dbt,
            'build',
            '--project-dir',
            str(DBT_PROJECT_DIR),
            '--profiles-dir',
            str(DBT_PROJECT_DIR),
        ],
        cwd=REPO_ROOT,
        env=os.environ.copy(),
        check=True,
    )


@flow(name='nfl_weekly_refresh', log_prints=True)
def nfl_weekly_refresh(season: int | None = None) -> None:
    """Load one NFL season into ``lake.raw``, then build silver and gold.

    ``season=None`` lets each seasonal loader ask nflreadpy for the current
    season. Teams and players are full snapshots and ignore ``season``.
    A failed loader stops the flow, so dbt does not build on partial bronze.
    """
    with sentry_sdk.start_transaction(op='prefect.flow', name='nfl_weekly_refresh'):
        sentry_sdk.set_tag('season', season if season is not None else 'current')
        try:
            normalize_lake_env()
            load_teams()
            load_players()
            load_player_stats(season)
            load_team_stats(season)
            load_schedules(season)
            load_rosters(season)
            load_draft_picks(season)
            dbt_build()
        except Exception:
            # Prefect records the failure on the flow run instead of letting it
            # reach sys.excepthook in served runs, so report it here.
            sentry_sdk.capture_exception()
            raise


def serve_weekly() -> None:
    """Listen for runs. The Tuesday 08:00 schedule starts paused."""
    nfl_weekly_refresh.serve(
        name='nfl_weekly_refresh',
        schedule=Cron(
            WEEKLY_CRON,
            timezone=WEEKLY_TIMEZONE,
            active=False,
            slug='tuesday-8am',
        ),
    )


def main(argv: list[str] | None = None) -> None:
    args = list(sys.argv[1:] if argv is None else argv)
    if args == ['--serve']:
        serve_weekly()
        return
    if len(args) > 1:
        raise SystemExit(USAGE)
    season = None
    if args:
        try:
            season = int(args[0])
        except ValueError:
            raise SystemExit(USAGE) from None
    nfl_weekly_refresh(season)


if __name__ == '__main__':
    main()
