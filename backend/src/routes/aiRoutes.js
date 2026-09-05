import express from "express";
import axios from "axios";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

router.post("/predict", authMiddleware, authorizeRoles(["admin", "staff"]), async (req, res, next) => {
  try {
    const payload = req.body;
    const response = await axios.post(`${AI_SERVICE_URL}/predict`, payload, {
      timeout: 10000,
    });

    return res.json(response.data);
  } catch (err) {
    return next(err);
  }
});

export default router;
