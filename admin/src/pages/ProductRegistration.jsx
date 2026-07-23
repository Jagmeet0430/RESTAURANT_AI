import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  TextField,
} from "@mui/material";

import { PageHeader } from "../components/common/PageKit";
import api from "../services/api";

const ProductRegistration = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const scannedBarcode = location.state?.barcode || "";
  const openingQuantity = Number(location.state?.openingQuantity) || 1;

  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    barcode: scannedBarcode,
    name: "",
    category: "",
    brand: "",
    description: "",
    unit: "piece",
    purchasePrice: "",
    sellingPrice: "",
    quantity: openingQuantity,
    minimumStock: 5,
    supplierName: "",
    batchNumber: "",
    expiryDate: "",
    imageUrl: "",
  });

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  useEffect(() => {
    if (!scannedBarcode) return;

    const lookupProductDetails = async (barcode) => {
      try {
        setLookupLoading(true);

        const response = await api.get(
          `/products/catalogue/${encodeURIComponent(barcode)}`
        );

        const product = response.data.product;
        if (!product) return;

        setForm((current) => ({
          ...current,
          name: product.name || "",
          category: product.category || "",
          brand: product.brand || "",
          description: product.description || "",
          unit: product.unit || "piece",
          imageUrl: product.imageUrl || product.image_url || "",
        }));
      } catch (lookupError) {
        console.log("No catalogue details found");
      } finally {
        setLookupLoading(false);
      }
    };

    lookupProductDetails(scannedBarcode);
  }, [scannedBarcode]);

  const validateForm = () => {
    const purchasePrice = Number(form.purchasePrice);
    const sellingPrice = Number(form.sellingPrice);
    const quantity = Number(form.quantity);

    if (!form.barcode.trim()) return "Barcode is required";
    if (!form.name.trim()) return "Product name is required";
    if (!form.category.trim()) return "Category is required";
    if (!form.unit.trim()) return "Unit is required";
    if (!Number.isFinite(purchasePrice) || purchasePrice <= 0) {
      return "Purchase price must be greater than zero";
    }
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      return "Selling price must be greater than zero";
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "Opening quantity must be greater than zero";
    }
    if (!form.supplierName.trim()) return "Supplier is required";
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.post("/inventory/register-and-receive", {
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        brand: form.brand.trim() || null,
        description: form.description.trim() || null,
        unit: form.unit.trim(),
        purchasePrice: Number(form.purchasePrice),
        sellingPrice: Number(form.sellingPrice),
        quantity: Number(form.quantity),
        minimumStock: Number(form.minimumStock || 5),
        supplierName: form.supplierName.trim(),
        batchNumber: form.batchNumber.trim() || null,
        expiryDate: form.expiryDate || null,
        imageUrl: form.imageUrl.trim() || null,
      });

      navigate("/barcode-pos", {
        state: {
          successMessage: "Product registered and stock received successfully",
        },
      });
    } catch (submitError) {
      setError(
        submitError.response?.data?.message ||
          "Unable to register product"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Product Registration"
        title="Register Scanned Product"
        subtitle="Complete the product record before receiving opening stock."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {lookupLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Searching product catalogue...
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Barcode" value={form.barcode} disabled />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Product Name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Brand"
                  value={form.brand}
                  onChange={(event) => updateField("brand", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Category"
                  value={form.category}
                  onChange={(event) => updateField("category", event.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Description"
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Unit"
                  value={form.unit}
                  onChange={(event) => updateField("unit", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Purchase Price"
                  value={form.purchasePrice}
                  onChange={(event) => updateField("purchasePrice", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Selling Price"
                  value={form.sellingPrice}
                  onChange={(event) => updateField("sellingPrice", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  type="number"
                  label="Opening Quantity"
                  value={form.quantity}
                  onChange={(event) => updateField("quantity", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Minimum Stock"
                  value={form.minimumStock}
                  onChange={(event) => updateField("minimumStock", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  required
                  label="Supplier"
                  value={form.supplierName}
                  onChange={(event) => updateField("supplierName", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Batch Number"
                  value={form.batchNumber}
                  onChange={(event) => updateField("batchNumber", event.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Expiry Date"
                  InputLabelProps={{ shrink: true }}
                  value={form.expiryDate}
                  onChange={(event) => updateField("expiryDate", event.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Image URL"
                  value={form.imageUrl}
                  onChange={(event) => updateField("imageUrl", event.target.value)}
                />
              </Grid>

              <Grid item xs={12}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button type="submit" variant="contained" size="large" disabled={loading}>
                    {loading ? "Saving..." : "Register & Add Stock"}
                  </Button>
                  <Button onClick={() => navigate("/barcode-pos")}>Cancel</Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ProductRegistration;
