import os

import psycopg


def connect():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        dbname="balsave",
        user="balsave_app",
        password=os.environ["BALSAVE_DB_PASSWORD"],
        connect_timeout=3,
        options="-c statement_timeout=3000",
    )


def connect_admin():
    return psycopg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        dbname="balsave",
        user="postgres",
        password=os.environ["POSTGRES_PASSWORD"],
        connect_timeout=5,
    )
