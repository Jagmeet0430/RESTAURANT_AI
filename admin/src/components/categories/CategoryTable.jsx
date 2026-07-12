import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Box,
  Tooltip,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

function cleanDescription(category) {
  if (!category.description) return "-";
  return category.description.replace(/^Imported from menu digitization:\s*/i, "");
}

function CategoryTable({ categories, onEdit, onDelete }) {
  return (
    <TableContainer component={Paper} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <Table>
        <TableHead>
          <TableRow sx={{ background: "#f5f5f5" }}>
            <TableCell sx={{ fontWeight: "bold" }}>Name</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Description</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Items</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Display Order</TableCell>
            <TableCell sx={{ fontWeight: "bold" }}>Status</TableCell>
            <TableCell sx={{ fontWeight: "bold" }} align="center">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No categories available.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            categories.map((category) => {
              const itemCount = category.item_count || 0;

              return (
                <TableRow key={category.id} hover>
                  <TableCell sx={{ fontWeight: 700 }}>{category.name}</TableCell>
                  <TableCell>{cleanDescription(category)}</TableCell>
                  <TableCell>
                    <Chip
                      label={`${itemCount} ${itemCount === 1 ? "item" : "items"}`}
                      size="small"
                      color={itemCount > 0 ? "primary" : "default"}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{category.display_order ?? 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={category.is_active ? "Active" : "Inactive"}
                      color={category.is_active ? "success" : "default"}
                      variant="outlined"
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                      <IconButton size="small" color="primary" onClick={() => onEdit(category)}>
                        <EditIcon />
                      </IconButton>
                      <Tooltip
                        title={itemCount > 0 ? "Remove menu items before deleting" : "Delete category"}
                      >
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={itemCount > 0}
                            onClick={() => onDelete(category)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default CategoryTable;
