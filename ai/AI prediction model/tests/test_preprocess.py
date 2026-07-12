import pandas as pd

from src.preprocess import preprocess_data


def test_preprocess_data_creates_train_test_splits(tmp_path):
    sample_path = tmp_path / "restaurant_sales.csv"
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
    sample_df.to_csv(sample_path, index=False)

    X_train, X_test, y_train, y_test = preprocess_data(sample_path, test_size=0.25, random_state=42)

    assert len(X_train) + len(X_test) == len(sample_df)
    assert len(y_train) == len(X_train)
    assert len(y_test) == len(X_test)
    assert {"month", "day", "day_of_week", "season", "is_weekend", "is_holiday", "weather", "temperature", "customers", "online_orders", "dine_in_orders", "avg_order_value", "marketing_spend", "special_event"}.issubset(set(X_train.columns))
