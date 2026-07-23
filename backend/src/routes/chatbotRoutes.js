import express from "express";
import { askAIAssistant } from "../controllers/aiAssistantController.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Chatbot route is working",
  });
});

router.post("/", askAIAssistant);

export default router;
