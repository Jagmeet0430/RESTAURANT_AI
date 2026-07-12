from pathlib import Path

import json
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def evaluate_model(model, X_test, y_test):
    """Calculate regression metrics for a fitted model."""
    predictions = model.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    metrics = {
        "mae": float(mean_absolute_error(y_test, predictions)),
        "rmse": float(mse**0.5),
        "r2": float(r2_score(y_test, predictions)),
    }
    return metrics


def save_metrics(metrics, output_path):
    """Persist evaluation metrics as JSON."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(metrics, handle, indent=2)
    return path
