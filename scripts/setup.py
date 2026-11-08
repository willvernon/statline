import os
import shutil
import subprocess
import sys
from pathlib import Path

DOWNLOAD_LINKS = (
    ("uv", "https://docs.astral.sh/uv/getting-started/installation/"),
    ("go", "https://go.dev/dl/"),
    ("duckdb", "https://duckdb.org/install/"),
)


def print_download_links(tools: tuple[tuple[str, str], ...] = DOWNLOAD_LINKS) -> None:
    print("Download links:")
    for name, url in tools:
        print(f"  {name}: {url}")


def require_uv() -> None:
    if shutil.which("uv"):
        return
    print("uv is required but was not found on PATH.")
    print_download_links()
    sys.exit(1)


def warn_optional_tools() -> None:
    missing = [
        (name, url)
        for name, url in DOWNLOAD_LINKS
        if name != "uv" and shutil.which(name) is None
    ]
    if not missing:
        return
    print("Optional tools not found on PATH:")
    for name, url in missing:
        print(f"  {name}: {url}")


def setup() -> None:
    require_uv()
    warn_optional_tools()
    root = Path.cwd()
    env = {
        **os.environ,
        "LAKE_CATALOG_PATH": str(root / "lake/metadata.ducklake"),
        "LAKE_DATA_PATH": str(root / "lake/data"),
    }

    if not Path(".env").exists():
        shutil.copy(".env.example", ".env")

    subprocess.run(["uv", "run", "python", "-m", "ingestion.ducklake"], check=True)
    subprocess.run(
        ["uv", "run", "python", "-m", "scripts.ingestion_runner"], check=True
    )
    subprocess.run(
        [
            "uv",
            "run",
            "dbt",
            "build",
            "--project-dir",
            "dbt",
            "--profiles-dir",
            "dbt",
        ],
        check=True,
        env=env,
    )

    print("Weekly flow, one shot, current season:")
    print("  uv run python -m orchestration.weekly")
    print("Clock (schedule starts paused). Prefect server in another terminal:")
    print("  uv run prefect server start")
    print("  uv run python -m orchestration.weekly --serve")


if __name__ == "__main__":
    setup()
