import { useState } from "react";
import { TextField, MenuItem, FormControlLabel, Switch, Box, Stack, Button, Typography, Alert } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_EDGE = 900;
const IMAGE_QUALITY = 0.82;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = src;
  });
}

async function compressImageFile(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Image is too large. Please upload a photo under 8 MB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function MenuForm({ formData, onFormChange, categories }) {
  const [uploadError, setUploadError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    onFormChange({
      ...formData,
      [name]: name === "price" || name === "category_id" ? Number(value) : value,
    });
  };

  const handleSwitchChange = (e) => {
    const { name, checked } = e.target;
    onFormChange({ ...formData, [name]: checked });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError("");
    setUploadingImage(true);

    try {
      const imageDataUrl = await compressImageFile(file);
      onFormChange({ ...formData, image_url: imageDataUrl });
    } catch (error) {
      setUploadError(error.message || "Unable to upload this image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  return (
    <Stack spacing={2}>
      <TextField
        fullWidth
        label="Food Name"
        name="name"
        value={formData.name}
        onChange={handleInputChange}
        variant="outlined"
      />

      <TextField
        fullWidth
        label="Category"
        name="category_id"
        value={formData.category_id || ""}
        onChange={handleInputChange}
        select
        variant="outlined"
      >
        <MenuItem value="">Select category</MenuItem>
        {categories.map((cat) => (
          <MenuItem key={cat.id} value={cat.id}>
            {cat.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        fullWidth
        label="Price (₹)"
        name="price"
        type="number"
        value={formData.price}
        onChange={handleInputChange}
        variant="outlined"
      />

      <TextField
        fullWidth
        label="Description"
        name="description"
        value={formData.description}
        onChange={handleInputChange}
        multiline
        rows={3}
        variant="outlined"
      />

      <TextField
        fullWidth
        label="Veg / Non-Veg"
        name="veg_type"
        value={formData.veg_type}
        onChange={handleInputChange}
        select
        variant="outlined"
      >
        <MenuItem value="Veg">🌱 Veg</MenuItem>
        <MenuItem value="Non-Veg">🍗 Non-Veg</MenuItem>
      </TextField>

      <TextField
        fullWidth
        label="Image URL"
        name="image_url"
        value={formData.image_url}
        onChange={handleInputChange}
        variant="outlined"
        placeholder="https://example.com/image.jpg"
      />

      <Box>
        <Button
          variant="outlined"
          component="label"
          startIcon={<UploadFileIcon />}
          disabled={uploadingImage}
        >
          {uploadingImage ? "Preparing..." : "Upload Image"}
          <input
            hidden
            accept="image/*"
            type="file"
            onChange={handleFileChange}
          />
        </Button>
        {uploadError && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {uploadError}
          </Alert>
        )}
        {formData.image_url && (
          <Box mt={2} display="flex" alignItems="center" gap={2}>
            <img
              src={formData.image_url}
              alt="Preview"
              style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }}
            />
            <Typography variant="body2" noWrap>
              {typeof formData.image_url === "string" && formData.image_url.length > 80
                ? `${formData.image_url.slice(0, 80)}...`
                : formData.image_url}
            </Typography>
          </Box>
        )}
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={formData.is_available}
            onChange={handleSwitchChange}
            name="is_available"
          />
        }
        label={formData.is_available ? "✓ Available" : "✗ Out of Stock"}
      />
    </Stack>
  );
}

export default MenuForm;
