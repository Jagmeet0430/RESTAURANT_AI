import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import VisibilityIcon from '@mui/icons-material/Visibility';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { receiptPrinter, newPrintRequestId } from '../../services/receiptPrinter';

const safeDefaults = { enabled: false, printerName: '', kitchenPrinterName: '', paperWidth: '58mm', copies: 1,
  autoPrintKioskOrders: true, printMode: 'windows_driver', fontScale: 1, lineSpacing: 1,
  charactersPerLine: 28, logoPrinting: false, autoCut: 'driver' };

export default function PrinterSettings() {
  const [model, setModel] = useState(null);
  const [form, setForm] = useState(safeDefaults);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(null);
  const testRequest = useRef(null);
  const navigate = useNavigate();
  const load = async () => {
    setBusy(true);
    try { const data = await receiptPrinter.settings(); setModel(data); setForm(data.config); setDirty(false); }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'Printer settings could not be loaded.' }); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (model && window.location.hash === '#printer-settings') document.getElementById('printer-settings')?.scrollIntoView();
  }, [model]);
  const change = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setDirty(true); setMessage(null); };
  const save = async () => {
    setBusy(true);
    try { setForm(await receiptPrinter.save(form)); setDirty(false); setMessage({ severity: 'success', text: 'Printer settings saved on the Restaurant PC.' }); }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'Printer settings could not be saved.' }); }
    finally { setBusy(false); }
  };
  const testPrint = async () => {
    if (busy) return;
    setBusy(true);
    try {
      testRequest.current ||= sessionStorage.getItem('restaurantai-test-print') || newPrintRequestId();
      sessionStorage.setItem('restaurantai-test-print', testRequest.current);
      const result = await receiptPrinter.print('test', 'preview', testRequest.current);
      setMessage({ severity: result.status === 'queued' ? 'success' : 'warning', text: result.status === 'queued'
        ? 'Test receipt queued on the Restaurant PC. Check the paper output.' : result.message || 'Print submission pending.' });
      if (result.status === 'queued') { testRequest.current = null; sessionStorage.removeItem('restaurantai-test-print'); }
    } catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'Print response unavailable. Check the host queue.' }); }
    finally { setBusy(false); }
  };
  const selected = model?.printers.find(printer => printer.name === form.printerName);
  return <Box component="section" id="printer-settings" sx={{ scrollMarginTop: 90, minWidth: 0 }}>
    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Printer Settings</Typography>
    <Stack spacing={2}>
      {model && <Typography variant="body2">Host: {model.host} | {selected?.status || 'Not connected'}</Typography>}
      {model?.connectionError && <Alert severity="warning">{model.connectionError}</Alert>}
      {message && <Alert severity={message.severity}>{message.text}</Alert>}
      <Button startIcon={<RefreshIcon />} disabled={busy} onClick={load}>Refresh printers</Button>
      {['printerName', 'kitchenPrinterName'].map(key => <TextField key={key} select label={key === 'printerName' ? 'Receipt Printer' : 'Kitchen Printer (reserved)'}
        value={form[key]} disabled={busy || !model?.supported} onChange={event => change(key, event.target.value)} fullWidth>
        <MenuItem value="">Not selected</MenuItem>
        {form[key] && !model?.printers.some(printer => printer.name === form[key]) && <MenuItem value={form[key]}>{form[key]} (unavailable)</MenuItem>}
        {(model?.printers || []).filter(printer => !printer.virtual).map(printer => <MenuItem key={printer.name} value={printer.name}>{printer.name}</MenuItem>)}
      </TextField>)}
      {selected && <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
        {selected.driver} | {selected.port} | Printable: {selected.printableWidthMm}mm (current form)
      </Typography>}
      <TextField select label="Paper Size" value={form.paperWidth} disabled={busy} onChange={event => {
        setForm(previous => ({ ...previous, paperWidth: event.target.value, charactersPerLine: event.target.value === '58mm' ? 28 : 42 })); setDirty(true);
      }}>
        {['58mm', '80mm'].map(size => <MenuItem key={size} value={size} disabled={selected && !selected.supportedPaperSizes?.includes(size)}>{size}</MenuItem>)}
      </TextField>
      <TextField label="Print Mode" value="Windows driver" disabled />
      <TextField type="number" label="Copies" value={form.copies} disabled={busy} slotProps={{ htmlInput: { min: 1, max: 5 } }} onChange={event => change('copies', Number(event.target.value))} />
      <Stack direction="row" spacing={1} sx={{ '& > .MuiTextField-root': { minWidth: 0, flex: 1 } }}>
        <TextField type="number" label="Font scale" value={form.fontScale} disabled={busy} slotProps={{ htmlInput: { min: .85, max: 1.15, step: .05 } }} onChange={event => change('fontScale', Number(event.target.value))} />
        <TextField type="number" label="Line spacing" value={form.lineSpacing} disabled={busy} slotProps={{ htmlInput: { min: 1, max: 1.5, step: .1 } }} onChange={event => change('lineSpacing', Number(event.target.value))} />
      </Stack>
      <FormControlLabel control={<Checkbox checked={form.enabled} disabled={busy} onChange={event => change('enabled', event.target.checked)} />} label="Receipt printing enabled" />
      <FormControlLabel control={<Checkbox checked={form.autoPrintKioskOrders} disabled={busy} onChange={event => change('autoPrintKioskOrders', event.target.checked)} />} label="Auto-print successful kiosk orders" />
      <Typography variant="caption">Cut / density: driver-managed. Logo / raw ESC/POS: unsupported.</Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, '& > button': { flexShrink: 0 } }}>
        <Button variant="contained" startIcon={<SaveIcon />} disabled={busy || !dirty || !model?.supported} onClick={save}>Save Settings</Button>
        <Button startIcon={<LocalPrintshopIcon />} disabled={busy || dirty || !form.enabled || !model?.supported} onClick={testPrint}>Test Print</Button>
        <Button startIcon={<VisibilityIcon />} disabled={busy || dirty || !model} onClick={() => navigate('/receipt/test/preview')}>Receipt Preview</Button>
        <Button startIcon={<RestartAltIcon />} disabled={busy} onClick={() => {
          if (window.confirm('Reset printer settings to disabled safe defaults? Save to apply.')) { setForm(safeDefaults); setDirty(true); }
        }}>Reset</Button>
      </Stack>
    </Stack>
  </Box>;
}
