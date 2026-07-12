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

const router = express.Router();

const uploadDir = "uploads/ocr";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
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

router.get("/health", checkOcrHealth);
router.post("/upload", upload.single("file"), uploadMenuForOcr);
router.get("/items", getDigitizedItems);
router.get("/categories", getDigitizedCategories);

export default router;
