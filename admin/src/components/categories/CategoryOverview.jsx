import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";

const palette = [
  { bg: "#fff4df", fg: "#b45f00" },
  { bg: "#f0fbf1", fg: "#237a45" },
  { bg: "#fff8dc", fg: "#8a6d00" },
  { bg: "#fff1f7", fg: "#c23b78" },
  { bg: "#fff0ed", fg: "#bd3c25" },
  { bg: "#eaf8ff", fg: "#126f9f" },
  { bg: "#eef2ff", fg: "#2844a0" },
  { bg: "#f4fbdf", fg: "#5e8310" },
];

function initials(name) {
  return String(name || "Category")
    .split(/\s+|\/|&/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function cleanDescription(category) {
  const fallback = `${category.item_count || 0} menu items in this category.`;
  const description = category.description || fallback;
  return description.replace(/^Imported from menu digitization:\s*/i, "");
}

function CategoryOverview({ categories, onEdit, onDelete, onOpenMenu }) {
  if (!categories.length) {
    return (
      <Box
        sx={{
          border: "1px dashed #d7dce3",
          borderRadius: 2,
          bgcolor: "#fff",
          py: 6,
          textAlign: "center",
        }}
      >
        <Typography variant="h6">No categories found</Typography>
        <Typography color="text.secondary">Try another search or create a new category.</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
        gap: 2,
      }}
    >
      {categories.map((category, index) => {
        const color = palette[index % palette.length];
        const itemCount = category.item_count || 0;

        return (
          <Box
            key={category.id}
            sx={{
              border: "1px solid #e5e7eb",
              borderRadius: 2,
              bgcolor: "#fff",
              p: 2,
              boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 54,
                  height: 54,
                  minWidth: 54,
                  borderRadius: 2,
                  bgcolor: color.bg,
                  color: color.fg,
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                {category.image_url ? (
                  <Box
                    component="img"
                    src={category.image_url}
                    alt={category.name}
                    sx={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2 }}
                  />
                ) : (
                  initials(category.name)
                )}
              </Box>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Tooltip title={category.name}>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      color: "#111827",
                      lineHeight: 1.25,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {category.name}
                  </Typography>
                </Tooltip>
                <Typography
                  sx={{
                    mt: 0.5,
                    color: "#6b7280",
                    fontSize: 13,
                    lineHeight: 1.35,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {cleanDescription(category)}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
              <Chip
                icon={<Inventory2OutlinedIcon sx={{ fontSize: "16px !important" }} />}
                label={`${itemCount} ${itemCount === 1 ? "item" : "items"}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip label={`Order ${category.display_order ?? 0}`} size="small" variant="outlined" />
              <Chip
                label={category.is_active ? "Active" : "Inactive"}
                size="small"
                color={category.is_active ? "success" : "default"}
                variant="outlined"
              />
            </Stack>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
              <Button
                size="small"
                onClick={() => onOpenMenu(category)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                Open menu
              </Button>
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Edit category">
                  <IconButton size="small" color="primary" onClick={() => onEdit(category)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={itemCount > 0 ? "Remove menu items before deleting" : "Delete category"}>
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled={itemCount > 0}
                      onClick={() => onDelete(category)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

export default CategoryOverview;
