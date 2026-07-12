import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  FormControlLabel,
  Switch,
} from "@mui/material";

function CategoryDialog({ open, onClose, onSave, editingCategory }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    image_url: "",
    display_order: 0,
    is_active: true,
  });

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name || "",
        description: editingCategory.description || "",
        image_url: editingCategory.image_url || "",
        display_order: editingCategory.display_order ?? 0,
        is_active: editingCategory.is_active ?? true,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        image_url: "",
        display_order: 0,
        is_active: true,
      });
    }
  }, [editingCategory, open]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === "display_order" ? Number(value) : value }));
  };

  const handleSwitch = (e) => {
    setFormData((prev) => ({ ...prev, is_active: e.target.checked }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
      <DialogContent sx={{ paddingTop: 2 }}>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Category Name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            multiline
            rows={3}
            variant="outlined"
          />
          <TextField
            fullWidth
            label="Image URL"
            name="image_url"
            value={formData.image_url}
            onChange={handleChange}
            variant="outlined"
            placeholder="https://example.com/category-image.jpg"
          />
          <TextField
            fullWidth
            label="Display Order"
            name="display_order"
            type="number"
            value={formData.display_order}
            onChange={handleChange}
            variant="outlined"
          />
          <FormControlLabel
            control={<Switch checked={formData.is_active} onChange={handleSwitch} />}
            label={formData.is_active ? "Active" : "Inactive"}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {editingCategory ? "Update" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CategoryDialog;
