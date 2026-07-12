import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, List, ListItem, ListItemText, Stack } from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupsIcon from "@mui/icons-material/Groups";
import InsightsIcon from "@mui/icons-material/Insights";
import ShoppingBagIcon from "@mui/icons-material/ShoppingBag";
import StorefrontIcon from "@mui/icons-material/Storefront";
import apiClient from "../../services/api";
import { PageHeader, SectionCard, StatCard, StatGrid } from "../../components/common/PageKit";

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function Prediction() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recs, setRecs] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiClient
      .get("/predictions/today")
      .then((response) => {
        if (mounted) setData(response.data.data);
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Failed to load prediction");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const loadRecommendations = async () => {
    try {
      const response = await apiClient.get("/recommendations/today");
      setRecs(response.data.data);
    } catch {
      setRecs({ error: "Failed to load recommendations" });
    }
  };

  const predictedSales = data?.predicted?.predicted_sales ?? null;
  const payload = data?.payload || {};

  return (
    <Box sx={{ p: 3 }}>
      <PageHeader
        badge="AI Forecast"
        title="AI Prediction"
        subtitle="Use today’s forecast to plan staff, prep quantities, online demand, and dine-in flow before the rush starts."
        actions={
          <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={loadRecommendations}>
            Load Recommendations
          </Button>
        }
      />

      {loading && (
        <SectionCard>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <CircularProgress size={22} />
            <span>Loading predictions...</span>
          </Stack>
        </SectionCard>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {!loading && !error && (
        <>
          <StatGrid>
            <StatCard
              label="Predicted sales"
              value={predictedSales != null ? formatCurrency(predictedSales) : "-"}
              helper="Estimated revenue today"
              icon={<InsightsIcon />}
              accent="#1976d2"
            />
            <StatCard
              label="Customers"
              value={payload.customers ?? "-"}
              helper="Expected footfall"
              icon={<GroupsIcon />}
              accent="#059669"
            />
            <StatCard
              label="Online orders"
              value={payload.online_orders ?? "-"}
              helper="Delivery and pickup"
              icon={<ShoppingBagIcon />}
              accent="#7c3aed"
            />
            <StatCard
              label="Dine-in orders"
              value={payload.dine_in_orders ?? "-"}
              helper="Restaurant floor demand"
              icon={<StorefrontIcon />}
              accent="#dc6b19"
            />
          </StatGrid>

          <SectionCard
            title="Recommendations"
            subtitle="Actionable suggestions for the team before service starts."
            actions={!recs && <Button variant="outlined" onClick={loadRecommendations}>Generate</Button>}
          >
            {recs?.recommendations ? (
              <List dense>
                {recs.recommendations.map((rec, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemText primary={rec} />
                  </ListItem>
                ))}
              </List>
            ) : recs?.error ? (
              <Alert severity="error">{recs.error}</Alert>
            ) : (
              <Alert severity="info">Generate recommendations to see staffing and prep suggestions.</Alert>
            )}
          </SectionCard>
        </>
      )}
    </Box>
  );
}

export default Prediction;
