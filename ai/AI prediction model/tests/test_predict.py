import pandas as pd

from src.predict import predict_sales


def test_predict_sales_returns_predictions():
    future_df = pd.DataFrame(
        [
            {
                "date": "2024-01-05",
                "weather": "Sunny",
                "temperature": 27,
                "customers": 145,
                "online_orders": 32,
                "dine_in_orders": 113,
                "avg_order_value": 20.5,
                "marketing_spend": 620,
                "special_event": "No",
            }
        ]
    )
    preds = predict_sales(future_df)
    assert len(preds) == 1
