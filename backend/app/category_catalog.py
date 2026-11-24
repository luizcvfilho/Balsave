"""Cache the public provider taxonomy without persisting financial records."""

from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic

from app import category_store, database, pluggy

CATALOG_TTL = timedelta(days=1)
RETRY_SECONDS = 300
_retry_after = 0.0
_refresh_lock = Lock()


def load_catalog(api_key: str) -> tuple[dict[str, dict], bool]:
    """Use the persisted catalog while another request is refreshing it."""
    global _retry_after
    with database.connect() as connection:
        records, refreshed_at = category_store.load_catalog(connection)
        if refreshed_at is not None and datetime.now(UTC) - refreshed_at < CATALOG_TTL:
            return records, False
        if monotonic() < _retry_after or not _refresh_lock.acquire(blocking=False):
            return records, True
        try:
            fetched = pluggy.categories(api_key)
            category_store.replace_catalog(connection, fetched)
            connection.commit()
            _retry_after = 0.0
        except pluggy.PluggyError:
            _retry_after = monotonic() + RETRY_SECONDS
            return records, True
        finally:
            _refresh_lock.release()
        return {record["id"]: record for record in fetched}, False
