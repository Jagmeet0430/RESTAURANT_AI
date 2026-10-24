import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import MenuForm from "./MenuForm";

const defaultForm = {
  name: "",
  category_id: "",
  price: "",
  description: "",
  veg_type: "Veg",
  image_url: "",
  is_available: true,
  visible_kiosk: true,
  visible_website: true,
  display_order: 0,
};

function AddFoodDialog({ open, onClose, onAdd, categories, editingFood }) {
  const [formData, setFormData] = useState(defaultForm);

  useEffect(() => {
    if (editingFood) {
      setFormData({
        name: editingFood.name || "",
        category_id: editingFood.category_id || "",
        price: editingFood.price || "",
        description: editingFood.description || "",
        veg_type: editingFood.veg_type || "Veg",
        image_url: editingFood.image_url || "",
        is_available: editingFood.is_available ?? true,
        sync_version: editingFood.sync_version,
        visible_kiosk: editingFood.visible_kiosk ?? true,
        visible_website: editingFood.visible_website ?? true,
        display_order: editingFood.display_order ?? 0,
      });
    } else {
      setFormData(defaultForm);
    }
  }, [editingFood, open]);

  const handleSubmit = () => {
    if (formData.name && formData.category_id && formData.price) {
      onAdd(formData);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editingFood ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
      <DialogContent sx={{ paddingTop: 2 }}>
        <MenuForm
          formData={formData}
          onFormChange={setFormData}
          categories={categories}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {editingFood ? "Update" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddFoodDialog;
