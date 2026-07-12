import { Box, Button, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

function KitchenOrderCard({ order, onMarkReady }) {
  const items = order.items && order.items.length > 0 ? order.items : [];

  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 2,
        border: "1px solid #e0e0e0",
        boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: 0 }}>
            Order #{order.order_number || order.id}
          </Typography>
          <Chip label="Preparing" color="primary" size="small" sx={{ fontWeight: 700 }} />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={1.5} sx={{ minHeight: 108, mb: 3 }}>
          {items.map((item, index) => {
            const name = item?.name || item;
            return (
              <Typography key={`${name}-${index}`} variant="h6" sx={{ fontWeight: 600 }}>
                {name}
              </Typography>
            );
          })}
        </Stack>

        <Button
          fullWidth
          variant="contained"
          color="success"
          size="large"
          startIcon={<CheckCircleIcon />}
          onClick={() => onMarkReady(order.id)}
          sx={{
            borderRadius: 1.5,
            fontWeight: 800,
            textTransform: "none",
            py: 1.2,
          }}
        >
          Ready
        </Button>
      </CardContent>
    </Card>
  );
}

export default KitchenOrderCard;
