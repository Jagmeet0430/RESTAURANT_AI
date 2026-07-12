import express from "express";
import { askChatbot } from "../controllers/chatbotController.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Chatbot route is working",
  });
});

router.post("/", askChatbot);

export default router;