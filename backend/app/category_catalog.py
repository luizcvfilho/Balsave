"""Cache the public provider taxonomy without persisting financial records."""

from datetime import UTC, datetime, timedelta
from time import monotonic

from app import category_store, pluggy

CATALOG_TTL = timedelta(days=1)
RETRY_SECONDS = 300
_retry_after = 0.0


def load_catalog(connection, api_key: str) -> tuple[dict[str, dict], bool]:
    """Return the last complete catalog even when its refresh is unavailable.

    The snapshot lock serializes callers. A successful empty catalog is cached;
    failed refreshes keep the persistent cache and briefly throttle retries.
    """
    global _retry_after
    records, refreshed_at = category_store.load_catalog(connection)
    now = datetime.now(UTC)
    if refreshed_at is not None and now - refreshed_at < CATALOG_TTL:
        return records, False
    if monotonic() < _retry_after:
        return records, True
    try:
        fetched = pluggy.categories(api_key)
    except pluggy.PluggyError:
        _retry_after = monotonic() + RETRY_SECONDS
        return records, True
    category_store.replace_catalog(connection, fetched)
    _retry_after = 0.0
    return {record["id"]: record for record in fetched}, False
