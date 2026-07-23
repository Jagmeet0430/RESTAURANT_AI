import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { askAIAssistant } from "../controllers/aiAssistantController.js";
import { getRagSyncStatus, syncRagKnowledgeBase } from "../services/ragService.js";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Assistant route is working",
  });
});

router.get("/rag/status", authMiddleware, authorizeRoles(["admin", "staff"]), (req, res) => {
  res.json({
    success: true,
    data: getRagSyncStatus(),
  });
});

router.post("/rag/sync", authMiddleware, authorizeRoles(["admin"]), async (req, res) => {
  const result = await syncRagKnowledgeBase("manual_admin_request");

  res.status(result.ok ? 200 : 500).json({
    success: result.ok,
    data: {
      result,
      status: getRagSyncStatus(),
    },
  });
});

router.post("/", askAIAssistant);

export default router;
