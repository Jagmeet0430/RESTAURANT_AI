import os
from pathlib import Path

import psycopg2
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def get_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "restaurant_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "Pass@*$&"),
    )


def test_connection():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT version();")
    version = cursor.fetchone()

    cursor.close()
    connection.close()

    return version
