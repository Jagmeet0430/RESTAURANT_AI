class WakeWordDetector:
    def __init__(self, wake_word="hello"):
        self.wake_word = wake_word

    def detect(self, text):
        return self.wake_word.lower() in text.lower()
