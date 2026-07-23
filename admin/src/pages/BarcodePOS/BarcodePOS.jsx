import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import BarcodeReaderIcon from "@mui/icons-material/BarcodeReader";
import DeleteIcon from "@mui/icons-material/Delete";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalPrintshopIcon from "@mui/icons-material/LocalPrintshop";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import RemoveIcon from "@mui/icons-material/Remove";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";
import { barcodeService } from "../../services/barcode";
import { inventoryService, supplierService } from "../../services/inventory";

const paymentMethods = ["Cash", "UPI", "Card"];
const emptyNewProductForm = {
  barcode: "",
  name: "",
  category: "",
  unit: "piece",
  purchasePrice: "",
  sellingPrice: "",
  minimumStock: "5",
  supplierId: "",
};

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function escapeReceiptText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatReceiptCurrency(value) {
  return Number(value || 0).toFixed(2);
}

const RECEIPT_WIDTH = 32;

function receiptDivider(character = "-") {
  return character.repeat(RECEIPT_WIDTH);
}

function cleanReceiptText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function fitReceiptText(value, width) {
  const text = cleanReceiptText(value);
  if (text.length <= width) return text.padEnd(width, " ");
  return `${text.slice(0, Math.max(0, width - 1))}.`;
}

function rightReceiptText(value, width) {
  const text = cleanReceiptText(value);
  if (text.length <= width) return text.padStart(width, " ");
  return text.slice(0, width);
}

function centerReceiptText(value) {
  const text = cleanReceiptText(value);
  if (text.length >= RECEIPT_WIDTH) return text.slice(0, RECEIPT_WIDTH);
  return `${" ".repeat(Math.floor((RECEIPT_WIDTH - text.length) / 2))}${text}`;
}

function formatReceiptWhole(value) {
  const numericValue = Number(value || 0);
  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2);
}

function receiptHeaderLine(label, value) {
  return `${fitReceiptText(label, 7)}: ${cleanReceiptText(value)}`;
}

function receiptCountLine(label, value) {
  return `${fitReceiptText(label, 5)} : ${cleanReceiptText(value)}`;
}

function receiptAmountLine(label, value) {
  return `${fitReceiptText(label, 14)}${rightReceiptText(value, 18)}`;
}

function receiptNetLine(label, value) {
  return `${fitReceiptText(label, 10)}${rightReceiptText(value, 22)}`;
}

function receiptPaymentLine(value) {
  return `Payment : ${cleanReceiptText(value)}`;
}

function receiptItemHeaderLine() {
  return [
    fitReceiptText("Item", 14),
    rightReceiptText("Qty", 5),
    rightReceiptText("SP", 6),
    rightReceiptText("Amt", 7),
  ].join("");
}

function receiptNarrowItemLine(item) {
  const quantity = Number(item.quantity || 0);
  const price = Number(item.price || 0);
  const total = quantity * price;

  return [
    fitReceiptText(item.name, 14),
    rightReceiptText(quantity, 5),
    rightReceiptText(formatReceiptWhole(price), 6),
    rightReceiptText(formatReceiptWhole(total), 7),
  ].join("");
}

function formatReceiptDate(date) {
  return date.toLocaleDateString("en-GB").replace(/\//g, "-");
}

function formatReceiptTime(date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).toUpperCase();
}

function normalizeReceiptFromBill(sourceBill, fallback = {}) {
  const lineItems = sourceBill?.line_items || fallback.items || [];
  const createdAt = sourceBill?.created_at ? new Date(sourceBill.created_at) : new Date();
  const totalAmount = Number(sourceBill?.total_amount ?? sourceBill?.totalAmount ?? fallback.totalAmount ?? 0);
  const amountPaid = Number(fallback.amountPaid ?? sourceBill?.amount_paid ?? totalAmount);

  return {
    restaurantName: fallback.restaurantName || "RESTAURANT NAME",
    restaurantAddress: fallback.restaurantAddress || "Sector 143, Noida",
    restaurantPhone: fallback.restaurantPhone || "+91 9878543210",
    gstin: fallback.gstin || "09XXXXXXXXXX",
    website: fallback.website || "",
    billNumber: sourceBill?.bill_number || sourceBill?.billNumber || fallback.billNumber || "",
    orderNumber: sourceBill?.order_number || fallback.orderNumber || "",
    tableName: sourceBill?.table_name || fallback.tableName || "",
    orderType: sourceBill?.order_type || fallback.orderType || "",
    cashier: sourceBill?.cashier || fallback.cashier || "Counter",
    date: fallback.date || formatReceiptDate(createdAt),
    time: fallback.time || formatReceiptTime(createdAt),
    customerName: sourceBill?.customer_name || fallback.customerName || "Walk-in Customer",
    customerPhone: sourceBill?.customer_phone || fallback.customerPhone || "",
    paymentMethod: sourceBill?.payment_method || fallback.paymentMethod || "Cash",
    items: lineItems.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      price: Number(item.price ?? item.unit_price ?? 0),
    })),
    subtotal: Number(sourceBill?.subtotal ?? fallback.subtotal ?? 0),
    gstAmount: Number(sourceBill?.tax ?? sourceBill?.gstAmount ?? fallback.gstAmount ?? 0),
    discount: Number(sourceBill?.discount ?? fallback.discount ?? 0),
    serviceCharge: Number(sourceBill?.service_charge ?? fallback.serviceCharge ?? 0),
    totalAmount,
    amountPaid,
    changeReturn: Number(fallback.changeReturn ?? sourceBill?.change_return ?? Math.max(0, amountPaid - totalAmount)),
  };
}

function printReceipt(sale) {
  const cgstAmount = Number((Number(sale.gstAmount || 0) / 2).toFixed(2));
  const sgstAmount = Number((Number(sale.gstAmount || 0) / 2).toFixed(2));
  const totalItems = (sale.items || []).length;
  const totalQuantity = (sale.items || []).reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
  const receiptText = [
    centerReceiptText(sale.restaurantName || "RESTAURANT NAME"),
    centerReceiptText(sale.restaurantAddress || "Sector 143, Noida"),
    centerReceiptText(`Phone: ${sale.restaurantPhone || "+91 9878543210"}`),
    centerReceiptText(`GSTIN: ${sale.gstin || "09XXXXXXXXXX"}`),
    "",
    centerReceiptText("TAX INVOICE"),
    receiptDivider("-"),
    receiptHeaderLine("Bill", sale.billNumber),
    receiptHeaderLine("Date", `${sale.date} ${sale.time}`),
    receiptHeaderLine("Cashier", sale.cashier || "Counter"),
    receiptDivider("-"),
    receiptItemHeaderLine(),
    receiptDivider("-"),
    ...(sale.items || []).map((item) => receiptNarrowItemLine(item)),
    receiptDivider("-"),
    receiptCountLine("Items", totalItems),
    receiptCountLine("Qty", totalQuantity),
    "",
    receiptAmountLine("Subtotal", formatReceiptCurrency(sale.subtotal)),
    receiptAmountLine("CGST", formatReceiptCurrency(cgstAmount)),
    receiptAmountLine("SGST", formatReceiptCurrency(sgstAmount)),
    receiptDivider("-"),
    receiptNetLine("NET", formatReceiptCurrency(sale.totalAmount)),
    receiptDivider("-"),
    "",
    receiptPaymentLine(sale.paymentMethod || "Cash"),
    "",
    centerReceiptText("Thank You"),
    "",
    centerReceiptText("Visit Again"),
  ].join("\n");
  const receiptHeightMm = Math.max(110, receiptText.split("\n").length * 4);
  const printRootId = "thermal-receipt-print-root";
  const printStyleId = "thermal-receipt-print-style";

  document.getElementById(printRootId)?.remove();
  document.getElementById(printStyleId)?.remove();

  const printRoot = document.createElement("div");
  printRoot.id = printRootId;
  printRoot.innerHTML = `<pre>${escapeReceiptText(receiptText)}</pre>`;

  const printStyle = document.createElement("style");
  printStyle.id = printStyleId;
  printStyle.textContent = `
    @page {
      size: 58mm ${receiptHeightMm}mm;
      margin: 0;
    }

    #${printRootId} {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 2147483647;
      width: 58mm;
      min-height: ${receiptHeightMm}mm;
      margin: 0;
      padding: 0;
      background: #fff;
      color: #000;
    }

    #${printRootId} pre {
      width: 54mm;
      margin: 0;
      padding: 2mm;
      font-family: "Courier New", monospace;
      font-size: 10px;
      font-weight: 700;
      line-height: 1.25;
      white-space: pre;
      background: #fff;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    @media print {
      html,
      body {
        width: 58mm !important;
        min-width: 58mm !important;
        max-width: 58mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }

      body > *:not(#${printRootId}) {
        display: none !important;
      }

      #${printRootId} {
        display: block !important;
        position: static !important;
      }
    }
  `;

  document.head.appendChild(printStyle);
  document.body.appendChild(printRoot);

  const cleanup = () => {
    printRoot.remove();
    printStyle.remove();
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.print();
      setTimeout(cleanup, 3000);
    });
  });
}

function normalizeLine(product) {
  const price = Number(
    product.sellingPrice ??
      product.selling_price ??
      product.price ??
      0
  );
  const availableStock = Number(
    product.quantity ??
      product.stock_quantity ??
      product.availableStock ??
      0
  );

  return {
    product_id: Number(product.id),
    name: product.name,
    barcode: product.barcode || product.scan_code || String(product.id),
    unit_price: price,
    quantity: 1,
    available_stock: availableStock,
    unit: product.unit || "pcs",
    stock_status:
      availableStock <= 0
        ? "Out of stock"
        : availableStock <= Number(product.minimumStock || product.minimum_stock || 0)
          ? "Low stock"
          : "In stock",
  };
}

function BarcodePOS() {
  const scanInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState("counter");
  const [barcode, setBarcode] = useState("");
  const [stockInQuantity, setStockInQuantity] = useState("1");
  const [stockInNotes, setStockInNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [loadingScan, setLoadingScan] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [message, setMessage] = useState({ severity: "info", text: "" });
  const [lastProduct, setLastProduct] = useState(null);
  const [lastStockIn, setLastStockIn] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newProductMode, setNewProductMode] = useState(false);
  const [newProductForm, setNewProductForm] = useState(emptyNewProductForm);
  const [suppliers, setSuppliers] = useState([]);
  const [bill, setBill] = useState(null);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supplierService
      .getSuppliers()
      .then((response) => {
        if (isMounted) {
          setSuppliers(response.data || []);
        }
      })
      .catch((error) => {
        console.error("Supplier loading failed:", error);
        if (isMounted) {
          setMessage({
            severity: "warning",
            text: "Suppliers could not be loaded. Add or refresh suppliers before registering a new product.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!location.state?.successMessage) return;

    setMode("stock-in");
    setMessage({
      severity: "success",
      text: location.state.successMessage,
    });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.pathname, location.state, navigate]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const tax = Number((subtotal * 0.05).toFixed(2));
    return {
      count: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      tax,
      total: Number((subtotal + tax).toFixed(2)),
    };
  }, [cart]);

  const focusScanner = () => {
    window.setTimeout(() => scanInputRef.current?.focus(), 0);
  };

  const addProductToCart = (product) => {
    const line = normalizeLine(product);

    if (line.available_stock <= 0) {
      setMessage({ severity: "warning", text: `${line.name} is out of stock.` });
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product_id === line.product_id);
      if (!existing) return [...current, line];

      if (existing.quantity + 1 > existing.available_stock) {
        setMessage({
          severity: "warning",
          text: `Only ${existing.available_stock} units of ${existing.name} are available.`,
        });
        return current;
      }

      return current.map((item) =>
        item.product_id === line.product_id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  };

  const scanForCounterSale = async (code) => {
    const response = await inventoryService.lookupBarcode(code);
    const product = response.product;
    const line = normalizeLine(product);
    setLastProduct({
      ...product,
      stock_quantity: line.available_stock,
      stock_status: line.stock_status,
      out_of_stock: line.available_stock <= 0,
    });

    if (line.available_stock <= 0) {
      setMessage({ severity: "warning", text: `${product.name} is out of stock.` });
      return;
    }

    addProductToCart(product);
    setMessage({ severity: "success", text: `${product.name} added to cart.` });
  };

  const lookupStockBarcode = async (rawBarcode) => {
    const code = String(rawBarcode).trim();
    if (!code) return;

    try {
      const response = await inventoryService.lookupBarcode(code);
      const product = response.product;

      setSelectedProduct(product);
      setLastProduct({
        ...product,
        stock_quantity: product.quantity,
        stock_status: Number(product.quantity || 0) <= Number(product.minimumStock || product.minimum_stock || 0)
          ? "Low stock"
          : "In stock",
      });
      setNewProductMode(false);
      setNewProductForm(emptyNewProductForm);
      setMessage({ severity: "success", text: `${product.name} found. Enter received quantity.` });
    } catch (error) {
      if (error.response?.status === 404) {
        setSelectedProduct(null);
        setLastProduct(null);
        setNewProductMode(true);
        setNewProductForm({
          ...emptyNewProductForm,
          barcode: code,
        });
        navigate("/products/register", {
          state: {
            barcode: code,
            openingQuantity: Number(stockInQuantity || 1),
            source: "barcode-scanner",
          },
        });
        return;
      }

      throw error;
    }
  };

  const receiveStock = async () => {
    const code = String(barcode || newProductForm.barcode || selectedProduct?.barcode || "").trim();
    const quantity = Number(stockInQuantity);

    if (!code) {
      setMessage({ severity: "warning", text: "Scan or enter a barcode first." });
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setMessage({ severity: "warning", text: "Quantity must be greater than zero." });
      return;
    }

    if (newProductMode) {
      const missingFields = [];
      if (!newProductForm.name.trim()) missingFields.push("product name");
      if (!newProductForm.category.trim()) missingFields.push("category");
      if (!newProductForm.unit.trim()) missingFields.push("unit");
      if (!Number.isFinite(Number(newProductForm.purchasePrice)) || Number(newProductForm.purchasePrice) <= 0) {
        missingFields.push("purchase price");
      }
      if (!Number.isFinite(Number(newProductForm.sellingPrice)) || Number(newProductForm.sellingPrice) <= 0) {
        missingFields.push("selling price");
      }
      if (!newProductForm.supplierId) missingFields.push("supplier");

      if (missingFields.length > 0) {
        setMessage({
          severity: "warning",
          text: `Enter ${missingFields.join(", ")} before saving this new product.`,
        });
        return;
      }
    }

    const payload = {
      barcode: code,
      quantity,
      notes: stockInNotes.trim() || null,
      ...(newProductMode
        ? {
            name: newProductForm.name,
            category: newProductForm.category || null,
            unit: newProductForm.unit || "piece",
            purchasePrice: Number(newProductForm.purchasePrice || 0),
            sellingPrice: Number(newProductForm.sellingPrice || 0),
            minimumStock: Number(newProductForm.minimumStock || 5),
            supplierId: Number(newProductForm.supplierId),
          }
        : {}),
    };

    const response = await inventoryService.receiveStock(payload);

    setLastStockIn(response);
    setSelectedProduct(response.product);
    setLastProduct({
      ...response.product,
      stock_quantity: response.product.quantity,
      stock_status: Number(response.product.quantity || 0) <= Number(response.product.minimumStock || response.product.minimum_stock || 0)
        ? "Low stock"
        : "In stock",
    });
    setNewProductMode(false);
    setNewProductForm(emptyNewProductForm);
    setBarcode("");
    setStockInQuantity("1");
    setStockInNotes("");
    setMessage({ severity: "success", text: response.message || "Stock updated." });
  };

  const scanProduct = async () => {
    const code = barcode.trim();
    if (!code) return;

    try {
      setLoadingScan(true);
      setMessage({ severity: "info", text: "" });

      if (mode === "stock-in") {
        await lookupStockBarcode(code);
      } else {
        await scanForCounterSale(code);
        setBarcode("");
      }
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Could not scan product.",
      });
    } finally {
      setLoadingScan(false);
      focusScanner();
    }
  };

  const updateQuantity = (productId, delta) => {
    setCart((current) =>
      current
        .map((item) => {
          if (item.product_id !== productId) return item;

          const nextQuantity = Math.max(0, item.quantity + delta);
          if (nextQuantity > item.available_stock) {
            setMessage({
              severity: "warning",
              text: `Only ${item.available_stock} units of ${item.name} are available.`,
            });
            return item;
          }

          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const clearScanner = () => {
    setCart([]);
    setBill(null);
    setBillOpen(false);
    setLastProduct(null);
    setLastStockIn(null);
    setSelectedProduct(null);
    setNewProductMode(false);
    setNewProductForm(emptyNewProductForm);
    setBarcode("");
    setMessage({ severity: "info", text: "" });
    focusScanner();
  };

  const checkout = async () => {
    if (cart.length === 0) {
      setMessage({ severity: "warning", text: "Add at least one product before billing." });
      focusScanner();
      return;
    }

    try {
      setCheckingOut(true);
      setMessage({ severity: "info", text: "" });
      const checkoutCart = cart.map((item) => ({ ...item }));
      const checkoutCustomerName = customerName.trim();
      const checkoutCustomerPhone = customerPhone.trim();

      const response = await barcodeService.createCounterSale({
        paymentMethod,
        customerName: checkoutCustomerName || null,
        customerPhone: checkoutCustomerPhone || null,
        items: checkoutCart.map((item) => ({
          productId: item.product_id,
          quantity: item.quantity,
        })),
      });

      const completedBill = response.data?.bill || null;
      setBill(completedBill);
      setBillOpen(true);
      printReceipt(
        normalizeReceiptFromBill(completedBill, {
          billNumber: response.billNumber,
          customerName: checkoutCustomerName,
          customerPhone: checkoutCustomerPhone,
          paymentMethod,
          items: checkoutCart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.unit_price,
          })),
          subtotal: response.subtotal,
          gstAmount: response.gstAmount,
          totalAmount: response.totalAmount,
        })
      );
      setCart([]);
      setBarcode("");
      setCustomerName("");
      setCustomerPhone("");
      setMessage({ severity: "success", text: response.message || "Sale completed." });
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Could not complete sale.",
      });
    } finally {
      setCheckingOut(false);
      focusScanner();
    }
  };

  const printBill = () => {
    if (!bill) return;
    printReceipt(normalizeReceiptFromBill(bill));
  };

  const submitStockReceipt = async () => {
    try {
      setLoadingScan(true);
      setMessage({ severity: "info", text: "" });
      await receiveStock();
    } catch (error) {
      setMessage({
        severity: "error",
        text: error.response?.data?.message || error.message || "Unable to receive stock.",
      });
    } finally {
      setLoadingScan(false);
      focusScanner();
    }
  };

  const updateBarcode = (value) => {
    setBarcode(value);
    if (message.text) {
      setMessage({ severity: "info", text: "" });
    }

    if (mode !== "stock-in") return;

    const code = value.trim();
    const activeBarcode = selectedProduct?.barcode || newProductForm.barcode;
    if (activeBarcode && code !== activeBarcode) {
      setSelectedProduct(null);
      setLastProduct(null);
      setNewProductMode(false);
      setNewProductForm(emptyNewProductForm);
      setLastStockIn(null);
    }
  };

  const stockReceiptReady =
    mode === "stock-in" &&
    (
      (selectedProduct && barcode.trim() === selectedProduct.barcode) ||
      (newProductMode && barcode.trim() === newProductForm.barcode)
    );
  const modeTitle = mode === "stock-in" ? "Stock-In Mode" : "Counter Sale Mode";
  const scanButtonLabel = mode === "stock-in"
    ? stockReceiptReady
      ? newProductMode
        ? "Create Product & Receive Stock"
        : "Receive Stock"
      : "Search Barcode"
    : "Add to Cart";

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Barcode Scanner"
        title="Barcode Scanner"
        subtitle="Use one scanner for supplier receipts and walk-in counter sales."
        actions={
          <>
            <Tooltip title="Reset scanner">
              <IconButton onClick={clearScanner}>
                <RestartAltIcon />
              </IconButton>
            </Tooltip>
            {mode === "counter" && (
              <Button
                variant="contained"
                startIcon={checkingOut ? <CircularProgress color="inherit" size={16} /> : <PointOfSaleIcon />}
                disabled={checkingOut || cart.length === 0}
                onClick={checkout}
              >
                Generate Bill
              </Button>
            )}
          </>
        }
      />

      {message.text && (
        <Alert severity={message.severity} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <SectionCard title={modeTitle} sx={{ mb: 2 }}>
        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            value={mode}
            onChange={(event, nextMode) => {
              if (!nextMode) return;
              setMode(nextMode);
              setSelectedProduct(null);
              setLastProduct(null);
              setLastStockIn(null);
              setNewProductMode(false);
              setNewProductForm(emptyNewProductForm);
              setMessage({ severity: "info", text: "" });
              focusScanner();
            }}
          >
            <ToggleButton value="stock-in">
              <Inventory2Icon sx={{ fontSize: 18, mr: 0.75 }} />
              Stock-In Mode
            </ToggleButton>
            <ToggleButton value="counter">
              <PointOfSaleIcon sx={{ fontSize: 18, mr: 0.75 }} />
              Counter Sale Mode
            </ToggleButton>
          </ToggleButtonGroup>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: mode === "stock-in" ? "minmax(0, 1fr) 150px minmax(180px, 0.35fr)" : "minmax(0, 1fr) auto" },
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <TextField
              inputRef={scanInputRef}
              autoFocus
              label="Scan barcode"
              value={barcode}
              onChange={(event) => updateBarcode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  scanProduct();
                }
              }}
              fullWidth
            />
            {mode === "stock-in" && (
              <TextField
                label="Quantity"
                type="number"
                value={stockInQuantity}
                onChange={(event) => setStockInQuantity(event.target.value)}
                fullWidth
              />
            )}
            <Button
              variant="contained"
              startIcon={loadingScan ? <CircularProgress color="inherit" size={16} /> : <BarcodeReaderIcon />}
              onClick={stockReceiptReady ? submitStockReceipt : scanProduct}
              disabled={loadingScan || (mode === "counter" && !barcode.trim())}
              sx={{ minHeight: 54 }}
            >
              {scanButtonLabel}
            </Button>
          </Box>

          {mode === "stock-in" && (
            <TextField
              label="Stock-in notes"
              value={stockInNotes}
              onChange={(event) => setStockInNotes(event.target.value)}
              fullWidth
            />
          )}

          {newProductMode && (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
                gap: 1.5,
              }}
            >
              <TextField
                label="Barcode"
                value={newProductForm.barcode}
                disabled
                fullWidth
              />
              <TextField
                label="Product name"
                value={newProductForm.name}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, name: event.target.value }))
                }
                fullWidth
                required
              />
              <TextField
                label="Category"
                value={newProductForm.category}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, category: event.target.value }))
                }
                fullWidth
                required
              />
              <TextField
                label="Unit"
                value={newProductForm.unit}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, unit: event.target.value }))
                }
                fullWidth
                required
              />
              <FormControl fullWidth required>
                <InputLabel>Supplier</InputLabel>
                <Select
                  label="Supplier"
                  value={newProductForm.supplierId}
                  onChange={(event) =>
                    setNewProductForm((form) => ({ ...form, supplierId: event.target.value }))
                  }
                >
                  {suppliers.map((supplier) => (
                    <MenuItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Purchase price"
                type="number"
                value={newProductForm.purchasePrice}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, purchasePrice: event.target.value }))
                }
                fullWidth
                required
              />
              <TextField
                label="Selling price"
                type="number"
                value={newProductForm.sellingPrice}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, sellingPrice: event.target.value }))
                }
                fullWidth
                required
              />
              <TextField
                label="Minimum stock"
                type="number"
                value={newProductForm.minimumStock}
                onChange={(event) =>
                  setNewProductForm((form) => ({ ...form, minimumStock: event.target.value }))
                }
                fullWidth
              />
            </Box>
          )}

          {lastProduct && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
              <Typography sx={{ fontWeight: 900 }}>{lastProduct.name}</Typography>
              <Chip
                size="small"
                label={lastProduct.stock_status}
                color={lastProduct.out_of_stock ? "error" : lastProduct.stock_status === "Low stock" ? "warning" : "success"}
                variant="outlined"
              />
              {lastProduct.stock_quantity !== null && lastProduct.stock_quantity !== undefined && (
                <Typography color="text.secondary" variant="body2">
                  Stock {Number(lastProduct.stock_quantity).toFixed(2)} {lastProduct.unit || "pcs"}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </SectionCard>

      {mode === "stock-in" ? (
        <SectionCard title="Last Stock-In">
          {lastStockIn ? (
            <Stack spacing={1}>
              <Typography sx={{ fontWeight: 900 }}>{lastStockIn.product?.name}</Typography>
              <Typography color="text.secondary">
                Received {Number(lastStockIn.stockMovement?.quantityReceived || 0).toFixed(2)} {lastStockIn.product?.unit || "pcs"}
              </Typography>
              <Typography color="text.secondary">
                Current stock {Number(lastStockIn.stockMovement?.quantityAfter || lastStockIn.product?.quantity || 0).toFixed(2)} {lastStockIn.product?.unit || "pcs"}
              </Typography>
            </Stack>
          ) : (
            <Typography color="text.secondary">No stock-in scan recorded yet.</Typography>
          )}
        </SectionCard>
      ) : (
        <>
          <StatGrid>
            <StatCard
              label="Cart items"
              value={totals.count}
              helper={`${cart.length} product line${cart.length === 1 ? "" : "s"}`}
              icon={<AddShoppingCartIcon />}
              accent="#1976d2"
            />
            <StatCard
              label="Subtotal"
              value={formatCurrency(totals.subtotal)}
              helper="Before GST"
              icon={<PointOfSaleIcon />}
              accent="#059669"
            />
            <StatCard
              label="Bill total"
              value={formatCurrency(totals.total)}
              helper="Includes 5% GST"
              icon={<BarcodeReaderIcon />}
              accent="#dc6b19"
            />
          </StatGrid>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.45fr) minmax(340px, 0.55fr)" },
              gap: 2,
              alignItems: "start",
            }}
          >
            <SectionCard
              title="Cart"
              actions={
                <Button variant="text" color="inherit" onClick={clearScanner} disabled={cart.length === 0}>
                  Clear
                </Button>
              }
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                      <TableCell sx={{ fontWeight: 900 }}>Product</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>Barcode</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>Price</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900 }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {cart.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                          <Typography color="text.secondary">No scanned products yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cart.map((item) => (
                        <TableRow key={item.product_id} hover>
                          <TableCell>
                            <Typography fontWeight={900}>{item.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {item.stock_status}
                            </Typography>
                          </TableCell>
                          <TableCell>{item.barcode}</TableCell>
                          <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                              <IconButton size="small" onClick={() => updateQuantity(item.product_id, -1)}>
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <Typography sx={{ minWidth: 28, fontWeight: 900 }}>{item.quantity}</Typography>
                              <IconButton size="small" onClick={() => updateQuantity(item.product_id, 1)}>
                                <AddShoppingCartIcon fontSize="small" />
                              </IconButton>
                            </Stack>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(item.unit_price * item.quantity)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Remove">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setCart((current) => current.filter((line) => line.product_id !== item.product_id))}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />
              <Stack spacing={0.75} sx={{ maxWidth: 360, ml: "auto" }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Subtotal</Typography>
                  <Typography fontWeight={900}>{formatCurrency(totals.subtotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">GST</Typography>
                  <Typography fontWeight={900}>{formatCurrency(totals.tax)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontSize: 20, fontWeight: 900 }}>Total</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 900 }}>{formatCurrency(totals.total)}</Typography>
                </Stack>
              </Stack>
            </SectionCard>

            <SectionCard title="Payment">
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>Payment method</InputLabel>
                  <Select
                    label="Payment method"
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value)}
                  >
                    {paymentMethods.map((method) => (
                      <MenuItem key={method} value={method}>
                        {method}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Customer name"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Customer phone"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  fullWidth
                />
              </Stack>
            </SectionCard>
          </Box>
        </>
      )}

      <Dialog open={billOpen} onClose={() => setBillOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Generated Bill</DialogTitle>
        <DialogContent>
          {bill && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography sx={{ fontWeight: 900 }}>{bill.bill_number}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(bill.created_at).toLocaleString("en-IN")}
                </Typography>
              </Box>
              <Divider />
              {(bill.line_items || []).map((item) => (
                <Stack key={`${item.product_id}-${item.name}`} direction="row" justifyContent="space-between" spacing={2}>
                  <Typography>
                    {item.quantity} x {item.name}
                  </Typography>
                  <Typography fontWeight={800}>{formatCurrency(item.total_price)}</Typography>
                </Stack>
              ))}
              <Divider />
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">Subtotal</Typography>
                  <Typography fontWeight={900}>{formatCurrency(bill.subtotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography color="text.secondary">GST</Typography>
                  <Typography fontWeight={900}>{formatCurrency(bill.tax)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography sx={{ fontWeight: 900 }}>Total</Typography>
                  <Typography sx={{ fontWeight: 900 }}>{formatCurrency(bill.total_amount)}</Typography>
                </Stack>
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBillOpen(false)}>Close</Button>
          <Button variant="contained" startIcon={<LocalPrintshopIcon />} onClick={printBill}>
            Print
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BarcodePOS;
