const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const frontend = path.resolve(__dirname, '../frontend');
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const fixtureItem = { id:1, name:'Fixture roll', category_name:'Bakery', price:90, is_available:true, veg_type:'Veg' };

test('public menu revision compatibility without changing checkout state', async t => {
  let menuCalls=0, versionCalls=0, menuStatus=200, versionStatus=500, legacy=true, empty=false, revision=1, malformed=false;
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')) {
        assert.equal(req.method,'GET');
        let status=200,data={};
        if(url.pathname==='/api/menu'){menuCalls++;status=menuStatus;data=malformed?{unexpected:true}:empty?[]:[legacy?fixtureItem:{...fixtureItem,sync_version:revision}];}
        if(url.pathname==='/api/menu/version'){versionCalls++;status=versionStatus;data={version:revision};}
        if(url.pathname==='/api/settings/public')data={restaurantName:'Fixture',public_order_otp_required:true};
        if(url.pathname.startsWith('/api/tables/public/'))data={table:{id:1,table_number:'1'}};
        res.writeHead(status,{'Content-Type':'application/json'});
        return res.end(JSON.stringify({success:status===200,data,message:status===500?'Internal server error':undefined}));
      }
      const file=path.resolve(frontend,url.pathname==='/customer'?'index.html':url.pathname.slice(1));
      if(!file.startsWith(frontend+path.sep)){res.writeHead(403);return res.end();}
      const bytes=await fs.readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const open=async(route='/customer')=>{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await page.clock.install();
    await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
    await page.addInitScript(base=>window.RESTAURANTAI_API_BASE_URL=base,origin+'/api');
    await page.goto(origin+route,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>state.menuStatus!=='loading'&&!liveMenuRequest);
    return page;
  };
  const revisit=async page=>{
    const before=menuCalls;await page.clock.fastForward(2100);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>!liveMenuRequest&&!menuVersionRequest);
    assert.equal(menuCalls,before+1);
  };
  try {
    await t.test('legacy successful menu disables polling before calling the numeric-ID version trap',async()=>{
      const page=await open();try{
        assert.equal(await page.locator('.menu-card').count(),1);
        assert.equal(await page.evaluate(()=>publicMenuRevisionDisabled),true);
        assert.equal(await page.evaluate(()=>publicMenuPollTimer),null);
        const before=menuCalls;await page.clock.fastForward(60000);
        assert.equal(menuCalls,before);assert.equal(versionCalls,0);
        await revisit(page);assert.equal(versionCalls,0);
      }finally{await page.close();}
    });
    for(const status of [404,405,500,501])await t.test(`optional revision ${status} falls back once; no timer storm`,async()=>{
      legacy=false;versionStatus=status;const page=await open();try{
        const before=versionCalls;await page.evaluate(()=>refreshMenuIfChanged());
        assert.equal(versionCalls,before+1);assert.equal(await page.evaluate(()=>state.menuStatus),'ready');
        assert.equal(await page.evaluate(()=>publicMenuPollTimer),null);
        await page.clock.fastForward(60000);assert.equal(versionCalls,before+1);
        await revisit(page);assert.equal(versionCalls,before+1);
      }finally{await page.close();}
    });
    await t.test('empty legacy catalog probes once and remains a real empty result',async()=>{
      legacy=true;empty=true;versionStatus=500;const page=await open();try{
        await page.evaluate(()=>refreshMenuIfChanged());assert.equal(await page.evaluate(()=>state.menuStatus),'empty');
        assert.equal(await page.evaluate(()=>publicMenuRevisionDisabled),true);
      }finally{empty=false;await page.close();}
    });
    await t.test('initial menu 500 and malformed success remain errors with Retry',async()=>{
      for(const invalidShape of [false,true]){
        menuStatus=invalidShape?200:500;malformed=invalidShape;const page=await open();try{
          await page.locator('[data-retry-menu]').waitFor();assert.equal(await page.evaluate(()=>state.menuStatus),'error');
          malformed=false;menuStatus=200;await page.locator('[data-retry-menu]').click();await page.locator('.menu-card:not(.skeleton-card)').waitFor();
        }finally{await page.close();}
      }
    });
    await t.test('failed revisit remains visible; cart, customer, OTP and totals survive failure and retry',async()=>{
      legacy=true;const page=await open();try{
        await page.evaluate(()=>{
          state.cart=[{...menuItems[0],qty:2}];saveCart();
          elements.customerName.value='Preserved';elements.customerPhone.value='9876543210';
          state.phoneVerification.token='fixture-token';
        });
        const before=await page.evaluate(()=>JSON.stringify({cart:state.cart,name:elements.customerName.value,phone:elements.customerPhone.value,verification:state.phoneVerification}));
        menuStatus=503;await revisit(page);await page.locator('[data-retry-menu]').waitFor();
        assert.equal(await page.evaluate(()=>JSON.stringify({cart:state.cart,name:elements.customerName.value,phone:elements.customerPhone.value,verification:state.phoneVerification})),before);
        menuStatus=200;await page.locator('[data-retry-menu]').click();await page.locator('.menu-card:not(.skeleton-card)').waitFor();
        assert.equal(await page.evaluate(()=>state.cart[0].price*state.cart[0].qty),180);
        assert.equal(await page.evaluate(()=>state.phoneVerification.token),'fixture-token');
      }finally{menuStatus=200;await page.close();}
    });
    await t.test('supported revisions still refresh only on change; transient 503 does not disable support',async()=>{
      legacy=false;versionStatus=200;const page=await open();try{
        await page.evaluate(()=>refreshMenuIfChanged());const before=menuCalls;
        await page.evaluate(()=>refreshMenuIfChanged());assert.equal(menuCalls,before);
        revision++;await page.evaluate(()=>refreshMenuIfChanged());assert.equal(menuCalls,before+1);
        versionStatus=503;await page.evaluate(()=>refreshMenuIfChanged());assert.equal(await page.evaluate(()=>publicMenuRevisionDisabled),false);
      }finally{await page.close();}
    });
    await t.test('revisit bursts coalesce and back/forward restoration resumes fallback without revision polling',async()=>{
      legacy=true;const page=await open();try{
        const before=menuCalls;
        await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('hashchange'));document.dispatchEvent(new Event('visibilitychange'));});
        await page.waitForFunction(()=>!liveMenuRequest);assert.equal(menuCalls,before+1);
        await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide'));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
        await page.waitForFunction(()=>!liveMenuRequest);assert.equal(menuCalls,before+2);
        assert.equal(await page.evaluate(()=>publicMenuPollTimer),null);
      }finally{await page.close();}
    });
    await t.test('kiosk and table QR do not enter the public compatibility mode',async()=>{
      legacy=true;versionStatus=500;
      for(const route of ['/customer?kiosk=1','/customer?table=fixture-token']){
        const page=await open(route);try{
          assert.equal(await page.evaluate(()=>usesPublicMenuCompatibility()),false);
          assert.equal(await page.evaluate(()=>publicMenuRevisionDisabled),false);
          const before=versionCalls;await page.evaluate(()=>refreshMenuIfChanged());assert.equal(versionCalls,before+1);
        }finally{await page.close();}
      }
    });
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});

test('opt-in read-only Vercel-origin browser against deployed Render', {skip:process.env.RESTAURANTAI_LIVE_MENU_CHECK!=='true'},async()=>{
  const origin='https://restaurant-ai-nk2b.vercel.app',api='https://restaurant-ai-4myq.onrender.com';
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});const revisionRequests=[];
    await page.route('**/*',async route=>{
      const r=route.request(),url=new URL(r.url());
      if(url.origin===api&&r.method()==='GET'){
        if(url.pathname==='/api/menu/version')revisionRequests.push(r.url());
        return route.continue();
      }
      if(url.origin!==origin||r.method()!=='GET')return route.abort();
      const file=path.resolve(frontend,url.pathname==='/'||url.pathname==='/customer'?'index.html':url.pathname.slice(1));
      if(!file.startsWith(frontend+path.sep))return route.abort();
      try{return route.fulfill({body:await fs.readFile(file),contentType:types[path.extname(file)]||'application/octet-stream'});}catch{return route.abort();}
    });
    await page.goto(origin+'/customer');
    await page.waitForFunction(()=>state.menuStatus==='ready',null,{timeout:60000});
    assert.equal(await page.evaluate(()=>publicMenuRevisionDisabled),true);
    assert.ok(await page.locator('.menu-card').count()>0);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>!liveMenuRequest&&!menuVersionRequest);
    assert.equal(await page.evaluate(()=>state.menuStatus),'ready');assert.deepEqual(revisionRequests,[]);
    await fs.mkdir(path.resolve(__dirname,'../temp/menu-compatibility'),{recursive:true});
    await page.screenshot({path:path.resolve(__dirname,'../temp/menu-compatibility/render-mobile.png')});
    console.log('Live Render read-only browser PASS',{products:await page.evaluate(()=>menuItems.length),revisionRequests:revisionRequests.length});
  }finally{await browser.close();}
});
