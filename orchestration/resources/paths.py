"""Repo-root path helpers for orchestration.

The weekly flow runs ``dbt build`` in a subprocess. Relative lake paths break
when that process is not started from the repo root.

DuckLake also stores DATA_PATH as a string in the catalog (this project uses
``lake/data/``). Absolute DATA_PATH requires OVERRIDE_DATA_PATH on attach —
see ``dbt/profiles.yml`` and ``ingestion/ducklake.py``.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]

_DEFAULT_CATALOG = "lake/metadata.ducklake"
_DEFAULT_DATA = "lake/data"


def normalize_lake_env() -> Path:
    """Load repo-root .env and set absolute LAKE_* for the dbt subprocess.

    Both catalog and data path are absolute so parquet reads work even when
    dbt's cwd is not the repo root. Pair with OVERRIDE_DATA_PATH on attach so the
    absolute data path is accepted against a catalog that still records
    ``lake/data/``.

    Returns REPO_ROOT.
    """
    load_dotenv(REPO_ROOT / ".env")
    root = REPO_ROOT.resolve()

    catalog = Path(os.environ.get("LAKE_CATALOG_PATH", _DEFAULT_CATALOG))
    data = Path(os.environ.get("LAKE_DATA_PATH", _DEFAULT_DATA))

    if not catalog.is_absolute():
        catalog = (root / catalog).resolve()
    else:
        catalog = catalog.resolve()

    if not data.is_absolute():
        data = (root / data).resolve()
    else:
        data = data.resolve()

    os.environ["LAKE_CATALOG_PATH"] = str(catalog)
    os.environ["LAKE_DATA_PATH"] = str(data)
    return REPO_ROOT


# Back-compat alias
ensure_absolute_lake_env = normalize_lake_env
