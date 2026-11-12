import os

import psycopg
from fastapi import FastAPI, HTTPException

app = FastAPI(
    title="Balsave API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)


@app.get("/api/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ready", include_in_schema=False)
def readiness() -> dict[str, str]:
    try:
        with psycopg.connect(
            host=os.getenv("DB_HOST", "localhost"),
            dbname="valora",
            user="valora_app",
            password=os.environ.get("BALSAVE_DB_PASSWORD") or os.environ["VALORA_DB_PASSWORD"],
            connect_timeout=3,
            options="-c statement_timeout=3000",
        ) as connection:
            connection.execute("SELECT 1")
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return {"status": "ready"}
