import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {AsyncLocalStorage} from 'node:async_hooks';
import pg from 'pg';
import express from 'express';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import {chromium} from 'playwright';

const exec=promisify(execFile);
test('menu synchronization: isolated local/cloud PostgreSQL and real customer browser',{timeout:240000},async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'restaurantai-menu-sync-')),data=path.join(root,'data');
  const bin=process.env.RESTAURANTAI_TEST_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
  const pgExe=name=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
  const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
  const saved={...process.env};let started=false,local,cloud,server,browser,worker;
  try {
    await exec(pgExe('initdb'),['-D',data,'-U','postgres','-A','trust','--no-locale','-E','UTF8'],{windowsHide:true,timeout:30000});
    await exec(pgExe('pg_ctl'),['-D',data,'-l',path.join(root,'pg.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start'],{windowsHide:true,timeout:30000});started=true;
    local=new pg.Pool({host:'127.0.0.1',port,user:'postgres',database:'postgres'});
    await local.query('CREATE DATABASE cloud_fixture');
    cloud=new pg.Pool({host:'127.0.0.1',port,user:'postgres',database:'cloud_fixture'});
    const bootstrap=(await fs.readFile(new URL('../database/bootstrap/offline_v1_schema.sql',import.meta.url),'utf8')).split(/\r?\n/).filter(l=>!l.startsWith('\\')).join('\n');
    for(const db of [local,cloud]) {
      await db.query(bootstrap);await db.query('SET search_path=public');
      for(const file of ['013_counter_sale_idempotency.sql','014_table_qr_ordering.sql','015_billing_receipts_settlement.sql','016_cloud_order_sync.sql','017_admin_order_notifications.sql']) {
        await db.query(await fs.readFile(new URL(`../database/migrations/${file}`,import.meta.url),'utf8'));
      }
      await db.query("INSERT INTO admins(name,email,role) VALUES('Fixture','menu@example.invalid','admin')");
      await db.query("INSERT INTO customers(name,phone) VALUES('Fixture','+919876543210')");
      await db.query("INSERT INTO categories(name) VALUES('Bakery')");
      await db.query("INSERT INTO menu(id,category_id,name,price,veg_type,barcode) VALUES($1,1,'Original Roll',200,'Veg','MENU-ROLL')",[db===local?77:91]);
      await db.query("SELECT setval('menu_id_seq',100,true)");
    }
    const sql=await fs.readFile(new URL('../database/migrations/018_menu_sync.sql',import.meta.url),'utf8');
    await t.test('018 rolls back atomically and replays without duplicate snapshots or changed prices',async()=>{
      const c=await local.connect();try{await c.query('BEGIN');await c.query(sql);await c.query('ROLLBACK');}finally{c.release();}
      assert.equal((await local.query("SELECT to_regclass('public.menu_sync_outbox') x")).rows[0].x,null);
      for(const db of [local,cloud]){await db.query(sql);const before=(await db.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows;await db.query(sql);assert.deepEqual((await db.query('SELECT * FROM menu_sync_outbox ORDER BY version')).rows,before);}
      assert.equal(Number((await local.query('SELECT price FROM menu WHERE id=77')).rows[0].price),200);
    });
    Object.assign(process.env,{RESTAURANTAI_ENV_FILE:path.join(root,'absent.env'),RESTAURANTAI_ENV_PATH:path.join(root,'absent.env'),RESTAURANTAI_MODE:'local',
      NODE_ENV:'test',JWT_SECRET:'menu-sync-fixture-only',WHATSAPP_ENABLED:'false',PUBLIC_ORDER_OTP_REQUIRED:'false',MENU_SYNC_ENABLED:'false'});
    const context=new AsyncLocalStorage();
    mock.module('../src/config/database.js',{exports:{pool:{query:(...a)=>(context.getStore()||local).query(...a),connect:()=>(context.getStore()||local).connect()}}});
    mock.module('../src/services/ragService.js',{exports:{scheduleRagKnowledgeSync:()=>{}}});
    mock.module('../src/services/kioskReceiptAutoPrintService.js',{exports:{requestKioskReceiptAutoPrint:()=>{}}});
    const {default:menuRoutes}=await import('../src/routes/menuRoutes.js');
    const {default:categoryRoutes}=await import('../src/routes/categoriesRoutes.js');
    const {createCloudSyncRouter}=await import('../src/routes/cloudSyncRoutes.js');
    const {createMenuSyncWorker}=await import('../src/services/menuSyncService.js');
    const {applyMenuEvents}=await import('../src/services/menuSyncApiService.js');
    const {saveMenuImage,optimizeImage,publishMenuImage}=await import('../src/services/menuImageService.js');
    const {createCashOrder}=await import('../src/controllers/paymentController.js');
    const {pendingCloudOrders}=await import('../src/services/cloudOrderSyncApiService.js');
    const {importCloudOrder}=await import('../src/services/cloudOrderImportService.js');
    const {checkoutMenu,checkQuotedPrices}=await import('../src/services/menuCheckoutService.js');
    const config={enabled:true,restaurantId:crypto.randomUUID(),sourceId:crypto.randomUUID(),baseUrl:'https://cloud.fixture.invalid/api',secret:crypto.randomBytes(32).toString('hex'),intervalMs:10000};
    let offline=false,failImages=false,storageCalls=0;
    const photo=await sharp({create:{width:1200,height:600,channels:3,background:'#c81924'}}).png().toBuffer();
    const photoUrl=`data:image/png;base64,${photo.toString('base64')}`;
    const publishImage=async input=>{if(failImages)throw Object.assign(new Error('fixture image failure'),{code:'SYNC_IMAGE_UPLOAD_FAILED'});
      return publishMenuImage(input,{restaurantId:config.restaurantId,env:{MENU_IMAGE_STORAGE_URL:'https://fixture.supabase.co',MENU_IMAGE_STORAGE_SERVICE_KEY:'fixture-key'},
        fetchImpl:async(url,options)=>{storageCalls++;assert.equal(options.redirect,'error');if(options.method==='POST'){assert.equal(options.headers.Authorization,'Bearer fixture-key');assert.ok(Buffer.isBuffer(options.body));}
          return new Response(null,{status:200,headers:{'content-type':'image/webp'}});}});};
    const app=express();app.use(express.json({limit:'6mb'}));
    app.use('/api/menu',menuRoutes);app.use('/api/categories',categoryRoutes);app.post('/api/payments/cash-order',createCashOrder);
    app.use('/cloud/api/menu',(req,res,next)=>context.run(cloud,next),menuRoutes);
    app.post('/cloud/api/payments/cash-order',(req,res)=>context.run(cloud,()=>createCashOrder(req,res)));
    app.use('/api/sync',createCloudSyncRouter({db:cloud,mode:'online',secret:()=>config.secret,menuConfig:()=>config,menuOptions:{publishImage}}));
    app.use('/customer',express.static(path.resolve('frontend')));
    app.use((e,req,res,next)=>res.status(e.statusCode||500).json({success:false,code:e.code,message:'Fixture request failed'}));
    server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const origin=`http://127.0.0.1:${server.address().port}`;
    const api=async(url,body,method,authorized=true)=>{const response=await fetch(origin+url,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',...(authorized?{Authorization:`Bearer ${jwt.sign({id:1,role:'admin'},process.env.JWT_SECRET)}`}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};};
    const fetchImpl=(url,options)=>{if(offline)throw new Error('Fixture offline');return fetch(url.replace(config.baseUrl,origin+'/api'),options);};
    const log={warn:()=>{}};
    const drain=async()=>{for(let i=0;i<10;i++){await worker.tick();if(!(await local.query('SELECT 1 FROM menu_sync_outbox WHERE delivered_at IS NULL')).rowCount)return;}assert.fail('Outbox did not drain');};
    worker=createMenuSyncWorker({db:local,config,fetchImpl,log});
    await t.test('initial sync adopts existing cloud IDs; explicit ACK prevents duplicates',async()=>{
      await drain();const row=(await cloud.query('SELECT * FROM menu WHERE barcode=$1',['MENU-ROLL'])).rows[0];
      assert.equal(row.id,91);assert.equal(row.sync_id,(await local.query('SELECT sync_id FROM menu WHERE id=77')).rows[0].sync_id);
      assert.equal(row.image_fallback_id,77);
      assert.equal((await cloud.query('SELECT count(*)::int n FROM menu')).rows[0].n,1);
      await drain();assert.equal((await cloud.query('SELECT count(*)::int n FROM menu')).rows[0].n,1);
    });
    await t.test('unauthorized edits/sync and wrong restaurant are rejected',async()=>{
      assert.equal((await api('/api/menu',{name:'No'},'POST',false)).status,401);
      assert.equal((await api('/api/sync/menu/batch',{events:[]})).status,401);
      await assert.rejects(applyMenuEvents(cloud,{restaurant_id:crypto.randomUUID(),source_id:config.sourceId,events:[]},config),{code:'SYNC_MENU_OWNER_MISMATCH'});
    });
    await t.test('rolled-back local changes never enter the outbox',async()=>{
      const before=(await local.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n;
      const client=await local.connect();try{await client.query('BEGIN');await client.query("UPDATE menu SET name='Rollback' WHERE id=77");await client.query('ROLLBACK');}finally{client.release();}
      assert.equal((await local.query('SELECT count(*)::int n FROM menu_sync_outbox')).rows[0].n,before);
    });
    await t.test('coalesced pre-first-sync rename adopts the original cloud identity',async()=>{
      const row=(await local.query("INSERT INTO menu(category_id,name,price,veg_type) VALUES(1,'Before first sync',10,'Veg') RETURNING *")).rows[0];
      const original=(await cloud.query("INSERT INTO menu(category_id,name,price,veg_type) VALUES(1,'Before first sync',10,'Veg') RETURNING id")).rows[0];
      await local.query("UPDATE menu SET name='After first sync',price=15 WHERE id=$1",[row.id]);
      await drain();
      assert.equal((await cloud.query('SELECT id FROM menu WHERE sync_id=$1',[row.sync_id])).rows[0].id,original.id);
      assert.equal((await cloud.query("SELECT count(*)::int n FROM menu WHERE name IN ('Before first sync','After first sync')")).rows[0].n,1);
      await local.query('UPDATE menu SET deleted_at=now(),is_available=false WHERE id=$1',[row.id]);await drain();
    });
    await t.test('sync status and retry require authentication and report actual durable state',async()=>{
      const status=await api('/api/menu/sync/status');assert.equal(status.status,200);assert.equal(status.body.data.state,'disabled');
      assert.equal(status.body.data.pending_changes,0);assert.ok(status.body.data.last_success_at);
      assert.equal((await api('/api/menu/sync/status',undefined,'GET',false)).status,401);
      assert.equal((await api('/api/menu/sync/retry',{},'POST',false)).status,401);
      await local.query("UPDATE menu SET description='Status check' WHERE id=77");
      assert.equal((await api('/api/menu/sync/status')).body.data.pending_changes,1);
      assert.equal((await api('/api/menu/sync/retry',{})).status,200);await drain();
    });
    await t.test('image validation, aspect ratio and local persistent image endpoint',async()=>{
      const asset=await optimizeImage(photoUrl),metadata=await sharp(asset.data).metadata();assert.equal(metadata.width,900);assert.equal(metadata.height,450);
      await assert.rejects(optimizeImage('data:image/png;base64,'+Buffer.from('<svg/>').toString('base64')));
      await assert.rejects(optimizeImage('data:image/jpeg;base64,'+photo.toString('base64')));
      const oversized=await sharp({create:{width:6001,height:1,channels:3,background:'#fff'}}).png().toBuffer();
      await assert.rejects(optimizeImage('data:image/png;base64,'+oversized.toString('base64')));
      await assert.rejects(optimizeImage('data:image/png;base64,'+Buffer.alloc(2097153).toString('base64')));
      await assert.rejects(saveMenuImage(local,'http://192.168.1.5/private.png'));
      await assert.rejects(saveMenuImage(local,'file:///C:/private.png'));
      await assert.rejects(publishMenuImage(photoUrl,{restaurantId:config.restaurantId,env:{}}),{code:'SYNC_IMAGE_STORAGE_CONFIG'});
      await assert.rejects(publishMenuImage(photoUrl,{restaurantId:config.restaurantId,
        env:{MENU_IMAGE_STORAGE_URL:'https://fixture.supabase.co',MENU_IMAGE_STORAGE_SERVICE_KEY:'fixture'},
        fetchImpl:async(url,options)=>new Response(null,{status:options.method==='HEAD'?403:200})}),{code:'SYNC_IMAGE_NOT_PUBLIC'});
      const savedImage=await saveMenuImage(local,photoUrl);const response=await fetch(origin+savedImage);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/image\/webp/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),asset.data);
    });
    let savedItem;
    await t.test('Admin create/update queues snapshots; stale edits fail; offline saves survive worker restart',async()=>{
      const created=await api('/api/menu',{name:'New Roll',category_id:1,price:300,veg_type:'Veg',description:'Fresh',image_url:photoUrl});
      assert.equal(created.status,201,JSON.stringify(created.body));savedItem=created.body.data;
      offline=true;await worker.tick();assert.ok((await local.query('SELECT 1 FROM menu_sync_outbox WHERE delivered_at IS NULL AND attempts>0')).rowCount);
      assert.equal((await local.query('SELECT last_error_code FROM menu_sync_outbox WHERE delivered_at IS NULL AND attempts>0 ORDER BY version LIMIT 1')).rows[0].last_error_code,'SYNC_NETWORK_UNAVAILABLE');
      assert.equal((await cloud.query("SELECT count(*)::int n FROM menu WHERE name='New Roll'")).rows[0].n,0);
      const updated=await api(`/api/menu/${savedItem.id}`,{description:'Edited',sync_version:savedItem.sync_version},'PUT');assert.equal(updated.status,200);
      assert.equal((await api(`/api/menu/${savedItem.id}`,{price:1,sync_version:savedItem.sync_version},'PUT')).status,409);
      await worker.stop();worker=createMenuSyncWorker({db:local,config,fetchImpl,log});offline=false;
      await local.query('UPDATE menu_sync_outbox SET next_attempt_at=now() WHERE delivered_at IS NULL');await drain();
      const published=(await cloud.query('SELECT * FROM menu WHERE sync_id=$1',[savedItem.sync_id])).rows[0];assert.equal(published.description,'Edited');assert.match(published.image_url,/^https:\/\/fixture.supabase.co\/storage\/v1\/object\/public\//);assert.ok(storageCalls>=2);
    });
    await t.test('failed image publication leaves prior cloud version live and remains retryable',async()=>{
      const before=(await cloud.query('SELECT * FROM menu WHERE id=91')).rows[0];
      assert.equal((await api('/api/menu/77',{image_url:photoUrl,price:250},'PUT')).status,200);
      failImages=true;await worker.tick();assert.equal((await cloud.query('SELECT price FROM menu WHERE id=91')).rows[0].price,before.price);
      failImages=false;await local.query('UPDATE menu_sync_outbox SET next_attempt_at=now() WHERE delivered_at IS NULL');await drain();
      assert.equal(Number((await cloud.query('SELECT price FROM menu WHERE id=91')).rows[0].price),250);
    });
    await t.test('older and duplicate batches cannot overwrite newer names/prices',async()=>{
      const event=(await local.query("SELECT * FROM menu_sync_outbox WHERE entity='product' AND (payload->>'id')::int=77 ORDER BY version LIMIT 1")).rows[0];
      await applyMenuEvents(cloud,{restaurant_id:config.restaurantId,source_id:config.sourceId,events:[event,event]},config,{publishImage});
      assert.equal(Number((await cloud.query('SELECT price FROM menu WHERE id=91')).rows[0].price),250);
    });
    await t.test('lost ACK and superseded invalid image recover without a duplicate product',async()=>{
      await api('/api/menu/77',{description:'ACK recovery'},'PUT');
      await worker.stop();let loseAck=true;
      worker=createMenuSyncWorker({db:local,config,log,fetchImpl:async(url,options)=>{const response=await fetchImpl(url,options);if(loseAck){loseAck=false;await response.arrayBuffer();throw new Error('Lost response');}return response;}});
      await worker.tick();assert.ok((await local.query('SELECT 1 FROM menu_sync_outbox WHERE delivered_at IS NULL')).rowCount);
      await local.query('UPDATE menu_sync_outbox SET next_attempt_at=now() WHERE delivered_at IS NULL');await drain();
      assert.equal((await cloud.query("SELECT count(*)::int n FROM menu WHERE barcode='MENU-ROLL'")).rows[0].n,1);
      await local.query("UPDATE menu SET image_url='http://192.168.1.10/legacy.png' WHERE id=77");await worker.tick();
      await api('/api/menu/77',{image_url:photoUrl},'PUT');await drain();
      assert.match((await cloud.query('SELECT image_url FROM menu WHERE id=91')).rows[0].image_url,/^https:/);
    });
    await t.test('kiosk and public browser refresh prices/images without resetting cart or customer',async()=>{
      browser=await chromium.launch({channel:'msedge',headless:true});
      for(const kiosk of [true,false]) {
        const page=await browser.newPage({viewport:kiosk?{width:1080,height:1920}:{width:390,height:844}});
        await page.addInitScript(base=>{window.RESTAURANTAI_API_BASE_URL=base;},origin+(kiosk?'/api':'/cloud/api'));
        const thumbnail=(await optimizeImage(photoUrl)).data;
        await page.route('**/*',route=>{const url=new URL(route.request().url());
          if(url.hostname==='fixture.supabase.co')return route.fulfill({contentType:'image/webp',body:thumbnail});
          if(url.origin!==origin)return route.abort();
          if(url.pathname.includes('/api/')&&!url.pathname.includes('/menu'))return route.fulfill({json:{success:true,data:{restaurantName:'Fixture',public_order_otp_required:false}}});return route.continue();});
        await page.goto(origin+'/customer/'+(kiosk?'?kiosk=1':''));
        await page.waitForFunction(()=>state.menuStatus==='ready');
        await page.evaluate(kiosk=>{if(kiosk){setKioskScreen('menu');state.kiosk.customerName='Preserved';state.kiosk.customerPhone='9000000000';}else{elements.customerName.value='Preserved';elements.customerPhone.value='9000000000';}
          const item=menuItems.find(i=>i.name==='Original Roll');state.cart=[{...item,qty:2}];saveCart();},kiosk);
        const price=kiosk?260:270;await api('/api/menu/77',{price,description:'Browser refresh'},'PUT');await drain();
        await page.evaluate(()=>refreshMenuIfChanged());
        assert.equal(await page.evaluate(()=>state.cart[0].qty),2);assert.equal(await page.evaluate(()=>state.cart[0].price),price);
        assert.equal(await page.evaluate(kiosk=>kiosk?state.kiosk.customerName:elements.customerName.value,kiosk),'Preserved');
        const selector=kiosk?'.kiosk-item-photo img':'.menu-card .item-photo img';
        await page.locator(selector).first().scrollIntoViewIfNeeded();
        await page.waitForFunction(selector=>[...document.querySelectorAll(selector)].every(img=>img.complete&&img.naturalWidth===900),selector);
        assert.ok(await page.locator(selector).first().evaluate(img=>img.currentSrc.includes('/menu/images/')||img.currentSrc.includes('/storage/v1/object/public/')));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:path.join(root,kiosk?'kiosk.png':'website.png'),fullPage:false});await page.close();
      }
    });
    let cloudOrder;
    await t.test('current-price check, disabled product, channel visibility and category status are enforced',async()=>{
      const rows=(await checkoutMenu(local,[77],'kiosk')).rows;
      assert.throws(()=>checkQuotedPrices([{menu_id:77,expected_unit_price:200}],rows),{code:'MENU_PRICE_CHANGED'});
      assert.equal((await api('/api/payments/cash-order',{customer_id:1,order_source:'kiosk',order_type:'pickup',items:[{menu_id:77,quantity:1,expected_unit_price:200}],idempotency_key:crypto.randomUUID()})).status,409);
      await api('/api/menu/77',{is_available:false},'PUT');assert.equal((await checkoutMenu(local,[77],'kiosk')).rows[0].is_available,false);
      await api('/api/menu/77',{is_available:true,visible_website:false},'PUT');assert.equal((await checkoutMenu(local,[77],'website')).rows[0].is_available,false);
      await api('/api/menu/77',{visible_website:true},'PUT');await api('/api/categories/1',{is_active:false},'PUT');assert.equal((await checkoutMenu(local,[77],'kiosk')).rows[0].is_available,false);
      await api('/api/categories/1',{is_active:true},'PUT');await drain();
    });
    await t.test('offline kiosk and synced cloud order preserve totals and stable mapping through renames',async()=>{
      offline=true;
      const payload={customer_id:1,order_source:'kiosk',order_type:'pickup',payment_method:'pay_at_counter',items:[{menu_id:77,quantity:1}],idempotency_key:crypto.randomUUID()};
      const order=await api('/api/payments/cash-order',payload);assert.equal(order.status,201,JSON.stringify(order.body));assert.equal(Number(order.body.data.order.total_amount),283.5);
      offline=false;
      let web;
      process.env.RESTAURANTAI_MODE='online';
      try {web=await api('/cloud/api/payments/cash-order',{...payload,order_source:'customer_web',items:[{menu_id:91,quantity:1}],idempotency_key:crypto.randomUUID()});}
      finally {process.env.RESTAURANTAI_MODE='local';}
      assert.equal(web.status,201,JSON.stringify(web.body));cloudOrder=web.body.data.order;
      await api('/api/menu/77',{name:'Renamed Roll'},'PUT');
      const pending=(await pendingCloudOrders(cloud)).find(o=>o.cloud_order_id===cloudOrder.id);assert.ok(pending.items[0].stable_product_id);
      const first=await importCloudOrder(local,pending,config.baseUrl),again=await importCloudOrder(local,pending,config.baseUrl);assert.equal(first.order.id,again.order.id);
      assert.equal(Number(first.order.total_amount),283.5);assert.equal((await local.query('SELECT menu_id FROM order_items WHERE order_id=$1',[first.order.id])).rows[0].menu_id,77);
      offline=false;await drain();
    });
    await t.test('soft deletion preserves historical lines/totals and category identity',async()=>{
      const before=(await local.query('SELECT id,total_amount FROM orders ORDER BY id')).rows;
      await local.query("UPDATE orders SET status='Completed'");
      assert.equal((await api('/api/menu/77',undefined,'DELETE')).status,200);await drain();
      assert.ok((await cloud.query('SELECT deleted_at FROM menu WHERE id=91')).rows[0].deleted_at);
      assert.equal((await api('/api/menu?channel=kiosk')).body.data.some(i=>i.id===77),false);
      assert.deepEqual((await local.query('SELECT id,total_amount FROM orders ORDER BY id')).rows,before);
      assert.ok((await local.query('SELECT * FROM order_items WHERE menu_id=77')).rowCount);
      const cat=(await local.query('SELECT * FROM categories WHERE id=1')).rows[0];await api('/api/categories/1',{name:'New Bakery'},'PUT');await drain();
      assert.equal((await cloud.query('SELECT name FROM categories WHERE sync_id=$1',[cat.sync_id])).rows[0].name,'New Bakery');
    });
  } finally {
    try {await worker?.stop();await browser?.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await local?.end();await cloud?.end();}
    finally {if(started||await fs.access(path.join(data,'postmaster.pid')).then(()=>true,()=>false))await exec(pgExe('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{windowsHide:true,timeout:30000});
      for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved);
      assert.equal(await fs.access(path.join(data,'postmaster.pid')).then(()=>true,()=>false),false);console.log(`Isolated menu-sync PostgreSQL stopped; evidence: ${root}`);}
  }
});
