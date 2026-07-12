import json
import os
from pathlib import Path

from dotenv import load_dotenv

from database.db import get_connection
from database.schema import create_tables


BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")


def get_or_create_restaurant(cursor, restaurant_name):
    cursor.execute(
        """
        INSERT INTO restaurants (name)
        VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """,
        (restaurant_name,),
    )
    return cursor.fetchone()[0]


def get_or_create_category(cursor, category_name):
    cursor.execute(
        """
        INSERT INTO menu_categories (name)
        VALUES (%s)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """,
        (category_name,),
    )
    return cursor.fetchone()[0]


def insert_menu_items(json_file_path, restaurant_name=None):
    json_file_path = Path(json_file_path)

    print("Reading JSON file:", json_file_path)

    if not json_file_path.exists():
        raise FileNotFoundError(f"JSON file not found: {json_file_path}")

    restaurant_name = restaurant_name or os.getenv(
        "DEFAULT_RESTAURANT_NAME",
        "RestaurantAI Demo Restaurant"
    )

    with open(json_file_path, "r", encoding="utf-8") as file:
        menu_items = json.load(file)

    print("Items found in JSON:", len(menu_items))

    if not menu_items:
        print("No menu items found in JSON.")
        return

    create_tables()

    connection = get_connection()
    cursor = connection.cursor()

    restaurant_id = get_or_create_restaurant(cursor, restaurant_name)

    inserted_count = 0
    skipped_count = 0

    for item in menu_items:
        name = item.get("name")
        original_name = item.get("original_name", name)
        category = item.get("category", "Uncategorized")
        price = item.get("price")
        x = item.get("x")
        y = item.get("y")
        column = item.get("column")

        if not name or price is None:
            skipped_count += 1
            continue

        category_id = get_or_create_category(cursor, category)

        cursor.execute(
            """
            INSERT INTO digitized_menu_items (
                restaurant_id,
                category_id,
                name,
                original_name,
                price,
                source_file,
                x_position,
                y_position,
                column_no
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (restaurant_id, name, price) DO NOTHING;
            """,
            (
                restaurant_id,
                category_id,
                name,
                original_name,
                price,
                json_file_path.name,
                x,
                y,
                column,
            ),
        )

        if cursor.rowcount > 0:
            inserted_count += 1
        else:
            skipped_count += 1

    connection.commit()
    cursor.close()
    connection.close()

    print("Menu insertion completed.")
    print("Restaurant:", restaurant_name)
    print("Inserted items:", inserted_count)
    print("Skipped duplicate/invalid items:", skipped_count)


if __name__ == "__main__":
    final_json_path = BASE_DIR / "output" / "json" / "menu1_final.json"

    if not final_json_path.exists():
        print("menu1_final.json not found.")
        print("Trying menu1_layout.json instead...")

        final_json_path = BASE_DIR / "output" / "json" / "menu1_layout.json"

    insert_menu_items(final_json_path)
