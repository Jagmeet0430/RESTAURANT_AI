import { pool } from '../config/database.js';
import { appConfig } from '../config/index.js';
import { menuSyncConfig } from '../config/menuSyncConfig.js';
import { asyncHandler, successResponse } from '../utils/index.js';

export const getMenuVersion=asyncHandler(async(req,res)=>{
  res.set('Cache-Control','no-store');
  return successResponse(res,(await pool.query('SELECT version FROM menu_sync_clock WHERE singleton')).rows[0]);
});
export const getMenuImage=asyncHandler(async(req,res)=>{
  if(!/^[a-f0-9]{64}\.webp$/.test(req.params.asset)) return res.sendStatus(404);
  const row=(await pool.query('SELECT data FROM menu_image_assets WHERE hash=$1',[req.params.asset.slice(0,-5)])).rows[0];
  if(!row)return res.sendStatus(404);
  res.set({'Content-Type':'image/webp','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}).send(row.data);
});
export const getMenuSyncStatus=asyncHandler(async(req,res)=>{
  res.set('Cache-Control','no-store');
  let enabled=false,configurationError=false;
  try {enabled=menuSyncConfig().enabled && appConfig.mode==='local';}catch{configurationError=true;}
  let summary,first;
  try {
  summary=(await pool.query(`SELECT count(*) FILTER(WHERE delivered_at IS NULL)::int pending_changes,
    max(delivered_at) last_success_at,max(created_at) last_local_save_at FROM menu_sync_outbox`)).rows[0];
  first=(await pool.query('SELECT last_error_code FROM menu_sync_outbox WHERE delivered_at IS NULL AND last_error_code IS NOT NULL ORDER BY version DESC LIMIT 1')).rows[0];
  } catch(error) {
    if (['42P01','42703'].includes(error.code)) return res.status(503).json({success:false,code:'MENU_SCHEMA_MISSING',
      message:'Local menu database update required. Apply migration 018 using the verified-backup upgrade process.'});
    throw error;
  }
  const reasons={SYNC_MENU_MAPPING_AMBIGUOUS:'An existing website product needs its identity confirmed.',
    SYNC_MENU_MAPPING_CONFLICT:'An existing website product has a conflicting identity.',SYNC_MENU_OWNER_MISMATCH:'Restaurant sync identity does not match.',
    SYNC_IMAGE_STORAGE_CONFIG:'Website image storage needs configuration.',SYNC_IMAGE_NOT_PUBLIC:'The uploaded image is not publicly accessible.',
    SYNC_IMAGE_UPLOAD_FAILED:'Image publication failed; it will retry.',SYNC_INVALID_IMAGE:'Replace the invalid product image.',
    SYNC_INVALID_IMAGE_URL:'Replace a local-only image link with an uploaded image or public HTTPS URL.',SYNC_MENU_DISABLED:'Menu sync is not enabled on the website backend.'};
  const code=first?.last_error_code;
  return successResponse(res,{...summary,enabled,error_message:enabled?reasons[code]||null:null,state:configurationError?'configuration_error':!enabled?'disabled':
    code==='SYNC_NETWORK_UNAVAILABLE'?'offline':/^SYNC_HTTP_/.test(code||'')?'cloud_error':
    code?'retrying':summary.pending_changes?'pending':'synced'});
});
export const retryMenuSync=asyncHandler(async(req,res)=>{
  if(appConfig.mode!=='local') return res.sendStatus(404);
  await pool.query('UPDATE menu_sync_outbox SET next_attempt_at=now() WHERE delivered_at IS NULL');
  return successResponse(res,{queued:true});
});
export function localMenuAuthority(req,res,next) {
  if(appConfig.mode==='online' && String(process.env.MENU_SYNC_ENABLED).toLowerCase()==='true') {
    return res.status(403).json({success:false,message:'Manage the menu from the Restaurant PC.'});
  }
  next();
}
