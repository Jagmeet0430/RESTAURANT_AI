import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CategoryIcon from "@mui/icons-material/Category";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";
import { categoriesService } from "../../services/menu";
import CategoryOverview from "../../components/categories/CategoryOverview";
import CategoryTable from "../../components/categories/CategoryTable";
import CategoryDialog from "../../components/categories/CategoryDialog";

function StatCard({ label, value, helper, icon }) {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 42,
            height: 42,
            borderRadius: 2,
            bgcolor: "#eef6ff",
            color: "#1976d2",
            display: "grid",
            placeItems: "center",
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 24, fontWeight: 900, lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#6b7280" }}>{helper}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function Categories() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("cards");

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await categoriesService.getAllCategories();
      if (response.success) {
        setCategories(response.data || []);
      } else {
        setError(response.message || "Failed to load categories");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return categories;

    return categories.filter((category) => {
      const text = `${category.name || ""} ${category.description || ""}`.toLowerCase();
      return text.includes(query);
    });
  }, [categories, searchTerm]);

  const totalItems = categories.reduce((sum, category) => sum + (category.item_count || 0), 0);
  const usedCategories = categories.filter((category) => (category.item_count || 0) > 0).length;

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingCategory(null);
  };

  const showSnackbar = (message) => {
    setSuccess(message);
    setSnackbarOpen(true);
    setTimeout(() => {
      setSnackbarOpen(false);
    }, 3000);
  };

  const handleSaveCategory = async (categoryData) => {
    try {
      setError("");

      let response;
      if (editingCategory) {
        response = await categoriesService.updateCategory(editingCategory.id, categoryData);
      } else {
        response = await categoriesService.createCategory(categoryData);
      }

      if (response.success) {
        showSnackbar(response.message || "Category saved successfully");
        handleCloseDialog();
        fetchCategories();
      } else {
        setError(response.message || "Failed to save category");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save category");
    }
  };

  const handleDeleteCategory = async (category) => {
    if ((category.item_count || 0) > 0) {
      setError("Move or delete this category's menu items before deleting the category.");
      return;
    }

    const confirmed = window.confirm(`Delete category '${category.name}'?`);
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      const response = await categoriesService.deleteCategory(category.id);
      if (response.success) {
        showSnackbar(response.message || "Category deleted successfully");
        setCategories(categories.filter((item) => item.id !== category.id));
      } else {
        setError(response.message || "Failed to delete category");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete category");
    }
  };

  const handleOpenMenu = () => {
    navigate("/menu");
  };

  return (
    <Box sx={{ padding: "20px" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900 }}>
            Category Management
          </Typography>
          <Typography color="text.secondary">
            Organize the menu into simple sections customers and staff can scan quickly.
          </Typography>
        </Box>
        <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleOpenAdd}>
          Add Category
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          label="Active categories"
          value={categories.length}
          helper={`${usedCategories} categories contain menu items`}
          icon={<CategoryIcon />}
        />
        <StatCard
          label="Menu items"
          value={totalItems}
          helper="Across all categories"
          icon={<Inventory2OutlinedIcon />}
        />
        <StatCard
          label="Current view"
          value={filteredCategories.length}
          helper={searchTerm ? "Matching your search" : "Visible categories"}
          icon={<SearchIcon />}
        />
      </Box>

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2,
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <TextField
            size="small"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search categories..."
            sx={{ maxWidth: { md: 420 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(event, nextView) => {
              if (nextView) setViewMode(nextView);
            }}
          >
            <ToggleButton value="cards">Card view</ToggleButton>
            <ToggleButton value="table">Table view</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
          <CircularProgress />
        </Box>
      ) : viewMode === "cards" ? (
        <CategoryOverview
          categories={filteredCategories}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteCategory}
          onOpenMenu={handleOpenMenu}
        />
      ) : (
        <CategoryTable
          categories={filteredCategories}
          onEdit={handleOpenEdit}
          onDelete={handleDeleteCategory}
        />
      )}

      <CategoryDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveCategory}
        editingCategory={editingCategory}
      />

      <Snackbar open={snackbarOpen} autoHideDuration={3000} onClose={() => setSnackbarOpen(false)}>
        <Alert severity="success" sx={{ width: "100%" }}>
          {success}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Categories;
