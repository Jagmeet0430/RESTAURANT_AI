import { useEffect, useState } from 'react';
import { Alert, Box, Button, FormControlLabel, MenuItem, Slider, Stack, Switch, TextField, Typography } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useOrderNotifications } from '../../context/OrderNotificationsContext';

export default function OrderNotificationSettings() {
  const alerts = useOrderNotifications();
  const [draft, setDraft] = useState(alerts.policy), [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false), [message, setMessage] = useState(null);
  useEffect(() => { if (!dirty) setDraft(alerts.policy); }, [alerts.policy, dirty]);
  const change = (field, value) => { setDirty(true); setMessage(null); setDraft(previous => ({ ...previous, [field]: String(value) })); };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await alerts.savePolicy(draft); setDirty(false); setMessage({ severity: 'success', text: 'Order notification settings saved.' }); }
    catch { setMessage({ severity: 'error', text: 'Settings could not be saved. Your changes are still here.' }); }
    finally { setSaving(false); }
  };
  return <Box component="section" id="order-notification-settings" sx={{ my: 3, py: 2, borderTop: '1px solid', borderColor: 'divider' }}>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Order Notifications</Typography>
    {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}
    {alerts.mediaError && <Alert severity="warning" sx={{ mb: 2 }}>{alerts.mediaError}</Alert>}
    <Typography variant="subtitle2">Restaurant policy</Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
      {[['orderNotificationPopup', 'Enable popup'], ['orderNotificationSound', 'Enable alert sound'], ['orderNotificationVoice', 'Enable voice'], ['orderNotificationAutoNavigate', 'Auto-navigate from idle Dashboard']].map(([field, label]) =>
        <FormControlLabel key={field} label={label} control={<Switch checked={draft[field] === 'true'} disabled={saving || !alerts.policyReady} onChange={event => change(field, event.target.checked)} />} />)}
    </Box>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, my: 2 }}>
      <TextField select label="Announcement language" value={draft.orderNotificationLanguage} onChange={e => change('orderNotificationLanguage', e.target.value)} sx={{ minWidth: 220 }} disabled={saving}>
        <MenuItem value="en">English</MenuItem><MenuItem value="hi">Hindi</MenuItem>
      </TextField>
      <TextField select label="Repeat reminder" value={draft.orderNotificationRepeatSeconds} onChange={e => change('orderNotificationRepeatSeconds', e.target.value)} sx={{ minWidth: 220 }} disabled={saving}>
        {[['0', 'Off'], ['30', '30 seconds'], ['60', '1 minute'], ['120', '2 minutes'], ['300', '5 minutes']].map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
      </TextField>
      <Button variant="contained" startIcon={<SaveIcon />} disabled={!dirty || saving || !alerts.policyReady} onClick={save}>Save notification settings</Button>
    </Box>
    <Typography variant="subtitle2">This device</Typography>
    <Box sx={{ maxWidth: 360, px: 1, mt: 1 }}>
      <Typography id="notification-volume">Volume: {alerts.volume}%</Typography>
      <Slider aria-labelledby="notification-volume" value={alerts.volume} onChange={(_, value) => alerts.changeVolume(value)} min={0} max={100} step={5} />
    </Box>
    <Typography variant="body2" sx={{ my: 1 }}>Desktop permission: {alerts.desktopPermission}</Typography>
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      {!alerts.audioUnlocked && <Button startIcon={<VolumeUpIcon />} onClick={alerts.enableSound}>Enable Sound</Button>}
      <Button startIcon={<VolumeUpIcon />} onClick={alerts.testSound}>Test Sound</Button>
      <Button startIcon={<RecordVoiceOverIcon />} onClick={alerts.testVoice}>Test Voice</Button>
      <Button startIcon={<NotificationsIcon />} disabled={alerts.desktopPermission !== 'default'} onClick={alerts.enableDesktop}>Enable desktop notifications</Button>
    </Stack>
  </Box>;
}
