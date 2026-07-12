class FoodRecommender:
    def __init__(self):
        self.menu = [
            {"name": "Spicy Pizza", "tags": ["spicy", "pizza", "cheesy"]},
            {"name": "Burger", "tags": ["burger", "savory"]},
            {"name": "Pasta", "tags": ["pasta", "creamy"]},
            {"name": "Salad", "tags": ["healthy", "fresh"]},
        ]

    def recommend(self, preferences=None):
        preferences = preferences or {}
        matches = []
        for item in self.menu:
            if any(tag in preferences.values() for tag in item["tags"]):
                matches.append(item["name"])
        return matches or [item["name"] for item in self.menu[:2]]
