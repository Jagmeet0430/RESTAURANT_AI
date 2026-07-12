class ReviewAnalyzer:
    def analyze(self, review):
        review = review.lower()
        positive_words = ["good", "great", "love", "delicious", "excellent"]
        negative_words = ["bad", "poor", "awful", "disgusting", "terrible"]

        positive_score = sum(1 for word in positive_words if word in review)
        negative_score = sum(1 for word in negative_words if word in review)

        if positive_score > negative_score:
            return "positive"
        if negative_score > positive_score:
            return "negative"
        return "neutral"
