import { Paper, Typography, List, ListItem, ListItemText, Chip } from "@mui/material";

const popularFoods = [
  { name: "Paneer Tikka Pizza", orders: 86 },
  { name: "Butter Chicken Burger", orders: 72 },
  { name: "Veg Biryani", orders: 61 },
  { name: "Chocolate Lava Cake", orders: 49 },
  { name: "Masala Dosa", orders: 38 },
];

function PopularFoods() {
  return (
    <Paper sx={{ p: 3, borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
        Popular Foods
      </Typography>
      <List>
        {popularFoods.map((food, idx) => (
          <ListItem key={idx} disableGutters sx={{ py: 1 }}>
            <ListItemText
              primary={food.name}
              secondary={`${food.orders} orders today`}
              slotProps={{
                primary: { fontWeight: 600 },
                secondary: { color: "text.secondary" },
              }}
            />
            <Chip label={`${food.orders}`} color="primary" />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

export default PopularFoods;
