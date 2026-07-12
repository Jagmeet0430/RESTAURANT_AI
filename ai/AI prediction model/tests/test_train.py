import pandas as pd

from src.train_model import train_model


def test_train_model_returns_pipeline(tmp_path):
    sample_df = pd.DataFrame(
        [
            {
                "date": "2024-01-01",
                "weather": "Sunny",
                "temperature": 24,
                "customers": 120,
                "online_orders": 20,
                "dine_in_orders": 100,
                "avg_order_value": 18.5,
                "marketing_spend": 500,
                "special_event": "No",
                "sales": 2500,
            },
            {
                "date": "2024-01-02",
                "weather": "Rainy",
                "temperature": 18,
                "customers": 95,
                "online_orders": 15,
                "dine_in_orders": 80,
                "avg_order_value": 16.0,
                "marketing_spend": 400,
                "special_event": "Yes",
                "sales": 2100,
            },
            {
                "date": "2024-01-03",
                "weather": "Cloudy",
                "temperature": 21,
                "customers": 130,
                "online_orders": 25,
                "dine_in_orders": 105,
                "avg_order_value": 19.0,
                "marketing_spend": 550,
                "special_event": "No",
                "sales": 2600,
            },
            {
                "date": "2024-01-04",
                "weather": "Sunny",
                "temperature": 26,
                "customers": 140,
                "online_orders": 30,
                "dine_in_orders": 110,
                "avg_order_value": 20.0,
                "marketing_spend": 600,
                "special_event": "No",
                "sales": 2800,
            },
        ]
    )
    model = train_model(sample_df)
    assert model is not None
