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
  Avatar,
  TableSortLabel,
  Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const columns = [
  { id: "name", label: "Name" },
  { id: "category_name", label: "Category" },
  { id: "price", label: "Price" },
  { id: "is_available", label: "Status" },
];

function MenuTable({ items, onEdit, onDelete, sortBy, sortDirection, onRequestSort }) {
  const createSortHandler = (property) => () => {
    onRequestSort(property);
  };

  return (
    <TableContainer component={Paper} sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
      <Table>
        <TableHead>
          <TableRow style={{ background: "#f5f5f5" }}>
            <TableCell style={{ fontWeight: "bold" }}>Image</TableCell>
            <TableCell style={{ fontWeight: "bold" }}>
              <TableSortLabel
                active={sortBy === "name"}
                direction={sortBy === "name" ? sortDirection : "asc"}
                onClick={createSortHandler("name")}
              >
                Name
              </TableSortLabel>
            </TableCell>
            <TableCell style={{ fontWeight: "bold" }}>
              <TableSortLabel
                active={sortBy === "category_name"}
                direction={sortBy === "category_name" ? sortDirection : "asc"}
                onClick={createSortHandler("category_name")}
              >
                Category
              </TableSortLabel>
            </TableCell>
            <TableCell style={{ fontWeight: "bold" }}>
              <TableSortLabel
                active={sortBy === "price"}
                direction={sortBy === "price" ? sortDirection : "asc"}
                onClick={createSortHandler("price")}
              >
                Price
              </TableSortLabel>
            </TableCell>
            <TableCell style={{ fontWeight: "bold" }}>
              <TableSortLabel
                active={sortBy === "is_available"}
                direction={sortBy === "is_available" ? sortDirection : "asc"}
                onClick={createSortHandler("is_available")}
              >
                Status
              </TableSortLabel>
            </TableCell>
            <TableCell style={{ fontWeight: "bold" }} align="center">
              Actions
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No menu items found.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Avatar
                    src={item.image_url || item.image}
                    alt={item.name}
                    sx={{ width: 50, height: 50 }}
                  />
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.category_name || item.category}</TableCell>
                <TableCell>Rs. {item.price}</TableCell>
                <TableCell>
                  <Chip
                    label={item.is_available ? "Available" : "Out of Stock"}
                    color={item.is_available ? "success" : "error"}
                    variant="outlined"
                    size="small"
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
                    <IconButton size="small" color="primary" onClick={() => onEdit(item)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => onDelete(item.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default MenuTable;
