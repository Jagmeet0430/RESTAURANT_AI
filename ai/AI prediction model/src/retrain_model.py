from pathlib import Path

import json

from src.evalute_model import evaluate_model, save_metrics
from src.preprocess import preprocess_data
from src.train_model import train_model


def retrain_model(input_data, model_path=None, metrics_path=None, random_state=42):
    """Train a model, evaluate it, and save both the model and metrics."""
    model = train_model(input_data, model_path=model_path, random_state=random_state)
    _, X_test, _, y_test = preprocess_data(input_data, random_state=random_state)
    metrics = evaluate_model(model, X_test, y_test)

    if metrics_path is None:
        metrics_path = Path(model_path or "models/metrics.json")
    metrics_path = Path(metrics_path)
    save_metrics({**metrics, "model_name": "sales_prediction_model"}, metrics_path)

    return {
        "model_path": str(Path(model_path).resolve() if model_path else "models/sales_prediction_model.pkl"),
        "metrics_path": str(metrics_path.resolve()),
        "metrics": metrics,
    }
