import { useEffect, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../services/api';
import { subscribeToMenuUpdates } from '../../utils/menuEvents';

export default function MenuSyncStatus() {
  const [status,setStatus]=useState(null),[error,setError]=useState(false),[retrying,setRetrying]=useState(false);
  useEffect(()=>{
    let stopped=false,busy=false;const controller=new AbortController();
    const refresh=async()=>{if(stopped||busy||document.hidden)return;busy=true;
      try{const response=await api.get('/menu/sync/status',{signal:controller.signal});if(!stopped){setStatus(response.data.data);setError(false);}}
      catch(error){if(!stopped)setError(error.response?.data?.code==='MENU_SCHEMA_MISSING'?'migration':'unavailable');}finally{busy=false;}};
    void refresh();const timer=setInterval(refresh,10000);const unsubscribe=subscribeToMenuUpdates(refresh);
    document.addEventListener('visibilitychange',refresh);
    return()=>{stopped=true;controller.abort();clearInterval(timer);unsubscribe();document.removeEventListener('visibilitychange',refresh);};
  },[]);
  const retry=async()=>{if(retrying)return;setRetrying(true);try{await api.post('/menu/sync/retry');setError(false);}catch{setError(true);}finally{setRetrying(false);}};
  const text=error==='migration'?'Local menu database update required (migration 018). Contact the administrator.':error?'Menu sync status is unavailable. Please retry shortly.':!status?'Checking menu sync...':{
    disabled:'Cloud synchronization disabled. Changes are saved locally.',configuration_error:'Menu sync needs configuration. Changes are saved locally.',
    pending:'Saved locally - syncing to website',synced:'Website menu updated',retrying:'Website sync delayed - changes will retry automatically',
    offline:'Cannot reach the cloud. Check the internet connection; changes will retry automatically.',
    cloud_error:'Cloud service error. Local changes will retry automatically.',
  }[status.state];
  return <Alert sx={{mb:2}} severity={error||['retrying','configuration_error','offline','cloud_error'].includes(status?.state)?'warning':status?.state==='synced'?'success':'info'}
    action={status?.enabled&&status.pending_changes>0?<Button onClick={retry} disabled={retrying} startIcon={<RefreshIcon/>}>Retry</Button>:null}>
    <Stack><Typography variant="body2">{text}</Typography>{!error&&status?.error_message&&<Typography variant="body2">{status.error_message}</Typography>}{!error&&status&&<Typography variant="caption">
      {status.pending_changes} pending changes. Last website sync: {status.last_success_at?new Date(status.last_success_at).toLocaleString():'Not yet'}
    </Typography>}</Stack>
  </Alert>;
}
