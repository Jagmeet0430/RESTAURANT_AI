import { Button, Grid } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import BarChartIcon from "@mui/icons-material/BarChart";

function QuickActions() {
  const actions = [
    { label: "Add Menu Item", icon: AddIcon, color: "primary" },
    { label: "View Orders", icon: LocalShippingIcon, color: "success" },
    { label: "Open Kitchen", icon: RestaurantIcon, color: "warning" },
    { label: "Generate Report", icon: BarChartIcon, color: "info" },
  ];

  return (
    <Grid container spacing={2}>
      {actions.map((action, idx) => {
        const IconComponent = action.icon;
        return (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
            <Button
              fullWidth
              variant="contained"
              color={action.color}
              startIcon={<IconComponent />}
              size="large"
              sx={{
                padding: "12px",
                fontWeight: "bold",
                textTransform: "none",
                fontSize: "16px",
              }}
            >
              {action.label}
            </Button>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default QuickActions;
