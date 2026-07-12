import { Card, CardContent, Typography, Box } from "@mui/material";

function StatCard({ icon, label, value, change }) {
  return (
    <Card
      sx={{
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        height: "100%",
        transition: "transform 0.2s, boxShadow 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <Typography color="textSecondary" gutterBottom sx={{ margin: 0 }}>
            {label}
          </Typography>
          <span style={{ fontSize: "24px" }}>{icon}</span>
        </Box>
        <Typography variant="h5" sx={{ fontWeight: "bold", marginBottom: 1 }}>
          {value}
        </Typography>
        <Typography variant="body2" sx={{ color: "#4caf50" }}>
          {change}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default StatCard;
