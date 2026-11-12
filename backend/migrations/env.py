import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy import URL, create_engine, pool, text

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)


def run_migrations_offline() -> None:
    context.configure(dialect_name="postgresql", literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = URL.create(
        "postgresql+psycopg",
        username="postgres",
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.getenv("DB_HOST", "localhost"),
        database="valora",
    )
    engine = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 5},
        hide_parameters=True,
    )

    with engine.connect() as connection:
        # Serialize migrations from Compose startup and manual runs. Closing the
        # physical connection releases the session lock, including on failure.
        connection.execute(text("SELECT pg_advisory_lock(hashtext('valora:alembic'))"))
        connection.commit()

        context.configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
