import { NavLink } from "react-router-dom";
import DashboardIcon from "@mui/icons-material/Dashboard";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import CategoryIcon from "@mui/icons-material/Category";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import SettingsIcon from "@mui/icons-material/Settings";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PsychologyIcon from "@mui/icons-material/Psychology";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import SoupKitchenIcon from "@mui/icons-material/SoupKitchen";

const navGroups = [
  {
    label: "Daily Work",
    items: [
      { label: "Dashboard", helper: "Overview", to: "/dashboard", icon: DashboardIcon },
      { label: "Menu", helper: "Items & prices", to: "/menu", icon: RestaurantMenuIcon },
      { label: "Categories", helper: "Menu sections", to: "/categories", icon: CategoryIcon },
      { label: "Orders", helper: "Live workflow", to: "/orders", icon: ReceiptLongIcon },
      { label: "Customers", helper: "Profiles & loyalty", to: "/customers", icon: PeopleAltIcon },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Coupons", helper: "Offers", to: "/coupons", icon: LocalOfferIcon },
      { label: "Reports", helper: "Exports", to: "/reports", icon: AssessmentIcon },
      { label: "Analytics", helper: "Trends", to: "/analytics", icon: AnalyticsIcon },
      { label: "AI Prediction", helper: "Forecasts", to: "/ai", icon: PsychologyIcon },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "OCR Upload", helper: "Digitize menus", to: "/ocr-upload", icon: DocumentScannerIcon },
      { label: "Inventory", helper: "Stock & suppliers", to: "/inventory", icon: Inventory2Icon },
      { label: "Kitchen", helper: "Prep screen", to: "/kitchen", icon: SoupKitchenIcon },
      { label: "Settings", helper: "Restaurant setup", to: "/settings", icon: SettingsIcon },
    ],
  },
];

function Sidebar() {
  return (
    <aside
      style={{
        width: "270px",
        background: "#0F172A",
        color: "#F8FAFC",
        minHeight: "100vh",
        padding: "22px 16px",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <div style={{ marginBottom: "1.4rem", padding: "0 8px" }}>
        <h2 style={{ margin: 0, fontSize: "1.4rem", letterSpacing: "0.08em" }}>
          RestaurantAI
        </h2>
        <p style={{ marginTop: "8px", color: "#94A3B8" }}>Admin Console</p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {navGroups.map((group) => (
          <div key={group.label}>
            <div
              style={{
                color: "#64748B",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0 10px 6px",
              }}
            >
              {group.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    style={({ isActive }) => ({
                      display: "flex",
                      alignItems: "center",
                      gap: 11,
                      color: isActive ? "#F8FAFC" : "#CBD5E1",
                      background: isActive ? "rgba(148, 163, 184, 0.18)" : "transparent",
                      padding: "0.72rem 0.78rem",
                      borderRadius: "0.85rem",
                      textDecoration: "none",
                      transition: "background 0.2s ease, color 0.2s ease",
                    })}
                  >
                    <Icon style={{ fontSize: 21, opacity: 0.95 }} />
                    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
                      <span style={{ fontWeight: 750 }}>{item.label}</span>
                      <span style={{ color: "#94A3B8", fontSize: 12, marginTop: 3 }}>
                        {item.helper}
                      </span>
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
