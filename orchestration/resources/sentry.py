"""Sentry setup for the Python pipeline (loaders + Prefect flow).

Reads ``SENTRY_DSN`` from the environment or the repo-root ``.env``. With no
DSN set this is a no-op, so the pipeline runs the same without Sentry.

    SENTRY_DSN          project DSN (Sentry project ``statline``)
    SENTRY_ENVIRONMENT  defaults to ``development``
    SENTRY_RELEASE      optional; the SDK falls back to the git SHA
"""

from __future__ import annotations

import os

import sentry_sdk
from dotenv import load_dotenv

from orchestration.resources.paths import REPO_ROOT


def init_sentry(component: str) -> bool:
    """Start the Sentry SDK once per process. Return True when enabled.

    ``component`` is tagged on every event (``pipeline``, ``loaders``) so one
    Sentry project can tell the entry points apart.
    """
    if sentry_sdk.is_initialized():
        return True
    load_dotenv(REPO_ROOT / '.env')
    dsn = os.environ.get('SENTRY_DSN')
    if not dsn:
        return False
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get('SENTRY_ENVIRONMENT', 'development'),
        release=os.environ.get('SENTRY_RELEASE'),
        # Batch job with no end users: nothing personal to send.
        send_default_pii=False,
        # One run a week, so sample every transaction.
        traces_sample_rate=1.0,
    )
    sentry_sdk.set_tag('component', component)
    return True
