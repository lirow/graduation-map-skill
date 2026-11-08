'use strict';
// End-to-end browser checks use only the repository's synthetic demonstration.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

const root = path.resolve(__dirname, '..');
const htmlPath = path.resolve(process.env.DEMO_HTML || path.join(root, 'examples/demo.html'));
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

async function contextPage(browser, viewport, mobile) {
  const context = await browser.newContext({viewport, isMobile:mobile, hasTouch:mobile, deviceScaleFactor:1, reducedMotion:'reduce', offline:true});
  const page = await context.newPage();
  const errors = [], remoteRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  page.on('request', request => {if (/^https?:/.test(request.url())) remoteRequests.push(request.url());});
  await page.goto(pathToFileURL(htmlPath).href, {waitUntil:'load', timeout:15000});
  await settle(page);
  return {context, page, errors, remoteRequests};
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

(async () => {
  if (!fs.existsSync(htmlPath)) throw new Error('Build examples/demo.html first, or set DEMO_HTML to a generated HTML file.');
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}), args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try {
    const desktop = await contextPage(browser,{width:1440,height:960},false);
    try {
      const {page} = desktop;
      assert.equal(await page.locator('#total-count').textContent(),'18');
      assert.equal(await page.locator('#school-count').textContent(),'9');
      await screenshot(page,'desktop.png');
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
      assert.deepEqual(desktop.errors,[]);assert.deepEqual(desktop.remoteRequests,[]);
      results.push({name:'desktop offline search, grouped members, detail, home, source empty state',pass:true});
    } finally {await desktop.context.close();}

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
      assert.deepEqual(phone.errors,[]);assert.deepEqual(phone.remoteRequests,[]);
      results.push({name:'small portrait and landscape controls, drawer, visible point, offline resources',pass:true});
    } finally {await phone.context.close();}
  } finally {await browser.close();clearTimeout(timeout);}
  console.log(JSON.stringify(results,null,2));
})().catch(error => {console.error(error);process.exitCode=1;});
