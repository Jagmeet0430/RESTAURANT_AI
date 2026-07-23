import express from "express";

import {
  createInventoryItem,
  deleteInventoryItem,
  getProductByBarcode,
  getInventoryItems,
  getInventorySummary,
  getInventoryTransactions,
  registerAndReceiveProduct,
  receiveStock,
  recordInventoryTransaction,
  updateInventoryItem,
} from "../controllers/inventoryController.js";
import { createSupplier, getSuppliers } from "../controllers/supplierController.js";

const router = express.Router();

router.get("/summary", getInventorySummary);
router.get("/transactions", getInventoryTransactions);
router.get("/barcode/:barcode", getProductByBarcode);
router.post("/receive", receiveStock);
router.post("/register-and-receive", registerAndReceiveProduct);
// Backward-compatible aliases for the previous admin screen calls.
router.get("/suppliers", getSuppliers);
router.post("/suppliers", createSupplier);
router.get("/", getInventoryItems);
router.post("/", createInventoryItem);
router.put("/:id", updateInventoryItem);
router.delete("/:id", deleteInventoryItem);
router.post("/:id/transactions", recordInventoryTransaction);

export default router;
