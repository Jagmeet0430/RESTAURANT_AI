const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const output = path.join(root, 'temp/customer-usability');
const names = ['Puffs Patties & Rolls','Pastries','Swiss Roll','Donuts','Pies / Tarts','Muffins / Cupcakes',
  'Puddings','Perfect Pizzas','Burger & Sandwiches','Chaat','Chinese','South Indian','Indian Snacks',
  'Hot Beverages','Chilled Beverages','Milk Shakes','Mocktails','Delectable Desserts','Momos'];
const photos = ['puffs-patties-rolls.png','pastries.png','swiss-roll.png','donuts.png','pies-tarts.png',
  'muffins-cupcakes.png','puddings.png','perfect-pizzas.png','burger-sandwiches.png','chaat.png','chinese.png',
  'south-indian/masala-dosa.png','indian-snacks/samosa-with-chutney.png','hot-beverages/tea.png',
  'chilled-beverages/orange-juice.png','milk-shakes/mango-milk-shake.png','mocktails/mint-mojito.png',
  'delectable-desserts/jalebi.png','items/item-065-fried-momos-plate.png'];
const menu = names.map((category, i) => ({id:i+1, name:i ? category+' special' : 'Cheese Corn Roll', category,
  price:90+i*10, image_url:'assets/menu-items/'+photos[i], is_available:i!==2}));
menu.push({...menu[0],id:30,name:'Celebration Assorted Sweets Gift Box With Premium Dry Fruit Selection',price:9999.50});
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.svg':'image/svg+xml'};

test('public storefront usability: real assets, isolated APIs', {timeout:180000}, async t => {
  await fs.mkdir(output,{recursive:true});
  postcss.parse(await fs.readFile(path.join(frontend,'styles.css'),'utf8'));
  let menuCalls=0, mode='ready';
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        assert.equal(req.method,'GET','Usability fixtures must not submit real orders');
        let data={};
        if(url.pathname==='/api/menu'){menuCalls++;data=mode==='empty'?[]:menu;if(mode==='error'){res.writeHead(503);return res.end(JSON.stringify({success:false}));}}
        if(url.pathname==='/api/menu/version')data={version:1};
        if(url.pathname==='/api/settings/public')data={restaurantName:'Mahesh sweets and Bakers',public_order_otp_required:true};
        if(url.pathname==='/api/payments/methods')data={online_enabled:false};
        if(url.pathname.startsWith('/api/tables/public/'))data={table:{id:1,table_number:'1',display_name:'Table 1'}};
        res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});return res.end(JSON.stringify({success:true,data}));
      }
      const before=url.pathname.startsWith('/before/');
      let relative=url.pathname.replace(/^\/before/,'').replace(/^\//,'');
      if(!relative||relative==='customer')relative='index.html';
      const file=path.resolve(frontend,relative);
      if(!file.startsWith(frontend+path.sep)){res.writeHead(403);return res.end();}
      const snapshot=path.join(root,'temp/website-usability-before',relative);
      const bytes=before&&['index.html','styles.css','script.js'].includes(relative)?await fs.readFile(snapshot):await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=3600'});res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const open=async(width=1440,height=1000,route='/customer')=>{
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await page.addInitScript(api=>window.RESTAURANTAI_API_BASE_URL=api,origin+'/api');
    await page.goto(origin+route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>state.menuStatus!=='loading');
    return {page,errors};
  };
  try {
    for(const [width,height] of [[320,740],[375,812],[390,844],[412,915],[430,932],[768,1024],[1024,768],[1440,1000],[1920,1080]]) {
      await t.test(`${width}x${height}: search, categories, prices, touch targets and overflow`,async()=>{
        const {page,errors}=await open(width,height);
        try{
          await page.locator('#searchInput').scrollIntoViewIfNeeded();
          const search=await page.locator('.search-box').boundingBox(),rail=await page.locator('.category-selector').boundingBox();
          assert.ok(search.y+search.height<=rail.y,'search must have its own row');
          assert.equal(await page.locator('[data-category]').count(),20);
          assert.deepEqual(await page.locator('[data-category]').evaluateAll(bs=>bs.map(b=>b.dataset.category)),['All',...names]);
          assert.ok(await page.locator('.filter-icon img').count()===19);
          assert.ok(await page.locator('.price').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=22);
          assert.ok(await page.locator('.category-label').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=14);
          await page.locator('#searchInput').fill('cheese');await page.waitForFunction(()=>document.querySelectorAll('.menu-card').length===1);
          assert.match(await page.locator('.menu-card h3').innerText(),/Cheese/);
          await page.locator('[data-menu-add="1"]').dblclick();
          assert.equal(await page.evaluate(()=>state.cart[0].qty),1,'double click Add must not accidentally increment the replacement control');
          const plus=page.locator('[data-menu-id="1"][data-menu-delta="1"]');
          await plus.focus();await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(()=>state.cart[0].qty),2);
          assert.equal(await page.evaluate(()=>document.activeElement.dataset.menuDelta),'1','quantity focus survives rerender');
          for(const button of await page.locator('.card-qty-btn').all()){const r=await button.boundingBox();assert.ok(r.width>=44&&r.height>=44);}
          if(width<=768){await page.locator('#mobileCartButton').click();for(const button of await page.locator('#mobileCartSheet .qty-btn').all()){const r=await button.boundingBox();assert.ok(r.width>=44&&r.height>=44);}await page.keyboard.press('Escape');}
          else{for(const button of await page.locator('#cartItems .qty-btn').all()){const r=await button.boundingBox();assert.ok(r.width>=44&&r.height>=44);}}
          await page.locator('#searchInput').fill('');await page.waitForFunction(()=>document.querySelectorAll('.menu-card').length===20);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          assert.ok(await page.locator('.menu-card').evaluateAll(cards=>cards.every(c=>c.scrollWidth<=c.clientWidth+1)),'no card content overflow');
          await page.locator('#searchInput').scrollIntoViewIfNeeded();
          await page.screenshot({path:path.join(output,`menu-${width}.png`),animations:'disabled'});
          assert.deepEqual(errors,[]);
        }finally{await page.close();}
      });
    }
    await t.test('keyboard category selection, scroll position, unavailable items and retained cart',async()=>{
      const {page}=await open(390,844);
      try{
        await page.locator('[data-menu-add="1"]').click();
        await page.locator('[data-category="All"]').focus();await page.keyboard.press('End');
        assert.equal(await page.evaluate(()=>document.activeElement.dataset.category),'Momos');
        await page.keyboard.press('Enter');assert.equal(await page.locator('.menu-card').count(),1);
        assert.equal(await page.locator('[data-category="Momos"]').getAttribute('aria-pressed'),'true');
        assert.ok(await page.locator('#categoryFilters').evaluate(e=>e.scrollLeft)>0);
        await page.keyboard.press('Home');await page.keyboard.press('Enter');
        await page.locator('[data-category="Swiss Roll"]').click();assert.equal(await page.locator('.menu-card .add-btn').isDisabled(),true);
        await page.reload();await page.waitForFunction(()=>state.menuStatus==='ready');assert.equal(await page.evaluate(()=>state.cart[0].qty),1);
        await page.evaluate(()=>{state.cart[0].qty=MAX_ITEM_QUANTITY;renderCart();renderMenu();});
        assert.equal(await page.locator('[data-menu-id="1"][data-menu-delta="1"]').isDisabled(),true);
      }finally{await page.close();}
    });
    await t.test('error, empty and no-search-results states remain meaningful',async()=>{
      for(const value of ['error','empty','ready']){
        mode=value;const {page}=await open();try{
          if(value==='error'){await page.locator('[data-retry-menu]').waitFor();mode='ready';await page.locator('[data-retry-menu]').click();await page.locator('.menu-card').first().waitFor();}
          if(value==='empty')assert.match(await page.locator('.no-results').innerText(),/No menu items/);
          if(value==='ready'){await page.locator('#searchInput').fill('not-in-menu');await page.locator('.no-results').waitFor();assert.match(await page.locator('.no-results').innerText(),/No food found/);}
        }finally{await page.close();}
      }mode='ready';
    });
    await t.test('refresh is single-flight, images are lazy and reduced motion is honored',async()=>{
      mode='ready';
      const {page}=await open();try{
        const before=menuCalls;
        await page.evaluate(()=>Promise.all([loadLiveMenu(),loadLiveMenu(),loadLiveMenu()]));assert.equal(menuCalls-before,1);
        assert.equal(await page.locator('.menu-card img[loading="eager"]').count(),2);
        assert.equal(await page.locator('.menu-card img[loading="lazy"]').count(),18);
        assert.equal(await page.locator('.menu-card').first().evaluate(e=>getComputedStyle(e).animationName),'none');
        assert.equal(await page.locator('.primary-btn').first().evaluate(e=>getComputedStyle(e).borderRadius),'8px');
        await page.locator('#searchInput').focus();assert.equal(await page.locator('#searchInput').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
      }finally{await page.close();}
    });
    // Optional evidence from the preserved pre-edit files; never required by CI.
    if(await fs.access(path.join(root,'temp/website-usability-before/index.html')).then(()=>true,()=>false)){
      for(const [width,height] of [[390,844],[1440,1000]]){const {page}=await open(width,height,'/before/customer');try{await page.locator('#searchInput').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`before-${width}.png`),animations:'disabled'});}finally{await page.close();}}
    }
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
