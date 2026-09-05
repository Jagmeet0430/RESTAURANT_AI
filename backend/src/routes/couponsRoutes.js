import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";
import { createCoupon, deleteCoupon, getAllCoupons, updateCoupon } from "../controllers/couponsController.js";

const router = express.Router();
const adminOnly = authorizeRoles(["admin"]);

router.get("/", authMiddleware, adminOnly, getAllCoupons);
router.post("/", authMiddleware, adminOnly, createCoupon);
router.put("/:id", authMiddleware, adminOnly, updateCoupon);
router.delete("/:id", authMiddleware, adminOnly, deleteCoupon);

export default router;
