from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from intents.classifier import IntentClassifier
from recommendation.food_recommender import FoodRecommender
from recommendation.popular_items import PopularItems
from ordering.order_status import OrderStatus


app = FastAPI(
    title="RestaurantAI Voice Recommendation API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = IntentClassifier()
recommender = FoodRecommender()
popular_items = PopularItems()
order_status = OrderStatus()


class RecommendationRequest(BaseModel):
    question: str
    preferences: dict | None = None


def extract_preferences(question: str):
    text = question.lower()
    preferences = {}

    if "spicy" in text:
        preferences["taste"] = "spicy"

    if "pizza" in text:
        preferences["food"] = "pizza"

    if "burger" in text:
        preferences["food"] = "burger"

    if "pasta" in text:
        preferences["food"] = "pasta"

    if "healthy" in text or "salad" in text:
        preferences["type"] = "healthy"

    return preferences


@app.get("/")
def home():
    return {
        "success": True,
        "message": "RestaurantAI Voice Recommendation API is running",
        "docs": "/docs"
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy",
        "service": "voice_recommendation"
    }


@app.post("/recommend")
def recommend_food(request: RecommendationRequest):
    question = request.question.strip()

    if not question:
        return {
            "success": False,
            "message": "Question is required"
        }

    intent = classifier.classify(question)

    if intent == "recommendation":
        preferences = request.preferences or extract_preferences(question)

        recommendations = recommender.recommend(preferences)

        return {
            "success": True,
            "intent": intent,
            "answer": "I recommend " + ", ".join(recommendations) + ".",
            "recommendations": recommendations
        }

    if intent == "order":
        return {
            "success": True,
            "intent": intent,
            "answer": "Ordering feature will be connected with your RestaurantAI order system soon.",
            "recommendations": []
        }

    if intent == "status":
        status = order_status.get_status()

        return {
            "success": True,
            "intent": intent,
            "answer": f"Your order status is: {status}.",
            "recommendations": []
        }

    if intent == "exit":
        return {
            "success": True,
            "intent": intent,
            "answer": "Goodbye. Have a nice day.",
            "recommendations": []
        }

    popular = popular_items.get_popular_items()

    return {
        "success": True,
        "intent": "fallback",
        "answer": "I can help you with food recommendations. Popular items are " + ", ".join(popular[:3]) + ".",
        "recommendations": popular[:3]
    }