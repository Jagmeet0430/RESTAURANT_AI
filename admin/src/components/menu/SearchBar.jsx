import { TextField, Box } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

function SearchBar({ searchTerm, onSearchChange }) {
  return (
    <Box sx={{ marginBottom: 2 }}>
      <TextField
        fullWidth
        placeholder="Search food..."
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        InputProps={{
          startAdornment: <SearchIcon sx={{ marginRight: 1 }} />,
        }}
        variant="outlined"
        size="small"
      />
    </Box>
  );
}

export default SearchBar;
