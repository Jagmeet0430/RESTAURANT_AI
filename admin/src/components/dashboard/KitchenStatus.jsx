import { Card, CardContent, Typography, Grid } from "@mui/material";

function KitchenStatus() {
  const statuses = [
    { label: "Live Orders", count: 8, color: "#ff5252", icon: "🔴" },
    { label: "Preparing", count: 12, color: "#ff9800", icon: "👨‍🍳" },
    { label: "Ready", count: 6, color: "#4caf50", icon: "✓" },
    { label: "Completed", count: 143, color: "#2196f3", icon: "✅" },
  ];

  return (
    <Grid container spacing={2}>
      {statuses.map((status, idx) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
          <Card
            style={{
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              borderLeft: `4px solid ${status.color}`,
              height: "100%",
            }}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                {status.label}
              </Typography>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>{status.icon}</span>
                <Typography variant="h4" style={{ color: status.color, fontWeight: "bold" }}>
                  {status.count}
                </Typography>
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default KitchenStatus;
