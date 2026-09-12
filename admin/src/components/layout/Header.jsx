import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import { useAuth } from "../../context/AuthContext";

const pageCopy = {
  "/dashboard": {
    title: "Operations Hub",
    subtitle: "Clear view of orders, menu, customers, stock, and business health.",
  },
  "/menu": {
    title: "Menu Experience",
    subtitle: "Customer-friendly menu items, pricing, categories, and availability.",
  },
  "/categories": {
    title: "Menu Categories",
    subtitle: "Simple sections that help customers and staff find food quickly.",
  },
  "/orders": {
    title: "Order Command Center",
    subtitle: "Track every order from request to kitchen to completion.",
  },
  "/bills": {
    title: "Bills & Payments",
    subtitle: "Settle orders, print receipts, and review collections.",
  },
  "/end-of-day": {
    title: "End of Day",
    subtitle: "Close drawer cash, store settlement snapshots, and review daily totals.",
  },
  "/customers": {
    title: "Customer Records",
    subtitle: "Profiles, contact details, order history, and loyalty signals.",
  },
  "/coupons": {
    title: "Offers & Coupons",
    subtitle: "Discount codes customers can understand and staff can manage.",
  },
  "/reports": {
    title: "Business Reports",
    subtitle: "Exportable summaries for sales, stock, customers, and revenue.",
  },
  "/settings": {
    title: "Restaurant Setup",
    subtitle: "Brand, billing, security, and admin preferences.",
  },
  "/ai": {
    title: "AI Forecast",
    subtitle: "Demand predictions and recommendations for better planning.",
  },
  "/ocr-upload": {
    title: "Menu Digitization",
    subtitle: "Turn menu images into clean digital menu data.",
  },
  "/inventory": {
    title: "Stock & Suppliers",
    subtitle: "Inventory levels, low-stock alerts, and supplier visibility.",
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Charts and trends for revenue, orders, and customer behavior.",
  },
  "/kitchen": {
    title: "Kitchen Display",
    subtitle: "Active prep tickets for the kitchen team.",
  },
};

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = useMemo(() => {
    return pageCopy[location.pathname] || pageCopy["/dashboard"];
  }, [location.pathname]);

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
        backgroundColor: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e2e8f0",
        px: 3,
        py: 1.8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 900, color: "#0f172a", lineHeight: 1.2 }}>
          {currentPage.title}
        </Typography>
        <Typography variant="body2" sx={{ color: "#64748b" }}>
          {currentPage.subtitle}
        </Typography>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        <Chip
          icon={<VerifiedUserIcon />}
          label={`${user?.name || "Restaurant Admin"} · ${user?.role || "admin"}`}
          variant="outlined"
          size="small"
          sx={{ fontWeight: 700 }}
        />
        <Chip label="Live" color="success" size="small" variant="outlined" />
        <Button
          variant="outlined"
          size="small"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ textTransform: "none", fontWeight: 800 }}
        >
          Logout
        </Button>
      </Stack>
    </Box>
  );
}

export default Header;
