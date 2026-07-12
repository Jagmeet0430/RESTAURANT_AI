from fastapi import FastAPI
from pydantic import BaseModel
import pandas as pd

from src.predict import predict_sales

app = FastAPI(
    title="RestaurantAI Sales Prediction API",
    version="1.0"
)

class PredictionInput(BaseModel):
    month: int
    day: int
    day_of_week: str
    season: str
    is_weekend: int
    is_holiday: int
    weather: str
    temperature: float
    customers: int
    online_orders: int
    dine_in_orders: int
    avg_order_value: float
    marketing_spend: float
    special_event: str


@app.get("/")
def home():
    return {"message": "RestaurantAI Prediction API Running"}


@app.post("/predict")
def predict(data: PredictionInput):
    df = pd.DataFrame([data.dict()])
    prediction = predict_sales(df)
    return {
        "predicted_sales": float(prediction[0])
    }
