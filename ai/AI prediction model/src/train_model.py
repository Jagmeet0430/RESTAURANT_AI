from pathlib import Path

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from config.config import MODEL_PATH, RANDOM_STATE
from src.preprocess import preprocess_data


def train_model(input_data, model_path=None, random_state=RANDOM_STATE):
    """Train a regression pipeline and optionally save it to disk."""
    if isinstance(input_data, (str, Path)):
        df = pd.read_csv(input_data)
    else:
        df = input_data.copy()

    X_train, _, y_train, _ = preprocess_data(df, random_state=random_state)

    numeric_features = [
        "month",
        "day",
        "temperature",
        "customers",
        "online_orders",
        "dine_in_orders",
        "avg_order_value",
        "marketing_spend",
        "is_weekend",
        "is_holiday",
    ]
    categorical_features = ["day_of_week", "season", "weather", "special_event"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline([("imputer", SimpleImputer(strategy="median"))]), numeric_features),
            (
                "cat",
                Pipeline(
                    [
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("onehot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", RandomForestRegressor(n_estimators=120, random_state=random_state)),
        ]
    )
    model.fit(X_train, y_train)

    if model_path is None:
        model_path = MODEL_PATH

    save_path = Path(model_path)
    save_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, save_path)
    return model
