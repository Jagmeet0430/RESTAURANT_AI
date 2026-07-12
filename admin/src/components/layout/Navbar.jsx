import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        padding: "15px 20px",
        borderBottom: "1px solid #e2e8f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: "bold", color: "#1E293B" }}>
        Admin Dashboard
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: "15px" }}>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          {user?.name || "Admin"} ({user?.role || "unknown"})
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ textTransform: "none" }}
        >
          Logout
        </Button>
      </Box>
    </Box>
  );
};

export default Navbar;
