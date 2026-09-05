import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

import {
  checkOcrHealth,
  uploadMenuForOcr,
  getDigitizedItems,
  getDigitizedCategories,
} from "../controllers/ocrController.js";
import { fileConfig } from "../config/index.js";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

const router = express.Router();

const uploadDir = path.resolve(fileConfig.uploadDir, "ocr");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "upload";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${base}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(authMiddleware, authorizeRoles(["admin", "staff"]));

router.get("/health", checkOcrHealth);
router.post("/upload", upload.single("file"), uploadMenuForOcr);
router.get("/items", getDigitizedItems);
router.get("/categories", getDigitizedCategories);

export default router;
