import { Box, Button, Chip, Paper, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import AnalyticsIcon from "@mui/icons-material/Analytics";
import CategoryIcon from "@mui/icons-material/Category";
import DocumentScannerIcon from "@mui/icons-material/DocumentScanner";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import RoomServiceIcon from "@mui/icons-material/RoomService";
import StorefrontIcon from "@mui/icons-material/Storefront";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";
import ChatbotWidget from "../../components/ChatbotWidget";

const quickMetrics = [
  {
    label: "Menu items",
    value: "66",
    helper: "Ready in catalog",
    icon: <RestaurantMenuIcon />,
    accent: "#1976d2",
  },
  {
    label: "Categories",
    value: "11",
    helper: "Customer-friendly sections",
    icon: <CategoryIcon />,
    accent: "#059669",
  },
  {
    label: "Live orders",
    value: "Board",
    helper: "Track kitchen workflow",
    icon: <ReceiptLongIcon />,
    accent: "#7c3aed",
  },
  {
    label: "Stock control",
    value: "Active",
    helper: "Suppliers and low stock",
    icon: <Inventory2Icon />,
    accent: "#dc6b19",
  },
];

const journeys = [
  {
    title: "For customers",
    subtitle: "Make food easy to browse, understand, and order.",
    icon: <StorefrontIcon />,
    actions: [
      { label: "View Menu", to: "/menu" },
      { label: "View Categories", to: "/categories" },
      { label: "Coupons", to: "/coupons" },
    ],
  },
  {
    title: "For restaurant staff",
    subtitle: "Move orders fast from counter to kitchen to completion.",
    icon: <RoomServiceIcon />,
    actions: [
      { label: "Orders", to: "/orders" },
      { label: "Kitchen", to: "/kitchen" },
      { label: "Customers", to: "/customers" },
    ],
  },
  {
    title: "For suppliers",
    subtitle: "Understand stock needs, low inventory, and replenishment priority.",
    icon: <Inventory2Icon />,
    actions: [
      { label: "Inventory", to: "/inventory" },
      { label: "Reports", to: "/reports" },
      { label: "Analytics", to: "/analytics" },
    ],
  },
  {
    title: "For owners",
    subtitle: "See performance, forecasts, reports, and business health.",
    icon: <TrendingUpIcon />,
    actions: [
      { label: "Analytics", to: "/analytics" },
      { label: "AI Prediction", to: "/ai" },
      { label: "Reports", to: "/reports" },
    ],
  },
];

const setupSteps = [
  {
    title: "Digitize menu",
    text: "Upload a menu image and turn it into structured items.",
    to: "/ocr-upload",
    icon: <DocumentScannerIcon />,
  },
  {
    title: "Organize catalog",
    text: "Group items into categories customers can scan quickly.",
    to: "/categories",
    icon: <CategoryIcon />,
  },
  {
    title: "Run service",
    text: "Use order and kitchen boards during live operations.",
    to: "/orders",
    icon: <ReceiptLongIcon />,
  },
  {
    title: "Improve decisions",
    text: "Use analytics and AI forecasts to plan demand.",
    to: "/analytics",
    icon: <PsychologyIcon />,
  },
];

function JourneyCard({ journey }) {
  const navigate = useNavigate();

  return (
    <Paper
      sx={{
        p: 2.2,
        borderRadius: 2,
        border: "1px solid #e5e7eb",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.05)",
        height: "100%",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: "#eef6ff",
            color: "#1976d2",
            flexShrink: 0,
          }}
        >
          {journey.icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900 }}>{journey.title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {journey.subtitle}
          </Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
        {journey.actions.map((action) => (
          <Button
            key={action.to}
            size="small"
            variant="outlined"
            onClick={() => navigate(action.to)}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            {action.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}

function Dashboard() {
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="RestaurantAI"
        title="Professional Admin Console"
        subtitle="A simple operating system for customers, staff, suppliers, kitchen, and owners. Every section is organized by the job it helps people finish."
        actions={
          <>
            <Button variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => navigate("/orders")}>
              Open Orders
            </Button>
            <Button variant="outlined" startIcon={<RestaurantMenuIcon />} onClick={() => navigate("/menu")}>
              View Menu
            </Button>
          </>
        }
      />

      <StatGrid>
        {quickMetrics.map((metric) => (
          <StatCard key={metric.label} {...metric} />
        ))}
      </StatGrid>

      <SectionCard
        title="Choose the right workspace"
        subtitle="Plain-language entry points for every person who uses the system."
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
            gap: 2,
          }}
        >
          {journeys.map((journey) => (
            <JourneyCard key={journey.title} journey={journey} />
          ))}
        </Box>
      </SectionCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "1.2fr 0.8fr" },
          gap: 2,
          mt: 3,
        }}
      >
        <SectionCard title="Recommended workflow" subtitle="A simple path from setup to daily operations.">
          <Stack spacing={1.5}>
            {setupSteps.map((step, index) => (
              <Paper
                key={step.title}
                variant="outlined"
                sx={{ p: 1.5, borderRadius: 2, cursor: "pointer" }}
                onClick={() => navigate(step.to)}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip label={index + 1} color="primary" />
                  <Box sx={{ color: "#1976d2" }}>{step.icon}</Box>
                  <Box>
                    <Typography sx={{ fontWeight: 900 }}>{step.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {step.text}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Quick actions" subtitle="Common tasks during a busy service.">
          <Stack spacing={1.2}>
            <Button fullWidth variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => navigate("/orders")}>
              Manage live orders
            </Button>
            <Button fullWidth variant="outlined" startIcon={<LocalOfferIcon />} onClick={() => navigate("/coupons")}>
              Create customer offer
            </Button>
            <Button fullWidth variant="outlined" startIcon={<PeopleAltIcon />} onClick={() => navigate("/customers")}>
              Open customer records
            </Button>
            <Button fullWidth variant="outlined" startIcon={<AnalyticsIcon />} onClick={() => navigate("/analytics")}>
              Review performance
            </Button>
          </Stack>
        </SectionCard>
      </Box>

      <ChatbotWidget />
    </Box>
  );
}

export default Dashboard;
