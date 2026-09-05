import express from "express";
import { authMiddleware, authorizeRoles } from "../middleware/index.js";

import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "../controllers/supplierController.js";

const router = express.Router();
const operatorRoles = authorizeRoles(["admin", "staff"]);

router.use(authMiddleware, operatorRoles);

router.get("/", getSuppliers);
router.post("/", createSupplier);
router.get("/:id", getSupplierById);
router.put("/:id", updateSupplier);
router.delete("/:id", deleteSupplier);

export default router;
