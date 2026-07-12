import express from "express";
import { authMiddleware } from "../middleware/index.js";
import { createCoupon, deleteCoupon, getAllCoupons, updateCoupon } from "../controllers/couponsController.js";

const router = express.Router();

router.get("/", authMiddleware, getAllCoupons);
router.post("/", authMiddleware, createCoupon);
router.put("/:id", authMiddleware, updateCoupon);
router.delete("/:id", authMiddleware, deleteCoupon);

export default router;
