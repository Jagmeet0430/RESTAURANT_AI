import { Box, Chip, Stack } from "@mui/material";

function CategoryFilter({ categories, selectedCategory, onCategoryChange }) {
  return (
    <Box sx={{ marginBottom: 2 }}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        <Chip
          key="all"
          label="All"
          onClick={() => onCategoryChange("All")}
          color={selectedCategory === "All" ? "primary" : "default"}
          variant={selectedCategory === "All" ? "filled" : "outlined"}
        />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            onClick={() => onCategoryChange(category.name)}
            color={selectedCategory === category.name ? "primary" : "default"}
            variant={selectedCategory === category.name ? "filled" : "outlined"}
          />
        ))}
      </Stack>
    </Box>
  );
}

export default CategoryFilter;
