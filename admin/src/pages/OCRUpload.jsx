import { useState } from "react";
import axios from "axios";
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  LinearProgress,
  Stack,
  Card,
  CardContent,
  Chip,
  Grid,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AddIcon from "@mui/icons-material/Add";
import DoneIcon from "@mui/icons-material/Done";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import { PageHeader, StatCard, StatGrid } from "../components/common/PageKit";
import { API_BASE_URL } from "../services/api";
import { menuService, categoriesService } from "../services/menu";
import { publishMenuUpdated } from "../utils/menuEvents";

const uploadMenu = (formData, onUploadProgress) => {
  const token = localStorage.getItem("authToken");

  return axios.post(`${API_BASE_URL}/ocr/upload`, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    onUploadProgress,
    timeout: 180000,
  });
};

const OCRUpload = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({
    items_count: 0,
    categories_count: 0,
  });
  const [rawResponse, setRawResponse] = useState(null);
  const [addingIndex, setAddingIndex] = useState(null);
  const [addingAll, setAddingAll] = useState(false);
  const [addedItems, setAddedItems] = useState({});
  const [addErrors, setAddErrors] = useState({});
  const [error, setError] = useState("");

  const resetMenuSaveState = () => {
    setAddedItems({});
    setAddErrors({});
    setAddingIndex(null);
    setAddingAll(false);
  };

  const normalizeCategoryName = (value) => {
    return (value || "Uncategorized").trim() || "Uncategorized";
  };

  const normalizeMenuItem = (item, index, categoryId) => {
    const name = (item.name || item.item_name || item.menu_name || `OCR Item ${index + 1}`).trim();
    const price = Number(item.price || 0);

    if (!name) {
      throw new Error("Menu item name is required.");
    }

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`Enter a valid price before adding "${name}" to the menu.`);
    }

    return {
      name,
      category_id: categoryId,
      price,
      description: item.description || item.desc || "",
      veg_type: item.veg_type || "Veg",
      image_url: item.image_url || "",
      is_available: true,
      is_featured: false,
      preparation_time: item.preparation_time || 20,
      calories: item.calories || null,
      is_spicy: item.is_spicy === true,
    };
  };

  const getCategoryMap = async () => {
    const response = await categoriesService.getAllCategories();
    const categories = response?.success ? response.data || [] : [];

    return new Map(categories.map((category) => [category.name.toLowerCase(), category]));
  };

  const ensureCategory = async (categoryName, categoryMap) => {
    const normalizedName = normalizeCategoryName(categoryName);
    const key = normalizedName.toLowerCase();
    const existingCategory = categoryMap.get(key);

    if (existingCategory) {
      return existingCategory;
    }

    try {
      const response = await categoriesService.createCategory({
        name: normalizedName,
        description: "Created from OCR menu digitization.",
      });

      if (response?.success && response.data) {
        categoryMap.set(key, response.data);
        return response.data;
      }
    } catch (err) {
      if (err?.response?.status !== 409) {
        throw err;
      }
    }

    const refreshedMap = await getCategoryMap();
    const refreshedCategory = refreshedMap.get(key);

    if (!refreshedCategory) {
      throw new Error(`Could not find or create category "${normalizedName}".`);
    }

    categoryMap.set(key, refreshedCategory);
    return refreshedCategory;
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setMessage("");
    setError("");
    setSelectedFile(null);
    setPreviewUrl("");
    setItems([]);
    setSummary({
      items_count: 0,
      categories_count: 0,
    });
    setRawResponse(null);
    resetMenuSaveState();
    setProgress(0);

    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/bmp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Only JPG, JPEG, PNG, WEBP, and BMP images are allowed.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10 MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a menu image.");
      return;
    }

    try {
      setUploading(true);
      setProgress(0);
      setError("");
      setMessage("");
      setItems([]);
      setSummary({
        items_count: 0,
        categories_count: 0,
      });
      setRawResponse(null);
      resetMenuSaveState();

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await uploadMenu(
        formData,
        (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percent);
          }
        }
      );

      console.log("Complete OCR response:", response.data);

      const result = response?.data?.data?.data || response?.data?.data || response?.data || {};

      const extractedItems = Array.isArray(result.items) ? result.items : [];
      const uniqueCategories = [
        ...new Set(extractedItems.map((item) => item.category).filter(Boolean)),
      ];

      setItems(extractedItems);
      setSummary({
        items_count: extractedItems.length,
        categories_count: uniqueCategories.length,
      });
      setRawResponse(response.data);

      if (extractedItems.length === 0) {
        setMessage("Menu image uploaded, but no menu items were detected.");
        return;
      }

      const savedCount = await syncItemsToMenu(extractedItems);
      const failedCount = extractedItems.length - savedCount;

      if (savedCount > 0) {
        publishMenuUpdated();
      }

      setMessage(
        failedCount > 0
          ? `Menu image uploaded. ${savedCount} item${savedCount === 1 ? "" : "s"} synced to the menu; ${failedCount} need review.`
          : `Menu image uploaded and ${savedCount} item${savedCount === 1 ? "" : "s"} synced to the menu automatically.`
      );
    } catch (err) {
      console.error("OCR upload error:", err);
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err.message ||
          "Menu upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAddItemToMenu = async (item, index, sharedCategoryMap) => {
    setAddingIndex(index);
    setAddErrors((current) => {
      const next = { ...current };
      delete next[index];
      return next;
    });

    try {
      const categoryMap = sharedCategoryMap || (await getCategoryMap());
      const category = await ensureCategory(item.category, categoryMap);
      const payload = normalizeMenuItem(item, index, category.id);
      const response = await menuService.createItem(payload);

      if (!response?.success) {
        throw new Error(response?.message || "Failed to add item to menu.");
      }

      setAddedItems((current) => ({
        ...current,
        [index]: true,
      }));
      publishMenuUpdated();
      return true;
    } catch (err) {
      setAddErrors((current) => ({
        ...current,
        [index]:
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err.message ||
          "Failed to add item to menu.",
      }));
      return false;
    } finally {
      if (!sharedCategoryMap) {
        setAddingIndex(null);
      }
    }
  };

  const syncItemsToMenu = async (sourceItems = items) => {
    setAddingAll(true);
    setAddingIndex(null);
    setError("");

    let savedCount = 0;

    try {
      const categoryMap = await getCategoryMap();

      for (const [index, item] of sourceItems.entries()) {
        if (addedItems[index]) continue;

        setAddingIndex(index);
        const saved = await handleAddItemToMenu(item, index, categoryMap);
        if (saved) savedCount += 1;
      }

      return savedCount;
    } finally {
      setAddingAll(false);
      setAddingIndex(null);
    }
  };

  const handleAddAllToMenu = async () => {
    setMessage("");
    const savedCount = await syncItemsToMenu();

    if (savedCount > 0) {
      publishMenuUpdated();
      setMessage(`${savedCount} OCR item${savedCount === 1 ? "" : "s"} synced to the menu.`);
    }
  };

  const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;
  const addedCount = Object.values(addedItems).filter(Boolean).length;

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="Menu Digitization"
        title="OCR Menu Upload"
        subtitle="Upload a menu image, review extracted items, and convert paper menus into structured data."
        actions={
          <Button component="label" variant="contained" startIcon={<CloudUploadIcon />}>
            Choose Image
            <input type="file" hidden accept="image/*" onChange={handleFileChange} />
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Selected file" value={selectedFile ? "Ready" : "None"} helper={selectedFile?.name || "Choose a menu image"} icon={<RestaurantMenuIcon />} accent="#1976d2" />
        <StatCard label="Extracted items" value={summary.items_count} helper="Detected menu rows" icon={<RestaurantMenuIcon />} accent="#059669" />
        <StatCard label="Categories" value={summary.categories_count} helper="Detected sections" icon={<RestaurantMenuIcon />} accent="#7c3aed" />
      </StatGrid>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={600}>
            Upload Menu Image
          </Typography>

          <Button
            component="label"
            variant="outlined"
            startIcon={<CloudUploadIcon />}
            sx={{ width: "fit-content" }}
          >
            Choose Menu Image
            <input type="file" hidden accept="image/*" onChange={handleFileChange} />
          </Button>

          {selectedFile && (
            <Typography variant="body2">
              Selected file: <strong>{selectedFile.name}</strong>
            </Typography>
          )}

          {previewUrl && (
            <Box
              component="img"
              src={previewUrl}
              alt="Menu Preview"
              sx={{
                width: "100%",
                maxWidth: 420,
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: 2,
                border: "1px solid #ddd",
                p: 1,
              }}
            />
          )}

          {uploading && (
            <Box>
              <LinearProgress variant="determinate" value={progress} />
              <Typography variant="caption">{progress}% uploaded</Typography>
            </Box>
          )}

          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={handleUpload}
            disabled={uploading || !selectedFile}
            sx={{ width: "fit-content" }}
          >
            {uploading ? "Processing..." : "Upload & Digitize"}
          </Button>
        </Stack>
      </Paper>

      {rawResponse && (
        <Stack spacing={3}>
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                OCR Summary
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip label={`Items: ${items.length}`} color="primary" />
                <Chip label={`Categories: ${categoryCount}`} color="success" />
                <Chip label={`Added: ${addedCount}`} color="info" />
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6">
                  Digitized Menu Items
                </Typography>

                {items.length > 0 && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleAddAllToMenu}
                    disabled={addingAll || addedCount === items.length}
                    sx={{ width: { xs: "100%", sm: "fit-content" } }}
                  >
                    {addingAll ? "Syncing Items..." : "Sync All to Menu"}
                  </Button>
                )}
              </Stack>

              {items.length === 0 ? (
                <Alert severity="info">No menu items were detected.</Alert>
              ) : (
                <Grid container spacing={2}>
                  {items.map((item, index) => (
                    <Grid item xs={12} sm={6} md={4} key={`${item.name || "item"}-${index}`}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="h6">
                            {item.name || "Unnamed Item"}
                          </Typography>

                          <Chip
                            label={item.category || "Uncategorized"}
                            size="small"
                            color="primary"
                            sx={{ my: 1 }}
                          />

                          <Typography variant="h6" color="success.main">
                            Rs. {Number(item.price || 0).toFixed(2)}
                          </Typography>

                          {item.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
                              {item.description}
                            </Typography>
                          )}

                          {addErrors[index] && (
                            <Alert severity="error" sx={{ mt: 2 }}>
                              {addErrors[index]}
                            </Alert>
                          )}

                          <Button
                            variant={addedItems[index] ? "outlined" : "contained"}
                            color={addedItems[index] ? "success" : "primary"}
                            startIcon={addedItems[index] ? <DoneIcon /> : <AddIcon />}
                            onClick={() => handleAddItemToMenu(item, index)}
                            disabled={addingAll || addingIndex === index || addedItems[index]}
                            sx={{ mt: 2, width: "100%" }}
                          >
                            {addedItems[index]
                              ? "Added to Menu"
                              : addingAll
                                ? "Syncing..."
                              : addingIndex === index
                                ? "Adding..."
                                : "Sync to Menu"}
                          </Button>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>

          {import.meta.env.DEV && rawResponse && (
            <Card sx={{ mt: 3 }}>
              <CardContent>
                <Typography variant="h6">Developer Debug Response</Typography>

                <Box
                  component="pre"
                  sx={{
                    overflow: "auto",
                    maxHeight: 300,
                    backgroundColor: "#f5f5f5",
                    padding: 2,
                    borderRadius: 1,
                  }}
                >
                  {JSON.stringify(rawResponse, null, 2)}
                </Box>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}
    </Box>
  );
};

export default OCRUpload;
