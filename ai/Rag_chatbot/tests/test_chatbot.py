from src.chatbot_service import ChatbotService


def test_chatbot_service_initializes():
    service = ChatbotService()
    assert service is not None


def test_chatbot_empty_question():
    service = ChatbotService()
    response = service.chat("What is RestaurantAI?")
    assert "answer" in response
    assert "sources" in response