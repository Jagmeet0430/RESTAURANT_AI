from pathlib import Path

import joblib
import pandas as pd

from config.config import MODEL_PATH
from src.preprocess import prepare_features
from src.train_model import train_model


def predict_sales(input_data, model=None, model_path=None):
    """Generate predictions for new or existing sales data."""
    if isinstance(input_data, (str, Path)):
        df = pd.read_csv(input_data)
    else:
        df = input_data.copy()

    if model is None:
        path = Path(model_path or MODEL_PATH)
        if path.exists():
            model = joblib.load(path)
        else:
            model = train_model(df, model_path=path)

    features = prepare_features(df)
    return model.predict(features)
