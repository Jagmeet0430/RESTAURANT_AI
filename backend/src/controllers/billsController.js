import { pool } from "../config/database.js";
import { successResponse, errorResponse, asyncHandler } from "../utils/index.js";
import {
  closeEndOfDay,
  getEndOfDaySummary,
  getReceipt,
  getOrderReceipt,
  getSettlementHistory,
  getTableDues,
  getTestReceipt,
  listBills,
  normalizeStaffPaymentMethod,
  payOrder,
  settleTable,
} from "../services/billingService.js";

function parsePositiveInt(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    const error = new Error(`Invalid ${label}`);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

export const getBills = asyncHandler(async (req, res) => {
  const bills = await listBills(pool, {
    today: req.query.today,
    range: req.query.range,
    status: req.query.status,
    method: req.query.method,
    search: req.query.search,
    limit: req.query.limit,
  });

  return successResponse(res, bills, "Bills retrieved successfully");
});

export const getBillById = asyncHandler(async (req, res) => {
  try {
    const billId = parsePositiveInt(req.params.id, "bill ID");
    const receipt = await getOrderReceipt(pool, billId, { lookup: "bill" });
    return successResponse(res, receipt, "Bill retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});

export const getReceiptBySource = asyncHandler(async (req, res) => {
  try {
    if (String(req.params.source || "").toLowerCase() === "test") {
      const receipt = await getTestReceipt(pool);
      return successResponse(res, receipt, "Test receipt generated successfully");
    }

    const receipt = await getReceipt(pool, req.params.source, req.params.id);
    return successResponse(res, receipt, "Receipt retrieved successfully");
  } catch (error) {
    return errorResponse(res, error.message, error.statusCode || 500);
  }
});

export const getTableSettlements = asyncHandler(async (req, res) => {
  const tables = await getTableDues(pool);
  return successResponse(res, tables, "Table dues retrieved successfully");
});

export const markOrderPaidFromBills = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const orderId = parsePositiveInt(req.params.orderId, "order ID");
    const method = normalizeStaffPaymentMethod(req.body.payment_method || req.body.paymentMethod);
    const expectedTotal = req.body.expected_total ?? req.body.expectedTotal;

    await client.query("BEGIN");
    const result = await payOrder(client, {
      orderId,
      paymentMethod: method.code,
      expectedTotal,
      createdBy: req.user?.id || null,
    });
    await client.query("COMMIT");

    return successResponse(
      res,
      {
        order: result.order,
        bill: result.bill,
        payment: result.payment,
        already_paid: result.alreadyPaid,
      },
      result.alreadyPaid ? "Order was already paid" : "Order marked paid successfully"
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message || "Unable to mark order paid", error.statusCode || 500);
  } finally {
    client.release();
  }
});

export const settleTableFromBills = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    const method = normalizeStaffPaymentMethod(req.body.payment_method || req.body.paymentMethod);
    const expectedTotal = req.body.expected_total ?? req.body.expectedTotal;

    await client.query("BEGIN");
    const result = await settleTable(client, {
      tableId: req.body.table_id ?? req.params.tableId,
      tableNumber: req.body.table_number,
      paymentMethod: method.code,
      expectedTotal,
      createdBy: req.user?.id || null,
    });
    await client.query("COMMIT");

    return successResponse(res, result, "Table settled successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message || "Unable to settle table", error.statusCode || 500);
  } finally {
    client.release();
  }
});

export const getBillingEndOfDay = asyncHandler(async (req, res) => {
  const summary = await getEndOfDaySummary(pool, { date: req.query.date });
  return successResponse(res, summary, "End-of-day billing summary retrieved successfully");
});

export const getBillingSettlementHistory = asyncHandler(async (req, res) => {
  const history = await getSettlementHistory(pool, { limit: req.query.limit });
  return successResponse(res, history, "End-of-day settlement history retrieved successfully");
});

export const closeBillingEndOfDay = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await closeEndOfDay(client, {
      date: req.body.business_date || req.body.date,
      actualCash: req.body.actual_cash ?? req.body.actualCash,
      closedBy: req.user?.id || null,
    });
    await client.query("COMMIT");

    return successResponse(
      res,
      result,
      result.alreadyClosed ? "End-of-day settlement was already closed" : "End-of-day settlement closed successfully",
      result.alreadyClosed ? 200 : 201
    );
  } catch (error) {
    await client.query("ROLLBACK");
    return errorResponse(res, error.message || "Unable to close end-of-day settlement", error.statusCode || 500);
  } finally {
    client.release();
  }
});
