import Grid from "@mui/material/Grid";
import StatCard from "./StatCard";

function DashboardCards() {
  const stats = [
    { label: "Today's Revenue", value: "₹12,500", change: "Updated hourly", icon: "💵" },
    { label: "Today's Orders", value: "52", change: "22% above target", icon: "📦" },
    { label: "Customers", value: "240", change: "+14 today", icon: "👥" },
    { label: "Pending Orders", value: "8", change: "Needs attention", icon: "⏳" },
  ];

  return (
    <Grid container spacing={2} sx={{ marginBottom: 3 }}>
      {stats.map((stat, idx) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
          <StatCard
            icon={stat.icon}
            label={stat.label}
            value={stat.value}
            change={stat.change}
          />
        </Grid>
      ))}
    </Grid>
  );
}

export default DashboardCards;
