import { isUuid } from '../config/menuSyncConfig.js';
import { syncError } from '../config/cloudSyncConfig.js';
import { publishMenuImage, safePublicImage } from './menuImageService.js';

function validate(event) {
  if (!event || !['product','category'].includes(event.entity) || !isUuid(event.sync_id) ||
      !Number.isSafeInteger(Number(event.version)) || Number(event.version)<1) throw syncError('SYNC_INVALID_MENU_EVENT',400);
  const p=event.payload;
  if(event.identity && (typeof event.identity.name!=='string'||event.identity.name.length>255||
    (event.identity.barcode!=null&&(typeof event.identity.barcode!=='string'||event.identity.barcode.length>100))||
    (event.entity==='product'&&!isUuid(event.identity.category_sync_id))))throw syncError('SYNC_INVALID_MENU_EVENT',400);
  if (!p || typeof p.name!=='string' || !p.name.trim() || p.name.length>(event.entity==='category'?100:255) ||
      (p.description!=null && (typeof p.description!=='string' || p.description.length>10000))) throw syncError('SYNC_INVALID_MENU_EVENT',400);
  if (p.deleted_at!=null && !Number.isFinite(Date.parse(p.deleted_at))) throw syncError('SYNC_INVALID_MENU_EVENT',400);
  for(const field of ['is_available','is_active','is_featured','is_spicy','visible_kiosk','visible_website']) {
    if(p[field]!=null && typeof p[field]!=='boolean') throw syncError('SYNC_INVALID_MENU_EVENT',400);
  }
  if(!Number.isInteger(Number(p.display_order ?? 0)) || Math.abs(Number(p.display_order ?? 0))>100000) throw syncError('SYNC_INVALID_MENU_EVENT',400);
  for(const field of ['preparation_time','calories']) {
    if(p[field]!=null&&(!Number.isInteger(Number(p[field]))||Number(p[field])<0||Number(p[field])>100000))throw syncError('SYNC_INVALID_MENU_EVENT',400);
  }
  if(event.entity==='product' && (!isUuid(p.category_sync_id) || !Number.isFinite(Number(p.price)) ||
      Number(p.price)<0 || Number(p.price)>999999 || !['veg','non-veg'].includes(String(p.veg_type).toLowerCase()) ||
      (p.barcode!=null && (typeof p.barcode!=='string' || p.barcode.length>100)))) throw syncError('SYNC_INVALID_MENU_EVENT',400);
  if(event.entity==='product'&&(!Number.isSafeInteger(Number(p.image_fallback_id??p.id))||Number(p.image_fallback_id??p.id)<1))throw syncError('SYNC_INVALID_MENU_EVENT',400);
  if(p.image_url!=null && (typeof p.image_url!=='string' || p.image_url.length>10000)) throw syncError('SYNC_INVALID_MENU_EVENT',400);
}

export async function applyMenuEvents(db, body, config, { publishImage = publishMenuImage } = {}) {
  if(body?.restaurant_id!==config.restaurantId || body?.source_id!==config.sourceId) throw syncError('SYNC_MENU_OWNER_MISMATCH',403);
  if(!Array.isArray(body.events) || !body.events.length || body.events.length>20) throw syncError('SYNC_INVALID_MENU_BATCH',400);
  body.events.forEach(validate);
  const acknowledged=[];
  for(const event of body.events) {
    const client=await db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query("SET LOCAL statement_timeout='30s'");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('restaurantai_menu_publish'))");
      await client.query("SELECT set_config('restaurantai.menu_import','on',true)");
      const receipt=(await client.query('SELECT version FROM menu_sync_receipts WHERE source_id=$1 AND entity=$2 AND sync_id=$3',
        [config.sourceId,event.entity,event.sync_id])).rows[0];
      if(!receipt || BigInt(receipt.version)<BigInt(event.version)) {
        const p=event.payload, owner=`${config.restaurantId}:${config.sourceId}`;
        const table=event.entity==='category'?'categories':'menu';
        let current=(await client.query(`SELECT * FROM ${table} WHERE sync_id=$1 FOR UPDATE`,[event.sync_id])).rows[0];
        let category;
        if(event.entity==='product') {
          category=(await client.query('SELECT * FROM categories WHERE sync_id=$1 AND sync_owner=$2',[p.category_sync_id,owner])).rows[0];
          if(!category) throw syncError('SYNC_MENU_CATEGORY_PENDING');
        }
        // Adopt a pre-existing cloud row only on a unique, explicit identity match.
        if(!current) {
          let candidates=event.entity==='category'
            ? await client.query('SELECT * FROM categories WHERE lower(trim(name))=lower(trim($1)) FOR UPDATE',[p.name])
            : p.barcode
              ? await client.query('SELECT * FROM menu WHERE barcode=$1 FOR UPDATE',[p.barcode])
              : await client.query('SELECT * FROM menu WHERE category_id=$1 AND lower(trim(name))=lower(trim($2)) FOR UPDATE',[category.id,p.name]);
          if(!candidates.rowCount&&event.identity) {
            const original=event.identity;
            candidates=event.entity==='category'
              ? await client.query('SELECT * FROM categories WHERE lower(trim(name))=lower(trim($1)) FOR UPDATE',[original.name])
              : original.barcode
                ? await client.query('SELECT * FROM menu WHERE barcode=$1 FOR UPDATE',[original.barcode])
                : await client.query(`SELECT m.* FROM menu m JOIN categories c ON c.id=m.category_id
                    WHERE c.sync_id=$1 AND c.sync_owner=$2 AND lower(trim(m.name))=lower(trim($3)) FOR UPDATE OF m`,[original.category_sync_id,owner,original.name]);
          }
          if(!candidates.rowCount&&event.entity==='product'&&p.barcode) {
            candidates=await client.query('SELECT * FROM menu WHERE category_id=$1 AND lower(trim(name))=lower(trim($2)) FOR UPDATE',[category.id,p.name]);
            if(candidates.rows.some(row=>row.barcode&&row.barcode!==p.barcode))throw syncError('SYNC_MENU_MAPPING_CONFLICT');
          }
          if(candidates.rowCount>1) throw syncError('SYNC_MENU_MAPPING_AMBIGUOUS');
          current=candidates.rows[0];
          if(current?.sync_owner) throw syncError('SYNC_MENU_MAPPING_CONFLICT');
        }
        if(current?.sync_owner && current.sync_owner!==owner) throw syncError('SYNC_MENU_OWNER_MISMATCH',403);
        const image=p.deleted_at?'':event.image_data
          ? await publishImage(event.image_data,{restaurantId:config.restaurantId})
          : safePublicImage(p.image_url || '');
        if(event.entity==='category') {
          const args=[p.name,p.description||'',image,Number(p.display_order||0),p.is_active!==false&&!p.deleted_at,event.sync_id,event.version,owner,p.deleted_at||null];
          if(current) await client.query(`UPDATE categories SET name=$1,description=$2,image_url=$3,display_order=$4,is_active=$5,
            sync_id=$6,sync_version=$7,sync_owner=$8,deleted_at=$9,updated_at=now() WHERE id=$10`,[...args,current.id]);
          else await client.query(`INSERT INTO categories(name,description,image_url,display_order,is_active,sync_id,sync_version,sync_owner,deleted_at)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,args);
        } else {
          const args=[p.name,category.id,p.description||'',p.price,p.veg_type,image,p.is_available!==false&&!p.deleted_at,
            p.is_featured===true,p.preparation_time??20,p.calories??null,p.is_spicy===true,p.barcode||null,
            Number(p.display_order||0),p.visible_kiosk!==false,p.visible_website!==false,event.sync_id,event.version,owner,p.deleted_at||null,p.image_fallback_id??p.id];
          if(current) await client.query(`UPDATE menu SET name=$1,category_id=$2,description=$3,price=$4,veg_type=$5,image_url=$6,
            is_available=$7,is_featured=$8,preparation_time=$9,calories=$10,is_spicy=$11,barcode=$12,display_order=$13,
            visible_kiosk=$14,visible_website=$15,sync_id=$16,sync_version=$17,sync_owner=$18,deleted_at=$19,image_fallback_id=$20,updated_at=now() WHERE id=$21`,[...args,current.id]);
          else await client.query(`INSERT INTO menu(name,category_id,description,price,veg_type,image_url,is_available,is_featured,
            preparation_time,calories,is_spicy,barcode,display_order,visible_kiosk,visible_website,sync_id,sync_version,sync_owner,deleted_at,image_fallback_id)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,args);
        }
        await client.query(`INSERT INTO menu_sync_receipts(source_id,entity,sync_id,version) VALUES($1,$2,$3,$4)
          ON CONFLICT(source_id,entity,sync_id) DO UPDATE SET version=EXCLUDED.version`,[config.sourceId,event.entity,event.sync_id,event.version]);
        await client.query('UPDATE menu_sync_clock SET version=version+1 WHERE singleton');
      }
      await client.query('COMMIT');
      acknowledged.push({ version:String(event.version),sync_id:event.sync_id });
    } catch(error) { await client.query('ROLLBACK');throw error; }
    finally { client.release(); }
  }
  return { acknowledged };
}
