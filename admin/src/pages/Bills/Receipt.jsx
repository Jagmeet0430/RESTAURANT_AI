import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import ComputerIcon from '@mui/icons-material/Computer';
import SettingsIcon from '@mui/icons-material/Settings';
import ThermalReceipt from '../../components/ThermalReceipt';
import { receiptPrinter, newPrintRequestId } from '../../services/receiptPrinter';

export default function Receipt() {
  const { source, id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [paper, setPaper] = useState('80mm');
  const sending = useRef(false);
  const automatic = useRef(false);
  const pending = useRef(null);
  const storageKey = `restaurantai-admin-print:${source}:${id}`;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setModel(null); setResult(null);
    automatic.current = false; pending.current = null;
    receiptPrinter.preview(source, id).then(data => {
      if (active) { setModel({ ...data, requestKey: storageKey }); setPaper(data.config.paperWidth); }
    }).catch(error => { if (active) setError(error.response?.data?.message || 'Receipt could not be loaded.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [source, id, storageKey]);

  const print = useCallback(async () => {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError('');
    try {
      // Retain this reference across reloads/timeouts; checking it cannot spool twice.
      const requestId = pending.current || sessionStorage.getItem(storageKey) || newPrintRequestId();
      pending.current = requestId;
      sessionStorage.setItem(storageKey, requestId);
      const outcome = await receiptPrinter.print(source, id, requestId);
      setResult(outcome);
      // A refresh of an auto-print URL must check the same job, not send a new copy.
    } catch (error) {
      setError(error.response?.data?.message || 'Printer response unavailable. Check this request before reprinting.');
    } finally { sending.current = false; setBusy(false); }
  }, [source, id, storageKey]);

  useEffect(() => {
    if (model?.requestKey !== storageKey || params.get('print') !== '1' || automatic.current) return;
    automatic.current = true;
    void print();
  }, [model, params, print, storageKey]);

  const reprint = () => {
    if (!window.confirm('Check the printer queue first. Send another copy?')) return;
    sessionStorage.removeItem(storageKey); pending.current = null; setResult(null);
    void print();
  };

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  return <Box className="receipt-page" data-paper-width={paper === '58mm' ? '58' : '80'}>
    <Stack className="receipt-actions" spacing={2}>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/bills')}>Back to Bills</Button>
        <Button startIcon={<SettingsIcon />} onClick={() => navigate('/settings#printer-settings')}>Printer Settings</Button>
      </Stack>
      {model && <Typography variant="body2">Restaurant PC: {model.host} | Printer: {model.config.printerName || 'Not selected'} | {model.config.paperWidth}</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      {result && <Alert severity={result.status === 'queued' ? 'success' : 'warning'}>
        {result.status === 'queued' ? 'Queued on the Restaurant PC. Physical printing is not confirmed.' : result.message || 'Submission pending. Check the printer queue before reprinting.'}
      </Alert>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button variant="contained" startIcon={<LocalPrintshopIcon />} disabled={busy || !model?.supported}
          onClick={result?.status === 'queued' ? reprint : print}>
          {busy ? 'Sending...' : result?.status === 'queued' ? 'Reprint on Restaurant PC' : pending.current ? 'Check print request' : 'Print on Restaurant PC'}
        </Button>
        {['unknown', 'submitting'].includes(result?.status) && <Button disabled={busy} onClick={reprint}>Send another copy</Button>}
        <Button startIcon={<ComputerIcon />} disabled={!model || busy} onClick={() => window.print()}>Print from this browser</Button>
        <TextField select size="small" label="Browser paper" value={paper} onChange={event => setPaper(event.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="58mm">58mm</MenuItem><MenuItem value="80mm">80mm</MenuItem>
        </TextField>
      </Stack>
      {model && !model.supported && <Alert severity="warning">Restaurant PC printing is unavailable on this backend.</Alert>}
    </Stack>
    {model && <ThermalReceipt layout={model.layout} paperWidth={paper} fontScale={model.config.fontScale} lineSpacing={model.config.lineSpacing} />}
  </Box>;
}
