import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";

import { billsService } from "../../services/bills";

function formatCurrency(value) {
  return Number(value || 0).toFixed(2);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function labelOrderType(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "test") return "Printer test";
  if (normalized === "dine_in") return "Dine-in";
  if (normalized === "counter_sale") return "POS Counter";
  if (normalized === "delivery") return "Delivery";
  if (normalized === "pickup") return "Takeaway";
  return value || "-";
}

function paymentStatus(value) {
  return String(value || "Pending").toLowerCase() === "paid" ? "PAID" : "UNPAID";
}

function Receipt() {
  const { source, id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paperWidth, setPaperWidth] = useState("80");

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    billsService
      .getReceipt(source, id)
      .then((response) => {
        if (!isMounted) return;
        setReceipt(response.data);
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setError(loadError.response?.data?.message || loadError.message || "Receipt could not be loaded.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [source, id]);

  useEffect(() => {
    if (!receipt || searchParams.get("print") !== "1") return;
    const timeout = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timeout);
  }, [receipt, searchParams]);

  useEffect(() => {
    const savedWidth = String(receipt?.restaurant?.receipt_width || "");
    if (savedWidth === "58" || savedWidth === "80") {
      setPaperWidth(savedWidth);
    }
  }, [receipt]);

  const totals = receipt?.totals || {};
  const totalQuantity = useMemo(
    () => (receipt?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [receipt]
  );

  const printReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="receipt-page" data-paper-width={paperWidth}>
      <Stack className="receipt-actions" direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/bills")}>
          Back to Bills
        </Button>
        <Stack direction="row" spacing={1} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Paper</InputLabel>
            <Select label="Paper" value={paperWidth} onChange={(event) => setPaperWidth(event.target.value)}>
              <MenuItem value="80">80mm</MenuItem>
              <MenuItem value="58">58mm</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<LocalPrintshopIcon />} onClick={printReceipt}>
            Print Receipt
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" className="receipt-actions" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {receipt && (
        <main className="thermal-receipt">
          <section className="receipt-center">
            <h1>{receipt.restaurant?.restaurant_name || "RestaurantAI"}</h1>
            {receipt.restaurant?.address && <p>{receipt.restaurant.address}</p>}
            {receipt.restaurant?.phone && <p>Phone: {receipt.restaurant.phone}</p>}
            {receipt.restaurant?.gstin && <p>GSTIN: {receipt.restaurant.gstin}</p>}
          </section>

          <Divider className="receipt-divider" />
          <section className="receipt-center">
            <strong>
              {receipt.is_test_receipt
                ? "PRINT TEST RECEIPT"
                : paymentStatus(receipt.payment_status) === "PAID"
                  ? "TAX INVOICE"
                  : "BILL"}
            </strong>
          </section>
          <Divider className="receipt-divider" />

          <section className="receipt-meta">
            <div><span>Bill</span><strong>{receipt.bill_number}</strong></div>
            <div><span>Order</span><strong>{receipt.order_number || "-"}</strong></div>
            {receipt.token_number && <div><span>Token</span><strong>#{receipt.token_number}</strong></div>}
            {receipt.table_number && <div><span>Table</span><strong>{receipt.table_number}</strong></div>}
            <div><span>Type</span><strong>{labelOrderType(receipt.order_type)}</strong></div>
            <div><span>Date</span><strong>{formatDateTime(receipt.created_at)}</strong></div>
            {receipt.customer_name && <div><span>Name</span><strong>{receipt.customer_name}</strong></div>}
            {receipt.customer_phone && <div><span>Phone</span><strong>{receipt.customer_phone}</strong></div>}
          </section>

          <Divider className="receipt-divider" />
          <section className="receipt-items">
            <div className="receipt-item receipt-item-head">
              <span>Item</span>
              <span>Qty</span>
              <span>Rate</span>
              <span>Amount</span>
            </div>
            {(receipt.items || []).map((item, index) => (
              <div className="receipt-item" key={`${item.name}-${index}`}>
                <span>{item.name}</span>
                <span>{item.quantity}</span>
                <span>{formatCurrency(item.unit_price)}</span>
                <span>{formatCurrency(item.total_price)}</span>
              </div>
            ))}
          </section>

          <Divider className="receipt-divider" />
          <section className="receipt-meta">
            <div><span>Items</span><strong>{receipt.items?.length || 0}</strong></div>
            <div><span>Qty</span><strong>{totalQuantity}</strong></div>
            <div><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
            <div><span>Discount</span><strong>{formatCurrency(totals.discount)}</strong></div>
            <div><span>GST/Tax</span><strong>{formatCurrency(totals.tax)}</strong></div>
            <div><span>Packing</span><strong>{formatCurrency(totals.packing)}</strong></div>
          </section>

          <Divider className="receipt-divider" />
          <section className="receipt-total">
            <span>TOTAL</span>
            <strong>{formatCurrency(totals.grand_total)}</strong>
          </section>
          <Divider className="receipt-divider" />

          <section className="receipt-meta">
            <div><span>Payment</span><strong>{receipt.payment_method || "-"}</strong></div>
            <div><span>Status</span><strong>{paymentStatus(receipt.payment_status)}</strong></div>
            {receipt.paid_at && <div><span>Paid</span><strong>{formatDateTime(receipt.paid_at)}</strong></div>}
          </section>

          <section className="receipt-center receipt-footer">
            <p>{receipt.restaurant?.footer_text || "Thank You"}</p>
            <p>Visit Again</p>
          </section>
        </main>
      )}
    </Box>
  );
}

export default Receipt;
