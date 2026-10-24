import { pool } from '../config/database.js';
import { appConfig } from '../config/index.js';
import { menuSyncConfig } from '../config/menuSyncConfig.js';
import { syncError, syncLog } from '../config/cloudSyncConfig.js';
import { logger } from '../utils/logger.js';
import { imageHash, optimizeImage, safePublicImage, bundledImage, readBundledImage } from './menuImageService.js';

export function createMenuSyncWorker({ db=pool,config,fetchImpl=fetch,log=logger }={}) {
  let running=null,timer=null,stopped=false,controller=null;
  async function run() {
    // Coalesce offline edits, but keep their original identity for legacy cloud adoption.
    // Older events are acknowledged only after the newer snapshot is committed remotely.
    const {rows}=await db.query(`WITH latest AS (
      SELECT DISTINCT ON(entity,sync_id) * FROM menu_sync_outbox WHERE delivered_at IS NULL
      ORDER BY entity,sync_id,version DESC)
      SELECT latest.*,(SELECT first.payload FROM menu_sync_outbox first
        WHERE first.entity=latest.entity AND first.sync_id=latest.sync_id ORDER BY first.version LIMIT 1) identity_payload
      FROM latest ORDER BY (entity='category') DESC,version LIMIT 20`);
    if(!rows.length || new Date(rows[0].next_attempt_at)>new Date()) return;
    const events=[];
    try {
      for(const row of rows) {
        try {
        const event={ entity:row.entity,sync_id:row.sync_id,version:row.version,payload:{...row.payload},
          identity:{name:row.identity_payload.name,barcode:row.identity_payload.barcode,category_sync_id:row.identity_payload.category_sync_id} };
        const value=event.payload.image_url || '';
        if(!event.payload.deleted_at && imageHash(value)) {
          const asset=(await db.query('SELECT data FROM menu_image_assets WHERE hash=$1',[imageHash(value)])).rows[0];
          if(!asset) throw syncError('SYNC_IMAGE_MISSING');
          event.image_data=`data:image/webp;base64,${asset.data.toString('base64')}`;
          event.payload.image_url='';
        } else if(!event.payload.deleted_at && value.startsWith('data:')) {
          const asset=await optimizeImage(value);
          event.image_data=`data:image/webp;base64,${asset.data.toString('base64')}`;
          event.payload.image_url='';
        } else if(!event.payload.deleted_at && bundledImage(value)) {
          const asset=await readBundledImage(value);
          event.image_data=`data:image/webp;base64,${asset.data.toString('base64')}`;
          event.payload.image_url='';
        } else event.payload.image_url=event.payload.deleted_at?'':safePublicImage(value);
        if(events.length && Buffer.byteLength(JSON.stringify([...events,event]))>4*1024*1024) break;
        events.push(event);
        } catch(error) {
          if(!events.length)throw error;
          break; // Publish the valid prefix; retry the failed event when it reaches the head.
        }
      }
      if(stopped) return;
      controller=new AbortController();
      const timeout=setTimeout(()=>controller?.abort(),60000);
      let data;
      try {
        const response=await Promise.resolve().then(()=>fetchImpl(`${config.baseUrl}/sync/menu/batch`,{method:'POST',redirect:'error',signal:controller.signal,
          headers:{Authorization:`Bearer ${config.secret}`,'Content-Type':'application/json'},
          body:JSON.stringify({restaurant_id:config.restaurantId,source_id:config.sourceId,events})}))
          .catch(()=>{throw syncError('SYNC_NETWORK_UNAVAILABLE');});
        if(!response.ok) {
          const failure=await response.json().catch(()=>({}));
          const allowed=['SYNC_MENU_MAPPING_AMBIGUOUS','SYNC_MENU_MAPPING_CONFLICT','SYNC_MENU_OWNER_MISMATCH','SYNC_MENU_CATEGORY_PENDING',
            'SYNC_MENU_DISABLED','SYNC_IMAGE_STORAGE_CONFIG','SYNC_IMAGE_UPLOAD_FAILED','SYNC_IMAGE_NOT_PUBLIC','SYNC_INVALID_IMAGE'];
          throw syncError(allowed.includes(failure.code)?failure.code:`SYNC_HTTP_${response.status}`);
        }
        data=await response.json();
      } finally { clearTimeout(timeout);controller=null; }
      if(!data.success || !Array.isArray(data.data?.acknowledged) || data.data.acknowledged.length!==events.length ||
        events.some((e,i)=>String(data.data.acknowledged[i].version)!==String(e.version)||data.data.acknowledged[i].sync_id!==e.sync_id)) throw syncError('SYNC_INVALID_MENU_ACK');
      await db.query(`UPDATE menu_sync_outbox o SET delivered_at=now(),last_error_code=NULL
        FROM jsonb_to_recordset($1::jsonb) AS e(entity text,sync_id uuid,version bigint)
        WHERE o.entity=e.entity AND o.sync_id=e.sync_id AND o.version<=e.version AND o.delivered_at IS NULL`,
        [JSON.stringify(events.map(({entity,sync_id,version})=>({entity,sync_id,version})))]);
    } catch(error) {
      syncLog(log,'menu_push',error);
      await db.query(`UPDATE menu_sync_outbox SET attempts=attempts+1,last_error_code=$2,
        next_attempt_at=now()+($3::int*interval '1 second') WHERE version=$1`,
        [rows[0].version,/^SYNC_[A-Z0-9_]+$/.test(error.code||'')?error.code:'SYNC_RETRY',Math.min(300,5*2**Math.min(rows[0].attempts,6))]);
    }
  }
  function tick() {
    if(stopped||running) return running||Promise.resolve();
    running=run().catch(e=>syncLog(log,'menu_worker',e)).finally(()=>{running=null;});return running;
  }
  return {tick,start(){if(!timer&&!stopped){void tick();timer=setInterval(tick,config.intervalMs);timer.unref?.();}},
    async stop(){stopped=true;clearInterval(timer);controller?.abort();await running;}};
}
export function startMenuSyncWorker() {
  if(appConfig.mode!=='local') return null;
  try { const config=menuSyncConfig();if(!config.enabled)return null;
    const worker=createMenuSyncWorker({config});worker.start();return worker;
  } catch(error){syncLog(logger,'menu_configuration',error);return null;}
}
