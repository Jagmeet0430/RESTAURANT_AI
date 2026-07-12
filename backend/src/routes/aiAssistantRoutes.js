import express from "express";
import { askAIAssistant } from "../controllers/aiAssistantController.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Assistant route is working",
  });
});

router.post("/", askAIAssistant);

export default router;
