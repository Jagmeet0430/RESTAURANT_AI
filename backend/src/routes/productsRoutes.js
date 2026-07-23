import express from "express";

import { pool } from "../config/database.js";

const router = express.Router();

router.get("/catalogue/:barcode", async (req, res, next) => {
  try {
    const barcode = String(req.params.barcode || "").trim();

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    const result = await pool.query(
      `
        SELECT
          barcode,
          name,
          category,
          brand,
          description,
          unit,
          image_url AS "imageUrl"
        FROM products
        WHERE TRIM(barcode) = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [barcode]
    );

    return res.status(200).json({
      success: true,
      product: result.rows[0] || null,
    });
  } catch (error) {
    if (["42P01", "42703"].includes(error.code)) {
      return res.status(200).json({
        success: true,
        product: null,
      });
    }

    next(error);
  }
});

export default router;
