class IntentClassifier:
    def __init__(self):
        self.intents = {
            "recommendation": [
                "recommend", "suggest", "try", "pizza", "burger",
                "pasta", "food", "meal", "spicy", "best", "eat"
            ],
            "order": [
                "order", "buy", "add", "purchase", "take", "want"
            ],
            "status": [
                "status", "track", "progress", "where", "delivery"
            ],
            "exit": [
                "exit", "quit", "bye", "goodbye"
            ]
        }

    def classify(self, text):
        text = text.lower()

        for intent, keywords in self.intents.items():
            for keyword in keywords:
                if keyword in text:
                    return intent

        return "unknown"