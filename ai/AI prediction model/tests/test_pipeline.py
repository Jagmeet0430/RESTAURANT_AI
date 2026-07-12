import json
from pathlib import Path

import pandas as pd

from src.evalute_model import evaluate_model
from src.preprocess import preprocess_data
from src.retrain_model import retrain_model
from src.train_model import train_model


def _build_sample_data():
    rows = []
    for day in range(1, 21):
        weather = "Sunny" if day % 3 else "Rainy"
        temperature = 22 + (day % 5)
        customers = 100 + day * 3
        online_orders = 15 + (day % 7)
        dine_in_orders = customers - online_orders
        avg_order_value = 18 + (day % 4) * 0.5
        marketing_spend = 400 + day * 12
        special_event = "Yes" if day % 6 == 0 else "No"
        sales = 1800 + customers * 8 + (day % 4) * 100
        rows.append(
            {
                "date": f"2024-01-{day:02d}",
                "weather": weather,
                "temperature": temperature,
                "customers": customers,
                "online_orders": online_orders,
                "dine_in_orders": dine_in_orders,
                "avg_order_value": avg_order_value,
                "marketing_spend": marketing_spend,
                "special_event": special_event,
                "sales": sales,
            }
        )
    return pd.DataFrame(rows)


def test_evaluate_model_returns_metrics():
    sample_df = _build_sample_data()
    model = train_model(sample_df)
    _, X_test, _, y_test = preprocess_data(sample_df)
    metrics = evaluate_model(model, X_test, y_test)

    assert set(["mae", "rmse", "r2"]).issubset(metrics.keys())
    assert metrics["mae"] >= 0
    assert metrics["rmse"] >= 0


def test_retrain_model_saves_metrics_and_model(tmp_path):
    sample_df = _build_sample_data()
    model_path = tmp_path / "model.pkl"
    metrics_path = tmp_path / "metrics.json"

    result = retrain_model(sample_df, model_path=model_path, metrics_path=metrics_path)

    assert model_path.exists()
    assert metrics_path.exists()
    assert result["model_path"] == str(model_path)
    assert set(["mae", "rmse", "r2"]).issubset(result["metrics"].keys())

    payload = json.loads(metrics_path.read_text())
    assert payload["model_name"] == "sales_prediction_model"
