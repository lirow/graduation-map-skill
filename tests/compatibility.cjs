'use strict';
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const html = process.env.DEMO_HTML;
const results = [];
const watchdog = setTimeout(()=>{console.error('Compatibility checks exceeded 120 seconds.');process.exit(1);},120000);
watchdog.unref();

async function ready(page) {
  await page.waitForFunction(()=>window.classMap?.state.ready && document.getElementById('fatal').hidden,null,{timeout:12000});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

async function open(browser, mode, viewport={width:390,height:844}) {
  const context=await browser.newContext({viewport,offline:true,isMobile:true,hasTouch:true,deviceScaleFactor:3,reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  await page.addInitScript(mode=>{
    Object.defineProperty(navigator,'onLine',{get:()=>false,configurable:true});
    const originalContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,options){
      if(mode==='no-webgl' && /webgl/i.test(type))return null;
      if(/webgl/i.test(type))window.__glAttributes=options;
      return originalContext.call(this,type,options);
    };
    if(mode==='no-worker')window.Worker=undefined;
    if(mode==='no-maplibre')Object.defineProperty(window,'maplibregl',{configurable:true,get:()=>undefined,set:()=>{}});
    if(mode==='blocked-worker')window.Worker=class{constructor(){throw new DOMException('Blocked blob worker','SecurityError');}};
    if(mode==='stalled-worker'){
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker{postMessage(){}};
      const nativeTimeout=window.setTimeout;
      window.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===8000||delay===20000?250:delay,...args);
    }
  },mode);
  await page.goto(pathToFileURL(path.resolve(html)).href);
  return {context,page,errors,requests};
}

async function fallbackChecks(result, mode) {
  const {page}=result;
  await ready(page);
  assert.equal(await page.evaluate(()=>classMap.state.renderer),'2d');
  assert.equal(await page.locator('#total-count').textContent(),'18');
  assert.ok(await page.locator('#map .leaflet-overlay-pane path').count()>30,'Fallback must draw the embedded geography.');
  assert.equal(await page.locator('#pitch-button').isDisabled(),true);
  assert.equal(await page.locator('#rotate-button').isDisabled(),true);
  assert.equal(await page.locator('#streets-toggle').isDisabled(),true);
  assert.equal(await page.locator('#toast').isHidden(),true);
  await page.locator('#mobile-list-button').click();
  await page.locator('#search').fill('示例同学14');
  assert.equal(await page.locator('#list [data-student]').count(),1);
  await page.locator('#clear-search').click();
  await page.locator('#mobile-close').click();
  await page.evaluate(()=>classMap.selectSchool('demo-sc'));await ready(page);
  assert.equal(await page.locator('#detail .name-chip').count(),3);
  assert.match(await page.locator('#detail').innerText(),/示例西南校区/);
  const point=await page.evaluate(()=>{
    const p=classMap.map.project([104.06,30.67]),r=document.getElementById('detail').getBoundingClientRect();
    return {inside:p.x>=0&&p.x<innerWidth&&p.y>=0&&p.y<innerHeight,covered:p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom};
  });
  assert.equal(point.inside,true);assert.equal(point.covered,false);
  await page.locator('#layers-button').click();
  await page.locator('#routes-toggle').uncheck();
  assert.equal(await page.evaluate(()=>classMap.map.getLayoutProperty('routes','visibility')),'none');
  await page.locator('#labels-toggle').uncheck();
  await page.locator('#layers-button').click();
  await page.locator('#home-button').click();await ready(page);
  assert.equal(await page.locator('#detail').isHidden(),true);
  assert.equal(await page.evaluate(()=>classMap.state.routes),false);
  const before=await page.evaluate(()=>classMap.map.getZoom());
  await page.locator('#zoom-in').click();
  assert.ok(await page.evaluate(()=>classMap.map.getZoom())>before);
  await page.evaluate(()=>classMap.selectProvince('加拿大'));await ready(page);
  assert.equal(await page.locator('#list [data-student]').count(),1);
  await page.evaluate(()=>classMap.selectStudent('demo-18'));await ready(page);
  assert.match(await page.locator('#detail').innerText(),/去向待补充/);
  await page.setViewportSize({width:844,height:390});await ready(page);
  const hits=await page.evaluate(()=>['zoom-in','zoom-out','layers-button','home-button'].map(id=>{
    const el=document.getElementById(id),r=el.getBoundingClientRect();
    return {id,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.id};
  }));
  for(const hit of hits)assert.equal(hit.hit,hit.id);
  await page.evaluate(()=>{classMap.resetView(false);document.getElementById('about').showModal();});
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#export-data').click();
  const download=await downloadPromise,stream=await download.createReadStream(),chunks=[];
  for await(const chunk of stream)chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(exported.students.length,18);
  assert.equal(exported.students.find(s=>s.id==='demo-03').schoolId,'demo-sc');
  await page.evaluate(()=>document.getElementById('about').close());
  if(mode==='no-webgl'){
    await page.setViewportSize({width:390,height:844});
    await page.waitForFunction(()=>classMap.map._map.getSize().x===390);
    await page.evaluate(()=>classMap.map.easeTo({center:[150,0],zoom:4,padding:{top:0,right:0,bottom:0,left:0}}));
    const client=await result.context.newCDPSession(page);
    const before=await page.evaluate(()=>classMap.map.getZoom());
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:150,y:460},{id:2,x:210,y:460}]});
    for(let i=1;i<=10;i++){
      await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:150-i*5,y:460},{id:2,x:210+i*5,y:460}]});
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(z=>classMap.map.getZoom()>z+.4,before);
    const center=await page.evaluate(()=>classMap.map.getCenter().lng);
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:130,y:500}]});
    for(let i=1;i<=10;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:130+i*8,y:500}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(lng=>Math.abs(classMap.map.getCenter().lng-lng)>.1,center);
    await page.evaluate(()=>classMap.resetView(false));
    results.push({name:'2D real two-contact pinch zoom and single-contact pan',pass:true});
  }
  assert.deepEqual(result.requests,[]);
  assert.deepEqual(result.errors,[]);
  if(process.env.SCREENSHOT_DIR){
    fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});
    await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,`fallback-${mode}.png`)});
  }
  results.push({name:`offline 2D with ${mode}: geography, roster, selection, routes, controls, export`,pass:true});
}

(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    for(const mode of ['no-maplibre','no-webgl','no-worker','blocked-worker','stalled-worker']){
      const result=await open(browser,mode);
      try{await fallbackChecks(result,mode);}finally{await result.context.close();}
    }
    const normal=await open(browser,'normal');
    try{
      await ready(normal.page);
      assert.equal(await normal.page.evaluate(()=>classMap.state.renderer),'webgl');
      const graphics=await normal.page.evaluate(()=>({ratio:classMap.map.getCanvas().width/innerWidth,pitch:classMap.map.getPitch(),antialias:window.__glAttributes.antialias}));
      assert.ok(graphics.ratio<=1.51,'Mobile backing canvas must not multiply full device DPR.');
      assert.equal(graphics.antialias,false);
      assert.ok(graphics.pitch<=25,'The mobile overview should start with a gentler camera tilt.');
      await normal.page.evaluate(()=>classMap.selectSchool('demo-sc'));
      await normal.page.locator('#layers-button').click();
      await normal.page.locator('#routes-toggle').uncheck();
      await normal.page.locator('#layers-button').click();
      await normal.page.evaluate(()=>{
        document.getElementById('fatal').hidden=false;
        window.__previousMap=classMap.map;classMap.map.fire('webglcontextlost');
      });
      await ready(normal.page);
      assert.equal(await normal.page.evaluate(()=>classMap.state.renderer),'2d');
      assert.equal(await normal.page.evaluate(()=>classMap.state.school),'demo-sc');
      assert.equal(await normal.page.locator('#detail .name-chip').count(),3);
      assert.equal(await normal.page.evaluate(()=>classMap.state.routes),false);
      assert.equal(await normal.page.locator('#fatal').isHidden(),true);
      await normal.page.evaluate(()=>window.__previousMap.fire('load'));
      assert.equal(await normal.page.evaluate(()=>classMap.state.renderer),'2d');
      assert.equal(await normal.page.evaluate(()=>classMap.state.school),'demo-sc');
      assert.deepEqual(normal.errors,[]);
      results.push({name:'mobile graphics budget and context-loss recovery preserve selection',pass:true,graphics});
    }finally{await normal.context.close();}
  }finally{await browser.close();clearTimeout(watchdog);}
  console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
