"""
===========================================================
RestaurantAI - Configuration File
Author : Gurchetan Singh
Project: RestaurantAI Sales Prediction
===========================================================
"""

import os

# ==========================================================
# PROJECT ROOT DIRECTORY
# ==========================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ==========================================================
# DATA SOURCE
# Change to "postgres" when database is ready
# ==========================================================

DATA_SOURCE = "csv"

# ==========================================================
# DATA PATHS
# ==========================================================

RAW_DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "raw",
    "restaurant_sales.csv"
)

PROCESSED_DATA_PATH = os.path.join(
    BASE_DIR,
    "data",
    "processed",
    "processed_sales.csv"
)

PREDICTION_PATH = os.path.join(
    BASE_DIR,
    "data",
    "predictions",
    "future_predictions.csv"
)

# ==========================================================
# MODEL PATH
# ==========================================================

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "sales_prediction_model.pkl"
)

# ==========================================================
# RANDOM SEED
# ==========================================================

RANDOM_STATE = 42

# ==========================================================
# TRAIN TEST SPLIT
# ==========================================================

TEST_SIZE = 0.20

# ==========================================================
# TARGET COLUMN
# ==========================================================

TARGET_COLUMN = "sales"

# ==========================================================
# DATABASE CONFIGURATION
# (Used later when PostgreSQL is connected)
# ==========================================================

DB_CONFIG = {

    "host": "localhost",

    "database": "restaurantai",

    "user": "postgres",

    "password": "your_password",

    "port": "5432"
}

# ==========================================================
# FEATURES USED FOR TRAINING
# ==========================================================

FEATURE_COLUMNS = [

    "month",

    "day",

    "day_of_week",

    "season",

    "is_weekend",

    "is_holiday",

    "weather",

    "temperature",

    "customers",

    "online_orders",

    "dine_in_orders",

    "avg_order_value",

    "marketing_spend",

    "special_event"
]

# ==========================================================
# WEATHER TYPES
# ==========================================================

WEATHER_TYPES = [

    "Sunny",

    "Cloudy",

    "Rainy"

]

# ==========================================================
# SEASONS
# ==========================================================

SEASONS = [

    "Winter",

    "Summer",

    "Monsoon"

]

# ==========================================================
# LOGGING
# ==========================================================

LOG_FILE = os.path.join(

    BASE_DIR,

    "restaurant_ai.log"

)