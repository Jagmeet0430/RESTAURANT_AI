import { TextField, MenuItem, FormControlLabel, Switch, Box, Stack, Button, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";

function MenuForm({ formData, onFormChange, categories }) {
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

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      onFormChange({ ...formData, image_url: reader.result });
    };
    reader.readAsDataURL(file);
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
        >
          Upload Image
          <input
            hidden
            accept="image/*"
            type="file"
            onChange={handleFileChange}
          />
        </Button>
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
