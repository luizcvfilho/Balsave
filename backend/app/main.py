import psycopg
from fastapi import FastAPI, HTTPException

from app import auth, category_api, category_rule_api, database, pluggy_preview, receivable_api, simulator_api, tag_api

app = FastAPI(
    title="Balsave API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)
app.include_router(auth.router)
app.include_router(pluggy_preview.router)
app.include_router(category_api.router)
app.include_router(category_rule_api.router)
app.include_router(tag_api.router)
app.include_router(receivable_api.router)
app.include_router(simulator_api.router)


@app.get("/api/health", include_in_schema=False)
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/ready", include_in_schema=False)
def readiness() -> dict[str, str]:
    try:
        with database.connect() as connection:
            connection.execute("SELECT 1")
    except (KeyError, psycopg.Error):
        raise HTTPException(status_code=503, detail="Database unavailable") from None

    return {"status": "ready"}
