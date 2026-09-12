import React, { useEffect, useState } from "react";
import { Dialog, DialogTitle, DialogContent, Typography, List, ListItem, ListItemText, Button } from "@mui/material";
import { customersService } from "../../services/customers";

export default function CustomerProfile({ open, onClose, customer }) {
  const [details, setDetails] = useState(null);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    let mounted = true;
    if (!open || !customer) return;

    customersService.getCustomerById(customer.id).then((resp) => {
      if (!mounted) return;
      if (resp.success) {
        setDetails(resp.data);
      }
    }).catch(() => {});

    customersService.getFavorites(customer.id).then((resp) => {
      if (!mounted) return;
      if (resp.success) setFavorites(resp.data || []);
    }).catch(() => {});

    return () => { mounted = false; };
  }, [open, customer]);

  if (!customer) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Customer Profile - {customer.name}</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1">Contact: {customer.phone} / {customer.email || '-'}</Typography>
        <Typography variant="subtitle2">Loyalty Points: {details?.loyalty_points ?? customer.loyalty_points ?? 0}</Typography>
        <Typography variant="subtitle2">Orders: {details?.total_orders ?? customer.total_orders ?? 0}</Typography>
        <Typography variant="subtitle2">Total Spend: Rs. {Number(details?.total_spent ?? customer.total_spent ?? 0).toFixed(2)}</Typography>

        <Typography variant="h6" sx={{ mt: 2 }}>Recent Orders</Typography>
        <List>
          {details?.recent_orders?.length ? details.recent_orders.map((o) => (
            <ListItem key={o.id}><ListItemText primary={`#${o.order_number} — ${o.status}`} secondary={`₹${o.total_amount} — ${new Date(o.created_at).toLocaleString()}`} /></ListItem>
          )) : <ListItem><ListItemText primary="No recent orders" /></ListItem>}
        </List>

        <Typography variant="h6" sx={{ mt: 2 }}>Favorite Dishes</Typography>
        <List>
          {favorites.length ? favorites.map((f) => (
            <ListItem key={f.menu_id} secondaryAction={<Button size="small" onClick={async () => {
              await customersService.removeFavorite(customer.id, f.menu_id);
              const r = await customersService.getFavorites(customer.id);
              if (r.success) setFavorites(r.data || []);
            }}>Remove</Button>}>
              <ListItemText primary={f.name} />
            </ListItem>
          )) : <ListItem><ListItemText primary="No favorites" /></ListItem>}
        </List>

        <Typography variant="body2" sx={{ mt: 2 }}>Add favorite by Menu ID:</Typography>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input id="favMenuId" placeholder="Menu ID" style={{ flex: 1, padding: 8 }} />
          <Button variant="contained" onClick={async () => {
            const menuId = document.getElementById('favMenuId').value;
            if (!menuId) return;
            await customersService.addFavorite(customer.id, Number(menuId));
            const r = await customersService.getFavorites(customer.id);
            if (r.success) setFavorites(r.data || []);
            document.getElementById('favMenuId').value = '';
          }}>Add</Button>
        </div>

      </DialogContent>
    </Dialog>
  );
}
