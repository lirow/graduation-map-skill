'use strict';
// End-to-end browser checks use only the repository's synthetic demonstration.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const htmlPath = process.env.DEMO_HTML ? path.resolve(process.env.DEMO_HTML) : null;
const screenshotDir = process.env.SCREENSHOT_DIR ? path.resolve(process.env.SCREENSHOT_DIR) : null;
const results = [];
const timeout = setTimeout(() => { console.error('Browser regression exceeded 60 seconds.'); process.exit(1); }, 60000);
timeout.unref();
const controls = ['zoom-in', 'zoom-out', 'pitch-button', 'rotate-button', 'layers-button', 'home-button'];

async function settle(page) {
  await page.waitForFunction(() => window.classMap?.state.ready && !classMap.map.isMoving(), null, {timeout: 15000});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function hitTest(page, ids = controls) {
  const hits = await page.evaluate(ids => ids.map(id => {
    const element = document.getElementById(id), box = element.getBoundingClientRect();
    const inside = box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest('button,input');
    return {id, inside, hit: hit?.id, box: {x:box.x, y:box.y, width:box.width, height:box.height}};
  }), ids);
  for (const item of hits) {
    assert.equal(item.inside, true, `${item.id} leaves viewport: ${JSON.stringify(item.box)}`);
    assert.equal(item.hit, item.id, `${item.id} is covered by ${item.hit}`);
  }
  return hits;
}

async function screenshot(page, filename) {
  if (!screenshotDir) return;
  fs.mkdirSync(screenshotDir, {recursive:true});
  await page.screenshot({path:path.join(screenshotDir, filename)});
}

async function contextPage(browser, viewport, mobile, override=null) {
  const context = await browser.newContext({viewport, isMobile:mobile, hasTouch:mobile, deviceScaleFactor:1, reducedMotion:'reduce', offline:true});
  const page = await context.newPage();
  const errors = [], remoteRequests = [], offlineFailures = [];
  // Connectivity flags can stay true when the transport is offline.
  await page.addInitScript(()=>Object.defineProperty(navigator,'onLine',{get:()=>true,configurable:true}));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if(message.type()!=='error')return;
    if(message.text()==='Failed to load resource: net::ERR_INTERNET_DISCONNECTED')offlineFailures.push(message.location().url);
    else errors.push(message.text());
  });
  page.on('request', request => {if (/^https?:/.test(request.url())) remoteRequests.push(request.url());});
  if(override) await page.addInitScript(options=>{
    Object.defineProperty(window,'CLASS_MAP_DATA',{configurable:true,set(data){
      if(options.noOrigin)data.origin=null;
      if(options.routesOff)data.map.showRoutes=false;
      Object.defineProperty(window,'CLASS_MAP_DATA',{value:data,writable:true,configurable:true});
    }});
  },override);
  await page.goto(pathToFileURL(htmlPath).href, {waitUntil:'load', timeout:15000});
  await settle(page);
  await page.waitForLoadState('networkidle',{timeout:5000});
  return {context, page, errors, remoteRequests, offlineFailures};
}

async function offlineChecks(result) {
  const source=await result.page.evaluate(()=>classMap.data.map.streetsSourceUrl);
  assert.deepEqual(result.errors,[]);
  assert.ok(result.remoteRequests.length>0,'Offline test must exercise an unreliable online flag.');
  for(const url of [...result.remoteRequests,...result.offlineFailures])assert.equal(url,source,'Only the optional street metadata probe may fail offline.');
  assert.equal(await result.page.evaluate(()=>classMap.state.streets),false);
  assert.equal(await result.page.locator('#streets-toggle').isChecked(),false);
  assert.equal(await result.page.locator('#toast').isHidden(),true);
}

async function touchChecks(page, context) {
  // Center the map over open ocean so every injected touch starts on the canvas,
  // rather than an HTML marker. No zoom API is called during the gesture itself.
  await page.evaluate(() => {
    classMap.resetView(false);
    classMap.map.jumpTo({center:[150,0], zoom:4, pitch:0, bearing:0, padding:{top:0,bottom:0,left:0,right:0}});
  });
  await settle(page);
  const center = {x:170, y:460};
  const clear = await page.evaluate(({x,y}) => [x-95,x-35,x+35,x+95].every(px => document.elementFromPoint(px,y)?.tagName === 'CANVAS'), center);
  assert.equal(clear, true, 'Touch gesture must start on unoccluded map canvas.');
  const client = await context.newCDPSession(page);
  async function gesture(start, end, angle = 0) {
    const points = (radius,a) => [
      {id:1,x:center.x-radius*Math.cos(a),y:center.y-radius*Math.sin(a)},
      {id:2,x:center.x+radius*Math.cos(a),y:center.y+radius*Math.sin(a)},
    ];
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(start,0)});
    for (let step=1;step<=12;step++) {
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(start+(end-start)*step/12,angle*step/12)});
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(250);
    return page.evaluate(() => ({zoom:classMap.map.getZoom(),bearing:classMap.map.getBearing()}));
  }
  const before = await page.evaluate(() => ({zoom:classMap.map.getZoom(),bearing:classMap.map.getBearing(),enabled:classMap.map.touchZoomRotate.isEnabled()}));
  const expanded = await gesture(35,95), contracted = await gesture(95,35), rotated = await gesture(70,70,.7);
  assert.equal(before.enabled,true);
  assert.ok(expanded.zoom > before.zoom + .5, 'Two-finger spread must zoom in.');
  assert.ok(contracted.zoom < expanded.zoom - .5, 'Two-finger pinch must zoom out.');
  assert.ok(Math.abs(rotated.bearing-contracted.bearing)>10, 'Two-finger rotation must change bearing.');
  results.push({name:'CDP two-finger zoom and rotation',pass:true,before,expanded,contracted,rotated});
}

async function streetChecks(browser) {
  const context = await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
  const page = await context.newPage();
  const errors = [], tileRequests = [];
  let available = true, stallSource = false, probes = 0;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://tiles.openfreemap.org/**', async route => {
    if(route.request().url() === 'https://tiles.openfreemap.org/planet') {
      probes++;
      if(stallSource)return;
      if(!available)return route.fulfill({status:503,body:'Unavailable',headers:{'access-control-allow-origin':'*'}});
      return route.fulfill({json:{tilejson:'3.0.0',tiles:['https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf'],minzoom:0,maxzoom:14},headers:{'access-control-allow-origin':'*'}});
    }
    tileRequests.push(route.request().url());
    return route.fulfill({status:200,body:Buffer.alloc(0),headers:{'access-control-allow-origin':'*'}});
  });
  try {
    await page.goto(pathToFileURL(htmlPath).href);await settle(page);
    await page.waitForFunction(()=>classMap.state.streets);
    assert.equal(await page.locator('#streets-toggle').isChecked(),true);
    assert.equal(await page.evaluate(()=>classMap.map.getLayer('street-road') && classMap.map.getLayoutProperty('street-road','visibility')!=='none'),true);
    assert.equal(await page.locator('#toast').isHidden(),true);
    await page.evaluate(()=>classMap.map.jumpTo({center:[104.06,30.67],zoom:10}));
    await settle(page);
    await page.waitForFunction(()=>classMap.map.loaded()&&classMap.map.isSourceLoaded('streets'));
    assert.ok(tileRequests.length>0,'Street zoom must request vector tiles.');
    assert.ok(tileRequests.every(url=>/\/test\/\d+\/\d+\/\d+\.pbf$/.test(url)),'Map tile placeholders must expand to numeric coordinates.');

    await context.setOffline(true);
    await page.evaluate(()=>window.dispatchEvent(new Event('offline')));
    await page.waitForFunction(()=>!classMap.state.streets);
    assert.equal(await page.evaluate(()=>!!classMap.map.getSource('streets')),false);
    assert.equal(await page.locator('#streets-toggle').isChecked(),false);
    assert.equal(await page.locator('#toast').isHidden(),true);

    await context.setOffline(false);
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.waitForFunction(()=>classMap.state.streets);
    await page.locator('#layers-button').click();
    await page.locator('#streets-toggle').uncheck();
    const before = probes;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    assert.equal(await page.evaluate(()=>classMap.state.streets),false);
    assert.equal(probes,before,'Automatic recovery must respect a manual opt-out.');

    available=false;
    const failedResponse=page.waitForResponse(response=>response.url()==='https://tiles.openfreemap.org/planet');
    await page.locator('#streets-toggle').click();
    await failedResponse;
    await page.waitForFunction(()=>!document.getElementById('streets-toggle').checked);
    assert.equal(await page.evaluate(()=>!!classMap.map.getSource('streets')),false);
    assert.equal(await page.locator('#toast').isHidden(),true);
    assert.doesNotMatch(await page.locator('#layer-note').innerText(),/不可用|正在加载|联网/);

    available=true;
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await page.waitForFunction(()=>classMap.state.streets);
    await page.evaluate(()=>classMap.map.fire('error',{sourceId:'streets',error:new Error('Synthetic tile failure')}));
    assert.equal(await page.evaluate(()=>classMap.state.streets),false);
    assert.equal(await page.locator('#streets-toggle').isChecked(),false);
    assert.equal(await page.locator('#toast').isHidden(),true);
    assert.deepEqual(errors,[]);

    stallSource=true;
    const timeoutRequest=page.waitForEvent('requestfailed',{predicate:request=>request.url()==='https://tiles.openfreemap.org/planet',timeout:8000});
    await page.evaluate(()=>window.dispatchEvent(new Event('online')));
    await timeoutRequest;
    assert.equal(await page.evaluate(()=>classMap.state.streets),false);
    assert.equal(await page.locator('#toast').isHidden(),true);
    results.push({name:'automatic streets, silent offline/service/tile/timeout fallback, recovery and manual opt-out',pass:true});
  } finally {await context.close();}
}

(async () => {
  if (!htmlPath || !fs.existsSync(htmlPath)) throw new Error('Set DEMO_HTML to a generated fictional demonstration HTML.');
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}), args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    await streetChecks(browser);
    const desktop = await contextPage(browser,{width:1440,height:960},false);
    try {
      const {page} = desktop;
      assert.equal(await page.locator('#total-count').textContent(),'18');
      assert.equal(await page.locator('#school-count').textContent(),'9');
      assert.equal(await page.locator('#routes-toggle').isChecked(),true);
      assert.equal(await page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'visible');
      assert.ok(await page.evaluate(()=>classMap.map.getSource('routes')._data.features.length>0));
      await screenshot(page,'desktop.png');
      await page.locator('#layers-button').click();
      await page.locator('#routes-toggle').uncheck();
      assert.equal(await page.evaluate(()=>classMap.state.routes),false);
      assert.equal(await page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'none');
      await page.evaluate(()=>{classMap.selectSchool('demo-sc');classMap.resetView(false);});await settle(page);
      assert.equal(await page.locator('#routes-toggle').isChecked(),false);
      assert.equal(await page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'none');
      await page.locator('#routes-toggle').check();
      assert.equal(await page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'visible');
      await page.locator('#layers-button').click();
      await page.locator('#search').fill('示例同学14');
      assert.equal(await page.locator('#list [data-student]').count(),1);
      await page.locator('#clear-search').click();
      await page.evaluate(() => classMap.selectProvince('四川省'));await settle(page);
      assert.equal(await page.locator('#list [data-student]').count(),3);
      await page.evaluate(() => classMap.selectSchool('demo-sc'));await settle(page);
      assert.equal(await page.locator('#detail .name-chip').count(),3);
      assert.match(await page.locator('#detail').innerText(),/示例西南校区/);
      await page.locator('#home-button').click();await settle(page);
      assert.equal(await page.locator('#detail').isHidden(),true);
      assert.ok(await page.evaluate(() => classMap.map.getZoom()<classMap.data.map.regionLabelMaxZoom));
      await page.evaluate(() => classMap.selectStudent('demo-16'));await settle(page);
      assert.equal(await page.locator('#campus-zoom').count(),0);
      await page.evaluate(() => openSourceReview('demo-01'));
      await page.waitForFunction(() => document.querySelector('#source-review .sr-image-error')?.textContent.includes('原图'));
      assert.match(await page.locator('#source-review .sr-image-error').textContent(),/未附加|没有找到/);
      await page.keyboard.press('Escape');
      await offlineChecks(desktop);
      results.push({name:'desktop offline search, grouped members, detail, home, source empty state',pass:true});
    } finally {await desktop.context.close();}

    for(const override of [{noOrigin:true},{routesOff:true}]){
      const variant=await contextPage(browser,{width:1440,height:960},false,override);
      try{
        assert.equal(await variant.page.locator('#routes-toggle').isChecked(),false);
        assert.equal(await variant.page.locator('#routes-toggle').isDisabled(),!!override.noOrigin);
        assert.equal(await variant.page.evaluate(()=>classMap.state.routes),false);
        assert.equal(await variant.page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'none');
        await offlineChecks(variant);
      }finally{await variant.context.close();}
    }
    results.push({name:'routes default on, reversible switch, explicit opt-out and missing origin',pass:true});

    const phone = await contextPage(browser,{width:320,height:568},true);
    try {
      const {page} = phone;
      await hitTest(page);
      await page.evaluate(() => classMap.selectSchool('demo-sc'));await settle(page);
      await hitTest(page);
      await page.locator('#layers-button').click();
      await hitTest(page,['labels-toggle','routes-toggle','streets-toggle']);
      await page.locator('#layers-button').click();
      await page.setViewportSize({width:844,height:390});await page.waitForTimeout(200);await settle(page);
      await hitTest(page);
      const visible = await page.evaluate(() => {
        const school=classMap.data.schools.find(s=>s.id==='demo-sc'),point=classMap.map.project([school.lng,school.lat]);
        return document.elementFromPoint(point.x,point.y)?.tagName === 'CANVAS';
      });
      assert.equal(visible,true,'Rotated device must keep the school point outside the detail card.');
      await page.locator('#mobile-list-button').click();
      const list=await page.locator('#list').boundingBox();assert.ok(list && list.height>30);
      await page.locator('#mobile-close').click();
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);await page.evaluate(() => classMap.resetView(false));await settle(page);
      await screenshot(page,'mobile.png');
      await touchChecks(page,phone.context);
      await offlineChecks(phone);
      results.push({name:'small portrait and landscape controls, drawer, visible point, offline resources',pass:true});
    } finally {await phone.context.close();}
  } finally {await browser.close();clearTimeout(timeout);}
  console.log(JSON.stringify(results,null,2));
})().catch(error => {console.error(error);process.exitCode=1;});
