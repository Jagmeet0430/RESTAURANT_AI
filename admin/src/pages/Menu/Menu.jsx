import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Stack,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchBar from "../../components/menu/SearchBar";
import CategoryFilter from "../../components/menu/CategoryFilter";
import MenuCatalog from "../../components/menu/MenuCatalog";
import MenuTable from "../../components/menu/MenuTable";
import AddFoodDialog from "../../components/menu/AddFoodDialog";
import { menuService, categoriesService } from "../../services/menu";

function Menu() {
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedAvailability, setSelectedAvailability] = useState("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [viewMode, setViewMode] = useState("catalog");

  // Fetch menu items and categories on mount
  useEffect(() => {
    fetchMenuAndCategories();
  }, [selectedCategory, searchTerm, selectedAvailability]);

  const fetchMenuAndCategories = async () => {
    try {
      setLoading(true);
      setError("");

      const categoriesRes = await categoriesService.getAllCategories();
      const availableCategories = categoriesRes.success ? categoriesRes.data || [] : [];
      setCategories(availableCategories);

      const filters = {};
      if (selectedCategory !== "All") {
        const category = availableCategories.find((c) => c.name === selectedCategory);
        if (category) filters.category = category.id;
      }
      if (searchTerm) filters.search = searchTerm;
      if (selectedAvailability !== "All") {
        filters.available = selectedAvailability === "Available" ? "true" : "false";
      }

      const menuRes = await menuService.getAllItems(filters);
      if (menuRes.success) {
        setMenuItems(menuRes.data || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch menu items");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFood = async (formData) => {
    try {
      setError("");
      let response;

      if (editingFood) {
        response = await menuService.updateItem(editingFood.id, formData);
        if (response.success) {
          setSuccess("Menu item updated successfully");
        }
      } else {
        response = await menuService.createItem(formData);
        if (response.success) {
          setSuccess("Menu item created successfully");
        }
      }

      if (response?.success) {
        await fetchMenuAndCategories();
        setDialogOpen(false);
        setEditingFood(null);
        setSnackbarOpen(true);
        setTimeout(() => setSnackbarOpen(false), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save menu item");
    }
  };

  const handleDeleteFood = async (id) => {
    try {
      const response = await menuService.deleteItem(id);
      if (response.success) {
        setMenuItems(menuItems.filter((item) => item.id !== id));
        setSuccess("Menu item deleted successfully");
        setSnackbarOpen(true);
        setTimeout(() => setSnackbarOpen(false), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete menu item");
    }
  };

  const handleEditFood = (item) => {
    setEditingFood(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingFood(null);
  };

  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setPage(0);
  };

  const descendingComparator = (a, b, orderBy) => {
    const valueA = a[orderBy] ?? "";
    const valueB = b[orderBy] ?? "";

    if (typeof valueA === "string" && typeof valueB === "string") {
      return valueB.localeCompare(valueA, undefined, { sensitivity: "base" });
    }

    if (valueB < valueA) return -1;
    if (valueB > valueA) return 1;
    return 0;
  };

  const getComparator = (order, orderBy) => {
    return order === "desc"
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const stableSort = (array, comparator) => {
    const stabilized = array.map((item, index) => [item, index]);
    stabilized.sort((a, b) => {
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilized.map((item) => item[0]);
  };

  const handleRequestSort = (property) => {
    const isAsc = sortBy === property && sortDirection === "asc";
    setSortBy(property);
    setSortDirection(isAsc ? "desc" : "asc");
  };

  const sortedMenuItems = stableSort(menuItems, getComparator(sortDirection, sortBy));
  const paginatedMenuItems = sortedMenuItems.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading && menuItems.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ padding: "20px" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 3,
        }}
      >
        <h1 style={{ margin: 0 }}>Menu Management</h1>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Food Item
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <SearchBar searchTerm={searchTerm} onSearchChange={handleSearchChange} />
        <FormControl sx={{ minWidth: 180 }} size="small">
          <InputLabel>Availability</InputLabel>
          <Select
            value={selectedAvailability}
            label="Availability"
            onChange={(event) => {
              setSelectedAvailability(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="All">All</MenuItem>
            <MenuItem value="Available">Available</MenuItem>
            <MenuItem value="OutOfStock">Out of Stock</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={(category) => {
          setSelectedCategory(category);
          setPage(0);
        }}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={viewMode}
          onChange={(event, nextView) => {
            if (nextView) setViewMode(nextView);
          }}
        >
          <ToggleButton value="catalog">Catalog view</ToggleButton>
          <ToggleButton value="table">Table view</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === "catalog" ? (
        <MenuCatalog
          items={sortedMenuItems}
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={(category) => {
            setSelectedCategory(category);
            setPage(0);
          }}
          onEdit={handleEditFood}
          onDelete={handleDeleteFood}
        />
      ) : (
        <>
          <MenuTable
            items={paginatedMenuItems}
            onEdit={handleEditFood}
            onDelete={handleDeleteFood}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onRequestSort={handleRequestSort}
          />

          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 2 }}>
            <Typography color="text.secondary">
              Showing {paginatedMenuItems.length} of {menuItems.length} menu items
            </Typography>
            <TablePagination
              component="div"
              count={menuItems.length}
              page={page}
              onPageChange={(event, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </Box>
        </>
      )}

      <AddFoodDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onAdd={handleAddFood}
        categories={categories}
        editingFood={editingFood}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={success}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}

export default Menu;
