from intents.classifier import IntentClassifier


class IntentRouter:
    def __init__(self, classifier=None):
        self.classifier = classifier or IntentClassifier()

    def route(self, text):
        intent = self.classifier.classify(text)
        return {
            "recommendation": "recommendation_handler",
            "order": "order_handler",
            "status": "status_handler",
        }.get(intent, "fallback_handler")
