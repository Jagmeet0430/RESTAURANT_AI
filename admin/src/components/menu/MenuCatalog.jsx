import {
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const categoryLooks = {
  "Puffs Patties & Rolls": { tone: "#fff4df", accent: "#e58a00", icon: "PU" },
  Pastries: { tone: "#f0fbf1", accent: "#2e8b57", icon: "PA" },
  "Swiss Roll": { tone: "#fff8dc", accent: "#8a6d00", icon: "SR" },
  Donuts: { tone: "#fff1f7", accent: "#d84c8b", icon: "DO" },
  "Pies / Tarts": { tone: "#fff0ed", accent: "#d9482f", icon: "PI" },
  "Muffins / Cupcakes": { tone: "#eaf8ff", accent: "#1583c4", icon: "MU" },
  Puddings: { tone: "#fff8d8", accent: "#c77d00", icon: "PD" },
  "Perfect Pizzas": { tone: "#fff0df", accent: "#d46400", icon: "PZ" },
  "Burger & Sandwiches": { tone: "#eef2ff", accent: "#2347a5", icon: "BG" },
  Chaat: { tone: "#f4fbdf", accent: "#6f9713", icon: "CH" },
  Chinese: { tone: "#eaf8fb", accent: "#16869b", icon: "CN" },
};

const fallbackLook = { tone: "#f7f7f7", accent: "#666", icon: "FO" };

function groupByCategory(items) {
  return items.reduce((groups, item) => {
    const category = item.category_name || item.category || "Uncategorized";
    if (!groups[category]) groups[category] = [];
    groups[category].push(item);
    return groups;
  }, {});
}

function formatPrice(price) {
  const value = Number(price);
  if (Number.isNaN(value)) return `Rs. ${price}`;
  return `Rs. ${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`;
}

function MenuCard({ item, onEdit, onDelete }) {
  const category = item.category_name || item.category || "Uncategorized";
  const look = categoryLooks[category] || fallbackLook;
  const prepTime = item.preparation_time || 20;

  return (
    <Box
      sx={{
        width: 180,
        minWidth: 180,
        border: "1px solid #e6e6e6",
        borderRadius: 2,
        bgcolor: "#fff",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06)",
      }}
    >
      <Box
        sx={{
          height: 112,
          bgcolor: look.tone,
          display: "grid",
          placeItems: "center",
          borderBottom: "1px solid #ededed",
        }}
      >
        {item.image_url ? (
          <Box
            component="img"
            src={item.image_url}
            alt={item.name}
            sx={{ maxWidth: "86%", maxHeight: 92, objectFit: "contain" }}
          />
        ) : (
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              bgcolor: "#fff",
              border: `2px solid ${look.accent}`,
              color: look.accent,
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              letterSpacing: 0.5,
            }}
          >
            {look.icon}
          </Box>
        )}
      </Box>

      <Box sx={{ p: 1.5 }}>
        <Chip
          icon={<AccessTimeIcon sx={{ fontSize: "13px !important" }} />}
          label={`${prepTime} mins`}
          size="small"
          sx={{
            height: 19,
            fontSize: 10,
            fontWeight: 700,
            bgcolor: "#f5f7f5",
            mb: 1,
            ".MuiChip-icon": { ml: 0.5 },
          }}
        />

        <Tooltip title={item.name}>
          <Typography
            sx={{
              minHeight: 40,
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1.35,
              color: "#111827",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.name}
          </Typography>
        </Tooltip>

        <Typography sx={{ mt: 1, fontSize: 12, color: "#6b7280" }}>
          {item.veg_type || "Veg"}
        </Typography>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
            {formatPrice(item.price)}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={!item.is_available}
            sx={{
              minWidth: 66,
              height: 34,
              borderRadius: 1.25,
              borderColor: "#138808",
              color: "#138808",
              fontWeight: 900,
              bgcolor: "#f9fff8",
              "&:hover": { borderColor: "#0f6f07", bgcolor: "#efffec" },
            }}
          >
            ADD
          </Button>
        </Stack>

        <Stack direction="row" spacing={0.5} justifyContent="flex-end" sx={{ mt: 1 }}>
          <Tooltip title="Edit item">
            <IconButton size="small" color="primary" onClick={() => onEdit(item)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete item">
            <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

function MenuCatalog({ items, categories, selectedCategory, onCategoryChange, onEdit, onDelete }) {
  const grouped = groupByCategory(items);
  const orderedCategoryNames = [
    ...categories.map((category) => category.name),
    ...Object.keys(grouped).filter(
      (categoryName) => !categories.some((category) => category.name === categoryName)
    ),
  ].filter((categoryName) => grouped[categoryName]?.length);

  if (!items.length) {
    return (
      <Box
        sx={{
          border: "1px dashed #d8d8d8",
          borderRadius: 2,
          py: 6,
          textAlign: "center",
          bgcolor: "#fff",
        }}
      >
        <Typography variant="h6">No menu items found</Typography>
        <Typography color="text.secondary">Try a different search or category.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900 }}>
            Quick Menu View
          </Typography>
          <Typography color="text.secondary">
            {items.length} items grouped into {orderedCategoryNames.length} easy-to-scan sections.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          <Chip label={`${items.length} items`} color="success" variant="outlined" />
          <Chip label={`${orderedCategoryNames.length} categories`} color="primary" variant="outlined" />
        </Stack>
      </Stack>

      <Stack spacing={4}>
        {orderedCategoryNames.map((categoryName) => {
          const categoryItems = grouped[categoryName] || [];
          const visibleItems =
            selectedCategory === "All" ? categoryItems.slice(0, 8) : categoryItems;
          const hiddenCount = categoryItems.length - visibleItems.length;

          return (
            <Box key={categoryName}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="h5" sx={{ fontWeight: 900, color: "#111827" }}>
                  {categoryName}
                </Typography>
                {selectedCategory === "All" && hiddenCount > 0 && (
                  <Button
                    variant="text"
                    onClick={() => onCategoryChange(categoryName)}
                    sx={{ color: "#078a05", fontWeight: 900, textTransform: "none" }}
                  >
                    see all
                  </Button>
                )}
              </Stack>

              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  overflowX: "auto",
                  pb: 1,
                  scrollSnapType: "x proximity",
                  "& > *": { scrollSnapAlign: "start" },
                }}
              >
                {visibleItems.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export default MenuCatalog;
