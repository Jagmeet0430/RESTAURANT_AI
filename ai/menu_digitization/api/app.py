from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from database.db import get_connection
from services.menu_digitization_service import (
    save_uploaded_image,
    process_menu_image,
)


app = FastAPI(
    title="Menu Digitization AI API",
    description="API for uploading menu images and managing OCR digitized restaurant menu items",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "success": True,
        "message": "Menu Digitization AI API is running",
        "docs": "/docs",
        "health": "/health",
        "upload": "/upload-menu",
        "items": "/digitized-menu/items",
        "categories": "/digitized-menu/categories",
    }


@app.get("/health")
def health_check():
    database_status = "connected"

    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT 1;")
        cursor.fetchone()
        cursor.close()
        connection.close()
    except Exception:
        database_status = "disconnected"

    return {
        "success": True,
        "message": "Menu Digitization AI API is running",
        "database": database_status,
        "version": "1.0.0",
        "environment": "development",
    }


@app.post("/upload-menu")
def upload_menu_image(
    file: UploadFile = File(...),
    save_to_database: bool = True
):
    try:
        saved_image_path = save_uploaded_image(file)

        result = process_menu_image(
            saved_image_path,
            save_to_database=save_to_database
        )

        return {
            "success": True,
            "message": "Menu image processed successfully",
            "data": result,
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error))

    except Exception as error:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"{type(error).__name__}: {str(error)}"
        )


@app.get("/digitized-menu/categories")
def get_categories():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, name, created_at
        FROM menu_categories
        ORDER BY name;
    """)

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    categories = []

    for row in rows:
        categories.append({
            "id": row[0],
            "name": row[1],
            "created_at": str(row[2]),
        })

    return {
        "success": True,
        "count": len(categories),
        "data": categories,
    }


@app.get("/digitized-menu/items")
def get_digitized_menu_items():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            d.id,
            d.name,
            d.original_name,
            d.price,
            c.name AS category,
            r.name AS restaurant,
            d.source_file,
            d.x_position,
            d.y_position,
            d.column_no,
            d.created_at
        FROM digitized_menu_items d
        LEFT JOIN restaurants r ON d.restaurant_id = r.id
        LEFT JOIN menu_categories c ON d.category_id = c.id
        ORDER BY c.name, d.name;
    """)

    rows = cursor.fetchall()

    cursor.close()
    connection.close()

    items = []

    for row in rows:
        items.append({
            "id": row[0],
            "name": row[1],
            "original_name": row[2],
            "price": float(row[3]),
            "category": row[4],
            "restaurant": row[5],
            "source_file": row[6],
            "x_position": float(row[7]) if row[7] is not None else None,
            "y_position": float(row[8]) if row[8] is not None else None,
            "column_no": row[9],
            "created_at": str(row[10]),
        })

    return {
        "success": True,
        "count": len(items),
        "data": items,
    }


@app.get("/digitized-menu/items/{item_id}")
def get_digitized_menu_item(item_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT
            d.id,
            d.name,
            d.original_name,
            d.price,
            c.name AS category,
            r.name AS restaurant,
            d.source_file,
            d.x_position,
            d.y_position,
            d.column_no,
            d.created_at
        FROM digitized_menu_items d
        LEFT JOIN restaurants r ON d.restaurant_id = r.id
        LEFT JOIN menu_categories c ON d.category_id = c.id
        WHERE d.id = %s;
    """, (item_id,))

    row = cursor.fetchone()

    cursor.close()
    connection.close()

    if not row:
        raise HTTPException(status_code=404, detail="Menu item not found")

    return {
        "success": True,
        "data": {
            "id": row[0],
            "name": row[1],
            "original_name": row[2],
            "price": float(row[3]),
            "category": row[4],
            "restaurant": row[5],
            "source_file": row[6],
            "x_position": float(row[7]) if row[7] is not None else None,
            "y_position": float(row[8]) if row[8] is not None else None,
            "column_no": row[9],
            "created_at": str(row[10]),
        },
    }

@app.get("/digitized-menu/summary")
def get_digitized_menu_summary():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("SELECT COUNT(*) FROM digitized_menu_items;")
    total_items = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM menu_categories;")
    total_categories = cursor.fetchone()[0]

    cursor.execute("""
        SELECT c.name, COUNT(d.id) AS item_count
        FROM menu_categories c
        LEFT JOIN digitized_menu_items d ON d.category_id = c.id
        GROUP BY c.name
        ORDER BY item_count DESC;
    """)

    category_rows = cursor.fetchall()

    cursor.close()
    connection.close()

    return {
        "success": True,
        "data": {
            "total_items": total_items,
            "total_categories": total_categories,
            "categories": [
                {
                    "category": row[0],
                    "item_count": row[1],
                }
                for row in category_rows
            ],
        },
    }
