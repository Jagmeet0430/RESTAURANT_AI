from pathlib import Path

import pandas as pd

from config.config import MODEL_PATH, PREDICTION_PATH, RAW_DATA_PATH
from src.generate_data import generate_dataset
from src.predict import predict_sales
from src.retrain_model import retrain_model


def main():
    raw_path = Path(RAW_DATA_PATH)
    if not raw_path.exists():
        print("Generating synthetic training data...")
        generate_dataset(raw_path)

    df = pd.read_csv(raw_path)
    print("Training and evaluating the sales model...")
    result = retrain_model(df, model_path=MODEL_PATH, metrics_path=Path(MODEL_PATH).with_suffix(".json"))

    future_df = df.tail(5).copy()
    future_df["date"] = pd.date_range(
        start=pd.Timestamp(df["date"].max()) + pd.Timedelta(days=1),
        periods=len(future_df),
        freq="D",
    )
    predictions = predict_sales(future_df, model_path=MODEL_PATH)

    prediction_df = future_df[["date"]].copy()
    prediction_df["predicted_sales"] = predictions
    prediction_df.to_csv(PREDICTION_PATH, index=False)

    print("ML pipeline completed successfully.")
    print(f"Model saved to {result['model_path']}")
    print(f"Metrics saved to {result['metrics_path']}")
    print(f"Saved predictions to {PREDICTION_PATH}")


if __name__ == "__main__":
    main()
