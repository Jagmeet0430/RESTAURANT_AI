import { useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  Fab,
  CircularProgress,
  Chip,
  Stack,
  Divider,
} from "@mui/material";

import SmartToyIcon from "@mui/icons-material/SmartToy";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
import StopIcon from "@mui/icons-material/Stop";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5001/api";

function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hello! I am RestaurantAI Assistant. Ask me about menu, admin guide, reports, or AI features.",
      sources: [],
    },
  ]);

  const speakText = (text) => {
    if (!("speechSynthesis" in window)) {
      console.warn("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const askChatbot = async () => {
    if (!question.trim()) return;

    const userQuestion = question;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: userQuestion,
        sources: [],
      },
    ]);

    setQuestion("");
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/ai-assistant`, {
        question: userQuestion,
      });

      const botAnswer = response.data.answer;

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: botAnswer,
          sources: response.data.sources || [],
        },
      ]);

      speakText(botAnswer);
    } catch (error) {
      console.error("Chatbot error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: "Chatbot service is not available. Please check backend and RAG API.",
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      askChatbot();
    }
  };

  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setQuestion(transcript);
      setListening(false);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };
  };

  return (
    <>
      {!open && (
        <Fab
          onClick={() => setOpen(true)}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 2000,
            width: 64,
            height: 64,
            background: "linear-gradient(135deg, #1976d2, #7b1fa2)",
            color: "white",
            boxShadow: "0 8px 24px rgba(25, 118, 210, 0.35)",
            "&:hover": {
              background: "linear-gradient(135deg, #1565c0, #6a1b9a)",
              transform: "scale(1.05)",
            },
            transition: "0.3s ease",
          }}
        >
          <SmartToyIcon sx={{ fontSize: 34 }} />
        </Fab>
      )}

      {open && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: {
              xs: "calc(100% - 32px)",
              sm: 390,
            },
            height: 540,
            zIndex: 2000,
            borderRadius: 3,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: "primary.main",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                RestaurantAI Assistant
              </Typography>
              <Typography variant="caption">
                AI-powered RAG Assistant
              </Typography>
            </Box>

            <IconButton
              size="small"
              onClick={() => {
                window.speechSynthesis.cancel();
                setOpen(false);
              }}
              sx={{ color: "white" }}
            >
              <CloseIcon />
            </IconButton>
          </Box>

          <Box
            sx={{
              flex: 1,
              p: 2,
              overflowY: "auto",
              bgcolor: "#f7f7f7",
            }}
          >
            {messages.map((message, index) => (
              <Box
                key={index}
                sx={{
                  display: "flex",
                  justifyContent:
                    message.role === "user" ? "flex-end" : "flex-start",
                  mb: 1.5,
                }}
              >
                <Box
                  sx={{
                    maxWidth: "85%",
                    px: 1.5,
                    py: 1,
                    borderRadius: 2,
                    bgcolor:
                      message.role === "user" ? "primary.main" : "white",
                    color:
                      message.role === "user" ? "white" : "text.primary",
                    boxShadow: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {message.text}
                    </Typography>
                    {message.role === "bot" && (
                      <IconButton
                        size="small"
                        onClick={() => speakText(message.text)}
                        sx={{ p: 0.3 }}
                        title="Speak answer"
                      >
                        <VolumeUpIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    )}
                  </Box>

                  {message.sources && message.sources.length > 0 && (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      flexWrap="wrap"
                      sx={{ mt: 1 }}
                    >
                      {message.sources.map((source, sourceIndex) => (
                        <Chip
                          key={sourceIndex}
                          label={source}
                          size="small"
                          sx={{ fontSize: "10px" }}
                        />
                      ))}
                    </Stack>
                  )}
                </Box>
              </Box>
            ))}

            {loading && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CircularProgress size={18} />
                <Typography variant="caption">
                  Thinking...
                </Typography>
              </Box>
            )}
          </Box>

          <Divider />

          <Box
            sx={{
              p: 1.5,
              display: "flex",
              gap: 1,
              bgcolor: "white",
              alignItems: "center",
            }}
          >
            <TextField
              fullWidth
              size="small"
              placeholder={listening ? "Listening..." : "Ask something..."}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
            />

            <IconButton
              color={listening ? "error" : "primary"}
              onClick={handleVoiceInput}
              disabled={loading}
              title="Voice Input"
            >
              {listening ? <StopIcon /> : <MicIcon />}
            </IconButton>

            <IconButton
              color="primary"
              onClick={askChatbot}
              disabled={loading}
              title="Send"
            >
              <SendIcon />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
}

export default ChatbotWidget;
