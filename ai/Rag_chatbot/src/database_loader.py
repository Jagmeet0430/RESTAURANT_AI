import os
from pathlib import Path
from typing import List

import psycopg2
from dotenv import load_dotenv
from langchain_core.documents import Document


# rag_chatbot/src/database_loader.py
# parents[1] points to rag_chatbot/
BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
BACKEND_ENV_PATH = BASE_DIR.parents[1] / "backend" / ".env"

load_dotenv(dotenv_path=BACKEND_ENV_PATH, override=True)
load_dotenv(dotenv_path=ENV_PATH, override=False)


def get_database_connection():
    """Create a PostgreSQL connection using the RAG .env file."""

    required_variables = [
        "DB_HOST",
        "DB_PORT",
        "DB_NAME",
        "DB_USER",
        "DB_PASSWORD",
    ]

    missing_variables = [
        variable
        for variable in required_variables
        if not os.getenv(variable)
    ]

    if missing_variables:
        raise RuntimeError(
            "Missing database environment variables: "
            + ", ".join(missing_variables)
            + f". Check: {ENV_PATH}"
        )

    print(f"Loading database configuration from: {BACKEND_ENV_PATH}")
    print(
        "Connecting to PostgreSQL:",
        f"{os.getenv('DB_USER')}@"
        f"{os.getenv('DB_HOST')}:"
        f"{os.getenv('DB_PORT')}/"
        f"{os.getenv('DB_NAME')}",
    )

    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        connect_timeout=10,
    )


def load_menu_documents() -> List[Document]:
    """
    Load menu and category information from PostgreSQL
    and convert every menu item into a LangChain Document.
    """
    connection = get_database_connection()

    try:
        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'menu';
            """
        )
        columns = {row[0] for row in cursor.fetchall()}

        def optional_column(name: str, fallback: str):
            return f"m.{name}" if name in columns else f"{fallback} AS {name}"

        query = """
            SELECT
                m.id,
                m.name,
                m.description,
                m.price,
                m.veg_type,
                m.is_available,
                m.is_featured,
                m.is_spicy,
                {is_eggless},
                {ingredients},
                {allergens},
                {is_today_special},
                {special_date},
                m.preparation_time,
                m.calories,
                m.image_url,
                c.name AS category_name
            FROM menu m
            LEFT JOIN categories c
                ON c.id = m.category_id
            ORDER BY c.name, m.name;
        """.format(
            is_eggless=optional_column("is_eggless", "false"),
            ingredients=optional_column("ingredients", "NULL"),
            allergens=optional_column("allergens", "NULL"),
            is_today_special=optional_column("is_today_special", "false"),
            special_date=optional_column("special_date", "NULL"),
        )

        cursor.execute(query)
        rows = cursor.fetchall()

        documents = []

        for row in rows:
            (
                menu_id,
                name,
                description,
                price,
                veg_type,
                is_available,
                is_featured,
                is_spicy,
                is_eggless,
                ingredients,
                allergens,
                is_today_special,
                special_date,
                preparation_time,
                calories,
                image_url,
                category_name,
            ) = row

            content = f"""
Menu Item: {name}
Category: {category_name or "Uncategorized"}
Description: {description or "No description available"}
Price: Rs. {price}
Vegetarian Type: {veg_type or "Not specified"}
Available: {"Yes" if is_available else "No"}
Featured: {"Yes" if is_featured else "No"}
Spicy: {"Yes" if is_spicy else "No"}
Eggless: {"Yes" if is_eggless else "No"}
Ingredients: {ingredients or "Not available"}
Allergens: {allergens or "Not available"}
Today's Special: {"Yes" if is_today_special else "No"}
Special Date: {special_date or "Not set"}
Preparation Time: {preparation_time or "Not specified"} minutes
Calories: {calories or "Not specified"}
""".strip()

            document = Document(
                page_content=content,
                metadata={
                    "source": "postgresql",
                    "document_type": "menu_item",
                    "audience": "customer",
                    "menu_id": str(menu_id),
                    "item_name": name,
                    "category": category_name or "Uncategorized",
                    "available": bool(is_available),
                    "featured": bool(is_featured),
                    "eggless": bool(is_eggless),
                    "today_special": bool(is_today_special),
                },
            )

            documents.append(document)

        return documents

    finally:
        connection.close()


class DatabaseLoader:
    def load_menu_documents(self) -> List[Document]:
        return load_menu_documents()
