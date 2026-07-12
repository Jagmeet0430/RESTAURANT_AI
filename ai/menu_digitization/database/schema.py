from database.db import get_connection


def create_tables():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS restaurants (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS menu_categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS digitized_menu_items (
            id SERIAL PRIMARY KEY,
            restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
            category_id INTEGER REFERENCES menu_categories(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            price NUMERIC(10, 2) NOT NULL,
            source_file VARCHAR(255),
            x_position NUMERIC(10, 2),
            y_position NUMERIC(10, 2),
            column_no INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(restaurant_id, name, price)
        );
    """)

    connection.commit()
    cursor.close()
    connection.close()

    print("Database tables created successfully.")
