import axios from "axios";

export const askChatbot = async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Question is required",
      });
    }

    const response = await axios.post("http://127.0.0.1:8001/chat", {
      question,
    });

    return res.status(200).json({
      success: true,
      answer: response.data.answer,
      sources: response.data.sources,
    });
  } catch (error) {
    console.error("Chatbot service error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Chatbot service is not available. Start RAG chatbot on port 8001.",
    });
  }
};