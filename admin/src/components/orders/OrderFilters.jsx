import {
  Box,
  Button,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

const statusOptions = ["Pending", "Accepted", "Preparing", "Ready", "Completed", "Cancelled"];

function OrderFilters({ filters, onFilterChange }) {
  const handleFilterChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      status: "",
      payment_status: "",
      date: "",
      search: "",
    });
  };

  return (
    <Paper
      sx={{
        marginBottom: 3,
        padding: 2,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
      }}
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <TextField
            placeholder="Search order, customer, table, or item..."
            value={filters.search || ""}
            onChange={(event) => handleFilterChange("search", event.target.value)}
            size="small"
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <TextField
            label="Payment"
            select
            value={filters.payment_status}
            onChange={(event) => handleFilterChange("payment_status", event.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All payments</MenuItem>
            <MenuItem value="Paid">Paid</MenuItem>
            <MenuItem value="Pending">Pending</MenuItem>
            <MenuItem value="Failed">Failed</MenuItem>
            <MenuItem value="Refunded">Refunded</MenuItem>
          </TextField>

          <TextField
            label="Date"
            type="date"
            value={filters.date}
            onChange={(event) => handleFilterChange("date", event.target.value)}
            size="small"
            sx={{ minWidth: 160 }}
            InputLabelProps={{ shrink: true }}
          />

          <Button variant="outlined" onClick={clearFilters} sx={{ minWidth: 120 }}>
            Clear
          </Button>
        </Stack>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Chip
            label="All statuses"
            onClick={() => handleFilterChange("status", "")}
            color={!filters.status ? "primary" : "default"}
            variant={!filters.status ? "filled" : "outlined"}
          />
          {statusOptions.map((status) => (
            <Chip
              key={status}
              label={status}
              onClick={() => handleFilterChange("status", status)}
              color={filters.status === status ? "primary" : "default"}
              variant={filters.status === status ? "filled" : "outlined"}
            />
          ))}
        </Box>
      </Stack>
    </Paper>
  );
}

export default OrderFilters;
