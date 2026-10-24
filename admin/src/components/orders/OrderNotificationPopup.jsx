import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckIcon from '@mui/icons-material/Check';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SnoozeIcon from '@mui/icons-material/Snooze';
import CloseIcon from '@mui/icons-material/Close';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useOrderNotifications } from '../../context/OrderNotificationsContext';

const sources = { kiosk: 'Kiosk', website: 'Website', customer_web: 'Website', table_qr: 'Table QR' };
const types = { dine_in: 'Dine-in', pickup: 'Pickup', takeaway: 'Takeaway', delivery: 'Delivery' };
export default function OrderNotificationPopup() {
  const alerts = useOrderNotifications();
  const navigate = useNavigate();
  const order = alerts.policy.orderNotificationPopup === 'true' ? alerts.queue[0] : null;
  const position = { position: 'fixed', right: 16, bottom: 16, zIndex: 1200, maxWidth: 'calc(100vw - 32px)', displayPrint: 'none' };
  const audioControls = <Box sx={{ mb: 1 }}>
    {!alerts.audioUnlocked && <Button startIcon={<VolumeUpIcon />} onClick={alerts.enableSound}>Enable Sound</Button>}
    {alerts.mediaError && <Alert severity="warning">{alerts.mediaError}</Alert>}
    {!alerts.policyReady && <Alert severity="warning">Order notification preferences unavailable. Audio is paused.</Alert>}
  </Box>;
  if (!alerts.leader) return alerts.notificationError ? <Alert severity="warning" sx={position}>{alerts.notificationError}</Alert> : null;
  if (!order) return <Box className="no-print" sx={position}>
    {audioControls}
    {alerts.notificationError && <Alert severity="warning" sx={{ mb: 1 }}>{alerts.notificationError}</Alert>}
    {(alerts.pendingCount > 0 || alerts.hasMore) && <Button variant="contained" startIcon={<NotificationsIcon />} onClick={alerts.restore}>
      Pending orders ({alerts.pendingCount}{alerts.hasMore ? '+' : ''})
    </Button>}
  </Box>;
  const facts = [
    ['Source', sources[order.source] || order.source || '-'], ['Type', types[order.type] || order.type || '-'],
    ['Items', String(order.item_count)], ['Grand total', order.total == null ? '-' : `Rs. ${Number(order.total).toFixed(2)}`],
    ['Received', new Date(order.received_at).toLocaleString()], ['Status', order.status],
    ['Token', order.token || '-'], ['Table', order.table || '-'],
  ];
  return <Paper className="no-print" component="section" role="region" aria-label="New order notification" elevation={8}
    sx={{ ...position, width: 380, p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', maxHeight: '65vh', overflowY: 'auto' }}>
    <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>New order</Typography>
      <Chip size="small" color="warning" label={`${alerts.pendingCount}${alerts.hasMore ? '+' : ''} pending`} />
    </Stack>
    <Typography sx={{ fontWeight: 800, overflowWrap: 'anywhere', mb: 1 }}>{order.order_number || `Order #${order.id}`}</Typography>
    {audioControls}
    <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, m: 0, mb: 2 }}>
      {facts.map(([label, value]) => <Box key={label} sx={{ minWidth: 0 }}>
        <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
        <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere', fontWeight: label === 'Grand total' ? 800 : 500 }}>{value}</Typography>
      </Box>)}
    </Box>
    {alerts.actionError && <Alert severity="error" sx={{ mb: 1 }}>{alerts.actionError}</Alert>}
    {alerts.hasMore && <Alert severity="info" sx={{ mb: 1 }}>More notifications are waiting for acknowledgement.</Alert>}
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1,
      '& button': { minHeight: 40, px: 1, fontSize: 13, textTransform: 'none', letterSpacing: 0 } }}>
      <Button startIcon={<VisibilityIcon />} disabled={alerts.busy} onClick={() => navigate(`/orders?order=${encodeURIComponent(order.id)}`)}>View Order</Button>
      <Button variant="contained" startIcon={<CheckIcon />} disabled={alerts.busy || order.status?.toLowerCase() !== 'confirmed'} onClick={() => alerts.act(order.id, 'accept')}>Accept</Button>
      <Button sx={{ gridColumn: '1 / -1' }} variant="outlined" startIcon={<DoneAllIcon />} disabled={alerts.busy} onClick={() => alerts.act(order.id, 'acknowledge')}>Acknowledge</Button>
      <Button startIcon={<SnoozeIcon />} disabled={alerts.busy} onClick={() => alerts.suppress(order.id, true)}>Snooze 5 min</Button>
      <Button startIcon={<CloseIcon />} disabled={alerts.busy} onClick={() => alerts.suppress(order.id)}>Dismiss</Button>
    </Box>
  </Paper>;
}
