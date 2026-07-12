from intents.classifier import IntentClassifier
from recommendation.food_recommender import FoodRecommender
from speech.speech_to_text import SpeechToText
from speech.text_to_speech import TextToSpeech


def run_demo():

    speech = SpeechToText()
    speaker = TextToSpeech()
    classifier = IntentClassifier()
    recommender = FoodRecommender()

    print("===================================")
    print(" Restaurant Voice Assistant Started")
    print(" Say 'exit' to quit")
    print("===================================")

    speaker.speak("Hello. Welcome to the Restaurant Voice Assistant.")

    while True:

        print("\nListening...")

        user_text = speech.listen()

        print("You:", user_text)

        if not user_text:
            continue

        intent = classifier.classify(user_text)
        print("Detected Intent:", intent)

        if intent == "recommendation":

            recommendations = recommender.recommend(
                preferences={"spicy": True}
            )

            response = (
                "I recommend "
                + ", ".join(recommendations)
                + "."
            )

        elif intent == "order":

            response = "Ordering feature will be added soon."

        elif intent == "status":

            response = "No active orders found."

        elif intent == "exit":

            response = "Goodbye. Have a nice day."

            print("Assistant:", response)
            speaker.speak(response)
            break

        else:

            response = (
                "Sorry, I didn't understand. "
                "Please try again."
            )

        print("Assistant:", response)

        speaker.speak(response)


if __name__ == "__main__":
    run_demo()