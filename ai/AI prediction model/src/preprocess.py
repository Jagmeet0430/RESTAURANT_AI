from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

from config.config import (
    FEATURE_COLUMNS,
    RANDOM_STATE,
    TARGET_COLUMN,
)


def prepare_features(dataframe):
    """
    Prepare features for both training and prediction.
    """

    df = dataframe.copy()

    # ==========================================================
    # Date Feature Engineering
    # ==========================================================
    date_column = None

    if "date" in df.columns:
        date_column = "date"
    elif "Order_Date" in df.columns:
        date_column = "Order_Date"
    elif "Date" in df.columns:
        date_column = "Date"

    if date_column:

        df["date"] = pd.to_datetime(df[date_column], errors="coerce")

        df["month"] = df["date"].dt.month
        df["day"] = df["date"].dt.day
        df["day_of_week"] = df["date"].dt.day_name()

        season_map = {
            12: "Winter",
            1: "Winter",
            2: "Winter",
            3: "Summer",
            4: "Summer",
            5: "Summer",
            6: "Monsoon",
            7: "Monsoon",
            8: "Monsoon",
            9: "Monsoon",
            10: "Summer",
            11: "Winter",
        }

        df["season"] = df["month"].map(season_map)

        df["is_weekend"] = (
            df["day_of_week"]
            .isin(["Saturday", "Sunday"])
            .astype(int)
        )

    # ==========================================================
    # Default values (Prediction API support)
    # ==========================================================

    defaults = {
        "month": 1,
        "day": 1,
        "day_of_week": "Monday",
        "season": "Summer",
        "is_weekend": 0,
        "is_holiday": 0,
        "weather": "Sunny",
        "temperature": 25,
        "customers": 100,
        "online_orders": 20,
        "dine_in_orders": 80,
        "avg_order_value": 18,
        "marketing_spend": 500,
        "special_event": "No",
    }

    for col, value in defaults.items():
        if col not in df.columns:
            df[col] = value

    # ==========================================================
    # Numeric columns
    # ==========================================================

    numeric_defaults = {
        "month": 1,
        "day": 1,
        "temperature": 25,
        "customers": 100,
        "online_orders": 20,
        "dine_in_orders": 80,
        "avg_order_value": 18,
        "marketing_spend": 500,
        "is_weekend": 0,
        "is_holiday": 0,
    }

    for col, default in numeric_defaults.items():
        df[col] = (
            pd.to_numeric(df[col], errors="coerce")
            .fillna(default)
        )

    df["is_weekend"] = df["is_weekend"].astype(int)
    df["is_holiday"] = df["is_holiday"].astype(int)

    # ==========================================================
    # Categorical columns
    # ==========================================================

    categorical_defaults = {
        "day_of_week": "Monday",
        "season": "Summer",
        "weather": "Sunny",
        "special_event": "No",
    }

    for col, default in categorical_defaults.items():
        df[col] = (
            df[col]
            .fillna(default)
            .astype(str)
        )

    # ==========================================================
    # Ensure every feature exists
    # ==========================================================

    for feature in FEATURE_COLUMNS:
        if feature not in df.columns:
            if feature in categorical_defaults:
                df[feature] = categorical_defaults[feature]
            else:
                df[feature] = 0

    return df[FEATURE_COLUMNS]


def preprocess_data(
    input_data,
    test_size=0.20,
    random_state=RANDOM_STATE,
):
    """
    Load dataset, prepare features, and split into train/test.
    """

    if isinstance(input_data, (str, Path)):
        df = pd.read_csv(input_data)
    else:
        df = input_data.copy()

    # ----------------------------------------------------------
    # Target column
    # ----------------------------------------------------------

    if TARGET_COLUMN not in df.columns:

        if "sales" in df.columns:
            df[TARGET_COLUMN] = df["sales"]

        elif "Total_Amount" in df.columns:
            df[TARGET_COLUMN] = df["Total_Amount"]

        else:
            raise ValueError(
                f"Target column '{TARGET_COLUMN}' not found."
            )

    df[TARGET_COLUMN] = (
        pd.to_numeric(df[TARGET_COLUMN], errors="coerce")
        .fillna(0)
    )

    features = prepare_features(df)

    target = df[TARGET_COLUMN]

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=test_size,
        random_state=random_state,
    )

    return X_train, X_test, y_train, y_test