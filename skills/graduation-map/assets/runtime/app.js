(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const data = window.CLASS_MAP_DATA;
  const config = data.map;
  const provinces = JSON.parse($('province-geo').textContent);
  const world = JSON.parse($('world-geo').textContent);
  let model;
  try { model = createClassMapModel(data, provinces, world); }
  catch (error) {
    $('loading').hidden=true; $('fatal').hidden=false;
    $('fatal-message').textContent='页面数据有误：'+error.message;
    return;
  }
  const {schools,students,counts,schoolStudents,activeSchools,referencedSchools,
    provinceByName,sortedProvinces,unknown,stats,regionOf,regionCenter,
    isOverseas,isLocated,isCampusConfirmed,overseasGeometryNames} = model;
  const readableName = s => s.name || `姓名待补充 · ${s.id}`;
  const nameLabel = s => `${readableName(s)}${s.nameStatus==='needs_review'?'〔待核〕':''}`;
  const reviewCount = stats.needsReview;
  const state = {tab:'provinces', province:null, unknownOnly:false, query:'', school:null, student:null, labels:true, routes:config.showRoutes !== false && isLocated(data.origin), streets:false, ready:false,scope:'domestic',renderer:'webgl'};
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const landscapeCompact = () => innerWidth > innerHeight && innerWidth <= 1024 && innerHeight <= 500;
  const mobile = () => innerWidth <= 760 || landscapeCompact();
  const compactDevice = mobile() || matchMedia('(pointer:coarse)').matches;
  const hasOriginPoint = () => isLocated(data.origin);
  const duration = n => reduceMotion ? 0 : n;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const short = province => provinceByName.get(province)?.properties.shortName || province || '待补充';
  const announce = text => {$('live-status').textContent = text;};
  let toastTimer;
  function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3400); }
  const className=data.meta.className||'我们的班级';
  const classTitle=data.meta.title||`${className} · 毕业去向`;
  const year=data.meta.year;
  const rosterSummary=!stats.total?'尚未录入同学，添加毕业生数据后会自动显示。':data.meta.rosterComplete?`全班 ${stats.total} 位同学，名单已确认完整，无遗漏。`:`已收录 ${stats.total} 位同学，名单仍可继续补充。`;
  const originTitle=data.origin ? [data.origin.name,data.origin.campus].filter(Boolean).join(' · ') : '母校待补充';
  const originStatus=data.origin ? (isCampusConfirmed(data.origin)?'就读校区已确认。':'当年就读校区待确认。') : '母校信息待补充。';
  const nameSummary=!stats.total?'尚未录入同学。':reviewCount?`${reviewCount} 个姓名待核，${stats.confirmedNames} 个姓名已由用户校对。`:`${stats.confirmedNames} 个姓名已由用户校对。`;
  document.title=`那年同窗 · ${classTitle}`;
  document.querySelector('meta[name="description"]').content=`${classTitle}。${rosterSummary}`;
  $('brand-subtitle').textContent=`${className} · 录取去向`;
  $('header-caption').textContent=[data.origin?.name,'我们的下一站'].filter(Boolean).join(' · ');
  $('class-eyebrow').textContent=[data.origin?.name,className].filter(Boolean).join(' · ');
  $('total-count').textContent=stats.total;
  $('total-count-label').textContent=data.meta.rosterComplete?'位同班同学':'位已收录同学';
  $('province-count').textContent=stats.domesticRegions;
  $('school-count').textContent=stats.schoolCount;
  $('province-tab-count').textContent=counts.size;
  $('student-tab-count').textContent=stats.total;
  $('coverage').textContent=`${data.meta.rosterComplete?'全班':'已收录'} ${stats.total} 人 · 海外 ${stats.overseas} 人${stats.unknown?' · 去向待补 '+stats.unknown+' 人':''}`;
  $('pending-button').textContent=!stats.total?'暂无名单':reviewCount?`${reviewCount} 个姓名待核 ↗`:'查看全部同学 ↗';
  $('pending-button').disabled=!stats.total;
  $('source-status').textContent=data.meta.isDemo?'虚构数据演示':`从这里出发 · ${reviewCount?'部分姓名待核':stats.confirmedNames===stats.total&&stats.total?'姓名已校对':'录取去向'}`;
  $('overseas-button').textContent=`国内 / 海外 · ${stats.overseas}`;
  $('overseas-button').disabled=!stats.overseas;
  $('mobile-list-button').querySelector('small').textContent=`${stats.total} 位同学`;
  $('routes-toggle').disabled=!hasOriginPoint();
  $('routes-toggle').checked=state.routes;
  $('origin-name').textContent=originTitle;
  $('origin-note').textContent=originStatus;
  $('origin-note').hidden=true;
  $('origin-name').onclick=()=>{$('origin-note').hidden=!$('origin-note').hidden;};
  $('settings-description').textContent=`母校：${originTitle}；${originStatus}连线表示录取去向，不是实际行程。`;
  $('loading-caption').textContent=year?`正在展开 ${year} 年的夏天`:'正在展开我们的去向地图';
  $('about-kicker').textContent=[data.origin?.name,className].filter(Boolean).join(' · ');
  $('about-summary').textContent=`${rosterSummary}国内 ${stats.provinceKnown} 人，海外 ${stats.overseas} 人${stats.unknown?'，去向待补充 '+stats.unknown+' 人':''}，涉及 ${stats.schoolCount} 所学校。`;
  $('about-name-status').textContent=data.meta.isDemo?'当前姓名、学校和去向全部为虚构示例，仅用于演示交互。':`${nameSummary}页面与导出均读取同一份业务数据。`;
  $('about-locations').textContent=`${stats.locatedSchools} 所学校有地图位置，${stats.unlocatedSchools} 所尚缺坐标；${stats.campusUnconfirmed} 所学校的当年就读校区尚待确认。各学校卡片分别说明确认状态。`;
  $('about-origin').textContent=`母校：${originTitle}；${originStatus}${data.origin?.address||''}`;
  if(!hasOriginPoint())$('routes-toggle').closest('label').title='母校坐标待补充后启用连线';
  for (const f of provinces.features) f.properties.count = counts.get(f.properties.name) || 0;
  const feat = (geometry, properties={}) => ({type:'Feature',properties,geometry});
  const collection = features => ({type:'FeatureCollection',features});
  const grid = [];
  for (let lng=65;lng<=150;lng+=5) grid.push(feat({type:'LineString',coordinates:[[lng,10],[lng,58]]}));
  for (let lat=10;lat<=55;lat+=5) grid.push(feat({type:'LineString',coordinates:[[65,lat],[150,lat]]}));
  let map;
  let mapLoadTimer, initialized=false;
  function fail(message) { clearTimeout(mapLoadTimer); $('loading').classList.add('done'); $('fatal-message').textContent = message; $('fatal').hidden = false; }
  const mapOptions = {container:'map', attributionControl:false, center:config.defaultCenter, zoom:config.defaultZoom, minZoom:config.minZoom, maxZoom:config.maxZoom, pitch:compactDevice?Math.min(25,config.defaultPitch):config.defaultPitch, maxPitch:65, bearing:config.defaultBearing, renderWorldCopies:false,
      pixelRatio:Math.min(devicePixelRatio||1,compactDevice?1.5:2),maxCanvasSize:compactDevice?[2560,2560]:[4096,4096],
      canvasContextAttributes:{antialias:!compactDevice}, style:{version:8,glyphs:config.glyphsUrl, sources:{
        world:{type:'geojson',data:world}, provinces:{type:'geojson',data:provinces}, grid:{type:'geojson',data:collection(grid)}
      }, layers:[
        {id:'ocean',type:'background',paint:{'background-color':'#0c202b'}},
        {id:'world-fill',type:'fill',source:'world',paint:{'fill-color':'#18313c','fill-opacity':.8}},
        {id:'world-edge',type:'line',source:'world',paint:{'line-color':'#38505a','line-width':.5,'line-opacity':.55}},
        {id:'overseas-fill',type:'fill',source:'world',filter:['in',['get','name'],['literal',overseasGeometryNames]],paint:{'fill-color':'#49766c','fill-opacity':.6}},
        {id:'grid',type:'line',source:'grid',maxzoom:8,paint:{'line-color':'#74969c','line-opacity':.075,'line-width':.7}},
        {id:'province-fill',type:'fill',source:'provinces',paint:{'fill-color':['case',['>', ['get','count'],0],'#346364','#203e4b'],'fill-opacity':['interpolate',['linear'],['zoom'],6,.9,9,.32]}},
        {id:'province-volume',type:'fill-extrusion',source:'provinces',maxzoom:7.2,paint:{'fill-extrusion-color':['case',['>', ['get','count'],0],['interpolate',['linear'],['get','count'],1,'#3a696b',5,'#6b9785'],'#203d49'],'fill-extrusion-height':['case',['>', ['get','count'],0],15000,4500],'fill-extrusion-base':0,'fill-extrusion-opacity':.92}},
        {id:'province-edge',type:'line',source:'provinces',paint:{'line-color':['case',['>', ['get','count'],0],'#a6c7b4','#53727a'],'line-width':['interpolate',['linear'],['zoom'],3,.5,7,1,12,1.5],'line-opacity':['interpolate',['linear'],['zoom'],6,.75,10,.35]}},
        {id:'province-selected',type:'line',source:'provinces',filter:['==',['get','name'],''],paint:{'line-color':'#e6bc83','line-width':2,'line-opacity':.9}}
      ].filter(layer=>!compactDevice||layer.id!=='province-volume')}
    };
  try {
    if(typeof Worker!=='function')throw new Error('Workers unavailable');
    map = new maplibregl.Map(mapOptions);
  } catch {
    state.renderer='2d';
    try { map=window.createOfflineMap(mapOptions); }
    catch { fail('地图暂时无法启动，请重新打开文件。');return; }
  }
  function configureMap() {
    const fallback=state.renderer==='2d';
    for(const id of ['pitch-button','rotate-button','north-button'])$(id).disabled=fallback;
    $('streets-toggle').disabled=fallback;
    if(!fallback){
      map.addControl(new maplibregl.AttributionControl({compact:true,customAttribution:'Made with Natural Earth'}), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({maxWidth:90,unit:'metric'}), 'bottom-left');
    }
    map.getCanvas().setAttribute('aria-label','班级地图');
    syncPitchButton();
  }
  function activateFallback(reason) {
    if(state.renderer==='2d')return;
    clearTimeout(mapLoadTimer);
    stopStreets();
    state.ready=false;state.renderer='2d';state.fallbackReason=reason;
    const previous=map;
    try {previous.remove();}catch {}
    try {
      map=window.createOfflineMap(mapOptions);
      configureMap();bindMapEvents();
    } catch {fail('地图暂时无法启动，请重新打开文件。');}
  }
  if(state.renderer==='webgl')mapLoadTimer=setTimeout(()=>{if(!state.ready)activateFallback('initialization-timeout');},8000);
  function visibleSchools() { return activeSchools.filter(s => (!state.province ? isOverseas(regionOf(s))===(state.scope==='overseas') : regionOf(s)===state.province) && (!state.unknownOnly || (schoolStudents.get(s.id)||[]).some(m=>m.nameStatus==='needs_review'))); }
  function overviewPoints(scope=state.scope) { return [...counts.keys()].filter(r=>isOverseas(r)===(scope==='overseas')).map(regionCenter).filter(Boolean); }
  function schoolGeo() { return collection(visibleSchools().map(s => feat({type:'Point',coordinates:[s.lng,s.lat]},{id:s.id,count:schoolStudents.get(s.id).length}))); }
  function padding(mode='overview') {
    if(landscapeCompact())return {top:100,bottom:85,left:40,right:70};
    if (mobile()) return {top:innerHeight<700?195:235,bottom:innerHeight<700?150:190,left:35,right:78};
    return {top:150,bottom:155,left:innerWidth>1500?430:innerWidth<=1000?330:390,right:125};
  }
  function boundsOf(points) {
    const bounds=L.latLngBounds(points.map(([lng,lat])=>[lat,lng]));
    return [[bounds.getWest(),bounds.getSouth()],[bounds.getEast(),bounds.getNorth()]];
  }
  function fit(points, maxZoom=6, animate=true) {
    if (!points.length) return;
    // cameraForBounds includes existing camera padding: clear it before fitting a new viewport.
    map.setPadding({top:0,bottom:0,left:0,right:0});
    const p = padding();
    // MapLibre rejects padding that leaves no viewport on very short screens.
    if (p.top+p.bottom > innerHeight-80) {p.top=Math.round(innerHeight*.28);p.bottom=Math.round(innerHeight*.24);}
    if (points.length===1) { map.easeTo({center:points[0],zoom:maxZoom,padding:p,pitch:map.getPitch(),duration:animate?duration(1000):0}); }
    else map.fitBounds(boundsOf(points),{padding:p,maxZoom,linear:true,pitch:map.getPitch(),bearing:map.getBearing(),duration:animate?duration(1100):0});
  }
  function resetView(animate=true) {
    state.province=null; state.school=null; state.student=null;state.unknownOnly=false; state.query='';state.tab='provinces';state.scope='domestic'; $('search').value='';$('clear-search').hidden=true; showDetail(false);
    if (state.ready) {map.setFilter('province-selected',['==',['get','name'],'']); refreshSources();map.easeTo({bearing:config.defaultBearing,pitch:mapOptions.pitch,duration:0});fit(overviewPoints(),config.overviewMaxZoom,animate);}
    renderList(); updateBreadcrumb(); syncPitchButton(); closeMobileList();
  }
  function updateBreadcrumb() {
    const s = schools.get(state.school);
    const text = s ? `${short(regionOf(s))} · ${s.name}` : state.province ? short(state.province) : state.unknownOnly ? '姓名待核' : state.scope==='overseas'?'海外去向':'';
    $('crumb-current').textContent=text; $('crumb-current').hidden=!text; $('crumb-separator').hidden=!text;
    $('overseas-button').classList.toggle('is-active',state.scope==='overseas');
  }
  function refreshSources() {
    if (!state.ready) return;
    map.getSource('schools').setData(schoolGeo());
    map.setFilter('school-selected',['==',['get','id'],state.school||'']);
    updateRoutes(); scheduleLabels(); updateZoomUI();
  }
  function showDetail(visible) {$('detail').hidden=!visible;document.body.classList.toggle('has-detail',visible);}
  function clearSelection() {
    state.school=null;state.student=null;showDetail(false);
    if(state.ready)map.setFilter('province-selected',['==',['get','name'],state.province||'']);
  }
  function setTab(tab) {state.tab=tab;state.unknownOnly=false;if(tab==='provinces'){state.province=null;state.query='';$('search').value='';$('clear-search').hidden=true;clearSelection();}renderList();refreshSources();updateBreadcrumb();}
  function queryMatches(s) {
    const place=schools.get(s.schoolId);
    return [s.name,s.province,place?.name,place?.city,place?.campus].filter(Boolean).join(' ').toLocaleLowerCase().includes(state.query.toLocaleLowerCase());
  }
  function filteredStudents() {return students.filter(s=>(!state.province||s.province===state.province)&&(!state.unknownOnly||s.nameStatus==='needs_review')&&(!state.query||queryMatches(s)));}
  function renderList() {
    const searching=Boolean(state.query);
    const isStudents=state.tab==='students'||searching||state.unknownOnly;
    for (const type of ['provinces','students']) {$('tab-'+type).classList.toggle('active',type===(isStudents?'students':'provinces'));$('tab-'+type).setAttribute('aria-selected',String(type===(isStudents?'students':'provinces')));}
    $('list').setAttribute('aria-labelledby','tab-'+(isStudents?'students':'provinces'));
    $('clear-filter').hidden=!(state.province||state.unknownOnly||searching);
    if (!isStudents) {
      $('list-caption').textContent='按同学人数排列 · 国内 / 海外';
      $('list').innerHTML=sortedProvinces.map(p=>{
        const names=students.filter(s=>s.province===p).map(nameLabel);
        return `<button class="list-row ${state.province===p?'selected':''}" data-province="${escapeHTML(p)}"><i class="row-dot"></i><span class="row-main"><span class="row-name">${escapeHTML(short(p))}</span><span class="row-sub">${escapeHTML(names.slice(0,3).join('、'))}${names.length>3?'…':''}</span></span><span class="row-count">${counts.get(p)}<span class="row-unit">人</span></span>${icon('chevron')}</button>`;
      }).join('') || '<div class="empty">暂无地区记录。<br>可在同学名册查看待补充资料。</div>';
    } else {
      const rows=filteredStudents();
      $('list-caption').textContent=`${state.unknownOnly?'姓名待核':state.province?short(state.province)+'的同学':searching?'搜索结果':'全部同学'} · ${rows.length} 人`;
      $('list').innerHTML=rows.length ? rows.map(s=>{
        const place=schools.get(s.schoolId);const sub=place ? `${place.name} · ${short(s.province)}` : s.province ? `${short(s.province)} · 学校待补充` : '毕业去向待补充';
        return `<button class="list-row ${state.student===s.id?'selected':''}" data-student="${escapeHTML(s.id)}"><span class="student-avatar">${escapeHTML(s.nameStatus==='needs_review'?'?':readableName(s).slice(-1))}</span><span class="row-main"><span class="row-name">${escapeHTML(readableName(s))}${s.nameStatus==='needs_review'?'<small class="review-badge">待核</small>':''}</span><span class="row-sub">${escapeHTML(sub)}</span></span>${icon('chevron')}</button>`;
      }).join('') : '<div class="empty">还没有找到这个名字。<br>试试姓名、学校或省份。</div>';
    }
  }
  function selectProvince(name) {
    if (!counts.has(name)) {toast(`${short(name)}暂时没有本班同学的去向记录`);return;}
    state.province=name;state.school=null;state.student=null;state.unknownOnly=false;state.tab='students';state.query='';$('search').value='';$('clear-search').hidden=true;showDetail(false);
    state.scope=isOverseas(name)?'overseas':'domestic';
    map.setFilter('province-selected',['==',['get','name'],name]); refreshSources();renderList();updateBreadcrumb();
    const points=visibleSchools().map(s=>[s.lng,s.lat]);
    if(points.length)fit(points,config.provinceDetailZoom);else if(regionCenter(name))fit([regionCenter(name)],config.overviewMaxZoom);else toast('该地区的位置待补充，名单已展开');
    closeMobileList();announce(`${short(name)}有 ${counts.get(name)} 位同学。已展开名单和学校位置。`);
  }
  function schoolDetail(s) {
    const members=schoolStudents.get(s.id)||[];
    const point=isLocated(s),coordinates=point?`${Math.abs(s.lng).toFixed(4)}° ${s.lng<0?'W':'E'} &nbsp; ${Math.abs(s.lat).toFixed(4)}° ${s.lat<0?'S':'N'}`:'学校位置待核，暂不放置地图点';
    const campusNote=isCampusConfirmed(s)?'就读校区已确认；地图点为校区代表位置。':point?'学校参考位置，当年就读校区尚待确认。':'学校位置尚待补充。';
    $('detail-content').innerHTML=`<div class="detail-kicker">${escapeHTML(short(regionOf(s)))} · ${members.length} 位同学</div><h2>${escapeHTML(s.name)}</h2><div class="detail-location">${escapeHTML(s.city||short(regionOf(s)))} · ${escapeHTML(s.campus||'就读校区待核')}${s.address?'<br>'+escapeHTML(s.address):''}</div><div class="detail-members">${members.map(m=>`<button class="name-chip ${state.student===m.id?'active':''}" data-member="${escapeHTML(m.id)}">${escapeHTML(nameLabel(m))}</button>`).join('')}</div><div class="coordinates">${icon('pin')}<span>${coordinates}</span></div><p class="location-warning">${campusNote}</p>${point?`<button class="primary-btn" id="campus-zoom">${isCampusConfirmed(s)?'查看校区位置':'查看学校参考位置'}${icon('arrow')}</button>`:''}`;
    showDetail(true);
    if(point)$('campus-zoom').onclick=()=>{
      focusSchool(s,config.closeUpZoom);
    };
    $('detail-content').querySelectorAll('[data-member]').forEach(b=>b.onclick=()=>{state.student=b.dataset.member;schoolDetail(s);renderList();scheduleLabels();});
  }
  function focusSchool(s,zoom=config.schoolZoom) {
    const detailTop=$('detail').getBoundingClientRect().top;
    const p=landscapeCompact()?{top:110,bottom:85,left:40,right:350}:mobile()?{top:innerHeight<700?210:190,left:35,right:70,bottom:Math.min(innerHeight-detailTop+(innerHeight<700?20:40),innerHeight-200)}:{top:150,left:innerWidth<=1000?330:390,right:440,bottom:140};
    if(innerWidth-p.left-p.right<130){p.right=mobile()?60:120;if(!mobile())p.bottom=300;}
    if(!mobile()&&p.top+p.bottom>innerHeight-100){p.top=Math.round(innerHeight*.23);p.bottom=Math.round(innerHeight*.4);}
    map.easeTo({center:[s.lng,s.lat],zoom,pitch:map.getPitch()>5?45:0,padding:p,duration:duration(1150)});
  }
  function selectSchool(id,studentId=null) {
    const s=schools.get(id);if(!s)return;
    state.school=id;state.student=studentId;state.province=regionOf(s);state.scope=isOverseas(state.province)?'overseas':'domestic';state.unknownOnly=false;state.tab='students';
    map.setFilter('province-selected',['==',['get','name'],state.province]);
    refreshSources();renderList();updateBreadcrumb();schoolDetail(s);if(isLocated(s))focusSchool(s);else if(regionCenter(state.province))fit([regionCenter(state.province)],config.overviewMaxZoom);closeMobileList();
    announce(`${s.name}，${s.campus}，${(schoolStudents.get(id)||[]).length} 位同学。`);
  }
  function selectStudent(id) {
    const s=students.find(s=>s.id===id);if(!s)return;
    if(schools.has(s.schoolId)){selectSchool(s.schoolId,id);return;}
    state.student=id;state.school=null;
    if(s.province) {state.province=s.province;if(regionCenter(s.province))fit([regionCenter(s.province)],config.overviewMaxZoom);}
    else state.province=null;
    map.setFilter('province-selected',['==',['get','name'],s.province||'']);refreshSources();renderList();updateBreadcrumb();
    $('detail-content').innerHTML=`<div class="detail-kicker">${s.province?'学校待补充':'去向待补充'}</div><h2>${escapeHTML(nameLabel(s))}</h2><div class="detail-location">${s.province?escapeHTML(s.province)+' · 已计入地区人数':'尚未分配省份或学校'}</div><p class="detail-note" style="margin-top:18px">未添加未经核实的学校位置点。</p>`;
    showDetail(true);closeMobileList();announce(`${s.name}：${s.province?'学校待补充':'去向待补充'}`);
  }
  function closeDetail() {state.school=null;state.student=null;showDetail(false);refreshSources();renderList();updateBreadcrumb();if(mobile())map.easeTo({padding:padding(),duration:duration(450)});}
  function updateRoutes() {
    if(!state.ready)return;
    if(!hasOriginPoint()){map.getSource('routes').setData(collection([]));map.setLayoutProperty('origin','visibility','none');return;}
    const targets=(state.school?[schools.get(state.school)]:visibleSchools()).filter(isLocated);
    const paths=targets.map(s=>{
      const a=[data.origin.lng,data.origin.lat],b=[s.lng,s.lat],coords=[];
      const curve=Math.min(2.5,Math.hypot(b[0]-a[0],b[1]-a[1])*.14);
      for(let i=0;i<=40;i++){const t=i/40;coords.push([a[0]+(b[0]-a[0])*t-curve*Math.sin(Math.PI*t),a[1]+(b[1]-a[1])*t+curve*.5*Math.sin(Math.PI*t)]);}
      return feat({type:'LineString',coordinates:coords});
    });
    map.getSource('routes').setData(collection(paths));map.setLayoutProperty('routes','visibility',state.routes?'visible':'none');map.setLayoutProperty('origin','visibility',state.scope==='domestic'?'visible':'none');
  }
  let streetPreference=true, streetRequest=null, streetGeneration=0;
  const streetLayerIds=[];
  function stopStreets() {
    streetGeneration++;
    streetRequest?.abort();streetRequest=null;
    state.streets=false;$('streets-toggle').checked=false;
    for(const id of streetLayerIds.splice(0))if(map.getLayer(id))map.removeLayer(id);
    if(map.getSource('streets'))map.removeSource('streets');
    updateZoomUI();
  }
  async function syncStreets() {
    stopStreets();
    if(!state.ready||state.renderer==='2d'||!streetPreference||navigator.onLine===false)return;
    const generation=streetGeneration, controller=new AbortController();
    streetRequest=controller;
    const timer=setTimeout(()=>controller.abort(),5000);
    try {
      // Probe the actual TileJSON endpoint; browser connectivity alone is insufficient.
      const response=await fetch(config.streetsSourceUrl,{signal:controller.signal,credentials:'omit'});
      if(!response.ok)throw new Error('Street source unavailable');
      const source=await response.json();
      if(!Array.isArray(source.tiles)||!source.tiles.length||!source.tiles.every(url=>typeof url==='string'))throw new Error('Invalid street source');
      if(generation!==streetGeneration||!streetPreference||navigator.onLine===false)return;
      // URL resolution must retain MapLibre's {z}/{x}/{y} template tokens.
      const tiles=source.tiles.map(url=>new URL(url,response.url||config.streetsSourceUrl).href.replace(/%7B/gi,'{').replace(/%7D/gi,'}'));
      map.addSource('streets',{...source,type:'vector',tiles,attribution:'<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openmaptiles.org" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>'});
      const layers=[
        {id:'street-green',type:'fill','source-layer':'landcover',minzoom:7,paint:{'fill-color':'#274c48','fill-opacity':.65}},
        {id:'street-landuse',type:'fill','source-layer':'landuse',minzoom:9,paint:{'fill-color':['match',['get','class'],'park','#325951','residential','#263e48','commercial','#32434a','#243d44'],'fill-opacity':.65}},
        {id:'street-water',type:'fill','source-layer':'water',minzoom:7,paint:{'fill-color':'#0c2836'}},
        {id:'street-river',type:'line','source-layer':'waterway',minzoom:9,paint:{'line-color':'#284f62','line-width':2}},
        {id:'street-building',type:compactDevice?'fill':'fill-extrusion','source-layer':'building',minzoom:13,paint:compactDevice?{'fill-color':'#476168','fill-opacity':.8}:{'fill-extrusion-color':'#476168','fill-extrusion-height':['coalesce',['get','render_height'],8],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.8}},
        {id:'street-road',type:'line','source-layer':'transportation',minzoom:7,filter:['==',['geometry-type'],'LineString'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['match',['get','class'],['motorway','trunk'],'#a59571',['primary','secondary'],'#7b887b','#527078'],'line-width':['interpolate',['exponential',1.4],['zoom'],7,.4,12,1.2,15,3,18,12],'line-opacity':.85}},
        {id:'street-road-names',type:'symbol','source-layer':'transportation_name',minzoom:12,layout:{'symbol-placement':'line','symbol-spacing':350,'text-field':['coalesce',['get','name:zh'],['get','name:nonlatin'],['get','name'],''],'text-font':['Noto Sans Regular'],'text-size':11,'text-max-angle':30,'text-pitch-alignment':'viewport'},paint:{'text-color':'#acbcb8','text-halo-color':'#16303a','text-halo-width':1.5}},
        {id:'street-places',type:'symbol','source-layer':'place',minzoom:8,filter:['in',['get','class'],['literal',['city','town','suburb','neighbourhood']]],layout:{'text-field':['coalesce',['get','name:zh'],['get','name:nonlatin'],['get','name'],''],'text-font':['Noto Sans Regular'],'text-size':['interpolate',['linear'],['zoom'],8,11,14,13],'text-padding':20},paint:{'text-color':'#afc1b9','text-halo-color':'#15303a','text-halo-width':1.5}}
      ];
      for(const layer of layers){map.addLayer({...layer,source:'streets'},'province-edge');streetLayerIds.push(layer.id);}
      state.streets=true;$('streets-toggle').checked=true;updateZoomUI();
    } catch {
      if(generation===streetGeneration)stopStreets();
    } finally {
      clearTimeout(timer);
      if(streetRequest===controller)streetRequest=null;
    }
  }
  function toggleStreets() {
    streetPreference=$('streets-toggle').checked;
    syncStreets();
  }
  let renderedMode='', labelElements=new Map(), scheduled=false;
  function scheduleLabels(){if(scheduled||!state.ready)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;renderLabels();});}
  function labelNode(key,className,html,onClick,ariaLabel){
    let el=labelElements.get(key);
    if(!el){el=document.createElement('button');el.type='button';el.className='label '+className;el.innerHTML=html;el.onclick=onClick;el.setAttribute('aria-label',ariaLabel);$('labels').appendChild(el);labelElements.set(key,el);}
    return el;
  }
  function setMode(mode){if(renderedMode!==mode){$('labels').replaceChildren();labelElements.clear();renderedMode=mode;}}
  function renderLabels(){
    if(!state.ready)return;
    const z=map.getZoom(),overview=z<config.regionLabelMaxZoom,w=map.getContainer().clientWidth,h=map.getContainer().clientHeight;
    setMode(overview?'province':'schools');
    const seen=new Set(), placements=[], paths=[];
    const left=mobile()?12:(innerWidth>1500?390:innerWidth<=1000?312:355),right=w-(landscapeCompact()?20:mobile()?64:90),top=landscapeCompact()?105:mobile()?(!$('detail').hidden?165:innerHeight<700?195:231):145,bottom=h-(landscapeCompact()?80:mobile()?(innerHeight<700?130:180):115);
    const overlap=(a,b)=>a.x<b.x+b.w+5&&a.x+a.w+5>b.x&&a.y<b.y+b.h+5&&a.y+a.h+5>b.y;
    const obstacles=[];
    if(!$('detail').hidden){const b=$('detail').getBoundingClientRect();obstacles.push({x:b.x-7,y:b.y-7,w:b.width+14,h:b.height+14});}
    const toolsRect=document.querySelector('.map-tools').getBoundingClientRect();obstacles.push({x:toolsRect.x,y:toolsRect.y,w:toolsRect.width,h:toolsRect.height});
    function place(el,p,key,{center=false,priority=false}={}){
      if(p.x<-80||p.x>w+80||p.y<70||p.y>h+50){el.hidden=true;return;}
      el.hidden=false;
      const ew=el.offsetWidth||90,eh=el.offsetHeight||34;
      let choices=center?[[p.x-ew/2,p.y-eh/2],[p.x+12,p.y-eh-12],[p.x-ew-12,p.y-eh-12],[p.x-ew/2,p.y+14],[p.x-ew/2,p.y-eh-38]]:[[p.x+22,p.y-eh-25],[p.x-ew-22,p.y-eh-25],[p.x+22,p.y+20],[p.x-ew-22,p.y+20],[p.x-ew/2,p.y-eh-70],[p.x-ew/2,p.y+62]];
      if(center){for(const radius of [55,85,120,155,190]){for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0],[-.8,-.7],[.8,-.7],[-.8,.7],[.8,.7]])choices.push([p.x-ew/2+dx*radius,p.y-eh/2+dy*radius]);}}
      if(priority)choices=choices.concat([[Math.max(left,Math.min(p.x+30,right-ew)),Math.max(top,Math.min(p.y-eh-35,bottom-eh))]]);
      let rect;
      for(const [x,y]of choices){const r={x,y,w:ew,h:eh};if(x>=left&&x+ew<=right&&y>=top&&y+eh<=bottom&&!placements.some(o=>overlap(r,o))&&!obstacles.some(o=>overlap(r,o))){rect=r;break;}}
      if(!rect&&priority){rect={x:Math.max(left,Math.min(p.x-ew/2,right-ew)),y:Math.max(top,Math.min(p.y-eh-25,bottom-eh)),w:ew,h:eh};}
      if(!rect){el.hidden=true;return;}
      el.hidden=false;el.style.transform=`translate(${Math.round(rect.x)}px,${Math.round(rect.y)}px)`;placements.push(rect);seen.add(key);
      const ex=Math.max(rect.x+5,Math.min(p.x,rect.x+ew-5)),ey=p.y>rect.y+eh?rect.y+eh:p.y<rect.y?rect.y:Math.min(Math.max(p.y,rect.y+5),rect.y+eh-5);
      if(!center||Math.hypot(ex-p.x,ey-p.y)>10) paths.push(`<path class="${priority?'selected':''}" d="M${p.x.toFixed(1)} ${p.y.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}"/><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.3"/>`);
    }
    if(overview){
      const ordered=sortedProvinces.filter(r=>isOverseas(r)===(state.scope==='overseas')).sort((a,b)=>(b===state.province)-(a===state.province));
      for(const name of ordered){const center=regionCenter(name);if(!center)continue;const p=map.project(center);const key='p:'+name;
        const el=labelNode(key,'province-label',`<span>${escapeHTML(short(name))}</span><strong>${counts.get(name)}</strong><small>人</small>`,()=>selectProvince(name),`${short(name)}，${counts.get(name)} 位同学，点击查看`);
        el.classList.toggle('selected',name===state.province);place(el,p,key,{center:true,priority:name===state.province});
      }
    }else if(state.labels){
      const points=visibleSchools().map(s=>({s,p:map.project([s.lng,s.lat])})).filter(o=>o.p.x>-20&&o.p.x<w+20&&o.p.y>70&&o.p.y<h);
      points.sort((a,b)=>(b.s.id===state.school)-(a.s.id===state.school));
      const groups=[];
      for(const o of points){const g=o.s.id===state.school?null:groups.find(g=>g.items[0].s.id!==state.school&&Math.hypot(g.x-o.p.x,g.y-o.p.y)<48);
        if(g){g.items.push(o);g.x=g.items.reduce((a,o)=>a+o.p.x,0)/g.items.length;g.y=g.items.reduce((a,o)=>a+o.p.y,0)/g.items.length;}else groups.push({x:o.p.x,y:o.p.y,items:[o]});}
      for(const g of groups){
        if(g.items.length>1){const ids=g.items.map(o=>o.s.id).sort();const key='g:'+ids.join(',');const count=g.items.reduce((sum,o)=>sum+schoolStudents.get(o.s.id).length,0);
          const el=labelNode(key,'cluster-label',String(count),()=>fit(g.items.map(o=>[o.s.lng,o.s.lat]),config.closeUpZoom),`${g.items.length} 个校区，共 ${count} 位同学，点击展开`);place(el,{x:g.x,y:g.y},key,{center:true});
        }else{const {s,p}=g.items[0],members=schoolStudents.get(s.id),selected=s.id===state.school,key='s:'+s.id;
          const el=labelNode(key,'school-label',`<strong>${escapeHTML(s.name)}</strong><span class="school-count">${members.length} 人</span><span class="school-names">${escapeHTML(members.map(nameLabel).join('、'))}</span>`,()=>selectSchool(s.id),`${s.name}，${members.map(nameLabel).join('、')}，点击查看学校参考位置`);
          el.classList.toggle('selected',selected);place(el,p,key,{priority:selected});}
      }
    }
    if(state.scope==='domestic'&&hasOriginPoint()){const p=map.project([data.origin.lng,data.origin.lat]);const key='origin';const el=labelNode(key,'origin-label',escapeHTML(originTitle)+(isCampusConfirmed(data.origin)?' · 母校':' · 参考点'),()=>toast(originStatus),originTitle+'，'+originStatus);place(el,p,key);}
    for(const[key,el]of labelElements){if(!seen.has(key))el.hidden=true;}
    $('leader-lines').innerHTML=paths.join('');
  }
  function syncPitchButton(){const tilted=map.getPitch()>5;$('pitch-button').textContent=tilted?'3D':'2D';$('pitch-button').classList.toggle('is-active',tilted);$('pitch-button').setAttribute('aria-pressed',String(tilted));}
  function updateZoomUI(){
    const z=map.getZoom(),selectedSchool=schools.get(state.school);
    const campusHint=selectedSchool ? (isCampusConfirmed(selectedSchool)?'就读校区已确认':'当年就读校区待核') : '点学校查看校区确认状态';
    $('map-level').textContent=z<config.regionLabelMaxZoom?'省份分布 · OVERVIEW':z<config.schoolZoom?'学校分布 · CAMPUSES':'校区位置 · CLOSE UP';
    $('view-title').textContent=z<config.regionLabelMaxZoom?'山海有相逢，来日皆可期。':state.school?schools.get(state.school).campus:'每一个坐标，都有熟悉的名字。';
    $('view-hint').textContent=mobile()?(z<config.regionLabelMaxZoom?'点地区看同学 · 双指缩放或旋转':'点学校看姓名 · 双指缩放或旋转'):(z<config.regionLabelMaxZoom?'滚轮缩放 · 拖动平移 · 右键拖动旋转 · 点地区查看同学':`引线固定于学校位置 · ${campusHint}`);
    if(state.renderer==='2d')$('view-hint').textContent=mobile()?'点地区或学校查看 · 双指缩放':'滚轮缩放 · 拖动平移 · 点地区或学校查看';
    $('layer-note').innerHTML=z<7?`按同学名单自动统计<br>${data.meta.isDemo?'虚构示例数据':reviewCount?'部分姓名待核':`${stats.confirmedNames} 个姓名已校对`}`:`WGS84<br>${campusHint}`;
    $('legend').style.opacity=z>10?'0':'1';document.querySelector('.sea-name').hidden=z>config.regionLabelMaxZoom||state.scope==='overseas';
    $('zoom-in').disabled=z>=config.maxZoom-.1;$('zoom-out').disabled=z<=config.minZoom+.05;
  }
  function closeMobileList(){$('sidebar').classList.remove('list-open');$('list-overlay-shade').classList.remove('show');}
  $('mobile-list-button').onclick=()=>{$('sidebar').classList.add('list-open');$('list-overlay-shade').classList.add('show');};
  $('mobile-close').onclick=closeMobileList;$('list-overlay-shade').onclick=closeMobileList;
  $('list').onclick=e=>{const p=e.target.closest('[data-province]'),s=e.target.closest('[data-student]');if(p)selectProvince(p.dataset.province);if(s)selectStudent(s.dataset.student);};
  $('tab-provinces').onclick=()=>setTab('provinces');$('tab-students').onclick=()=>setTab('students');
  document.querySelector('.panel-tabs').onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=state.tab==='students'?'provinces':'students';setTab(next);$('tab-'+next).focus();}};
  $('search').oninput=()=>{state.query=$('search').value.trim();$('clear-search').hidden=!state.query;if(state.query&&(state.province||state.unknownOnly||state.school)){state.province=null;state.unknownOnly=false;clearSelection();refreshSources();updateBreadcrumb();}renderList();};
  $('clear-search').onclick=()=>{state.query='';$('search').value='';$('clear-search').hidden=true;renderList();$('search').focus();};
  $('clear-filter').onclick=()=>{state.province=null;state.unknownOnly=false;state.query='';$('search').value='';$('clear-search').hidden=true;clearSelection();renderList();refreshSources();updateBreadcrumb();};
  $('pending-button').onclick=()=>{state.tab='students';state.province=null;state.unknownOnly=reviewCount>0;state.query='';$('search').value='';$('clear-search').hidden=true;clearSelection();renderList();refreshSources();updateBreadcrumb();};
  $('overseas-button').onclick=()=>{state.scope=state.scope==='overseas'?'domestic':'overseas';state.province=null;state.unknownOnly=false;state.tab='provinces';state.query='';$('search').value='';$('clear-search').hidden=true;clearSelection();refreshSources();renderList();updateBreadcrumb();map.easeTo({bearing:0,pitch:25,duration:0});fit(overviewPoints(),config.overviewMaxZoom);updateZoomUI();};
  $('detail-close').onclick=closeDetail;
  for(const id of ['home-button','brand-home','crumb-home'])$(id).onclick=()=>resetView();
  $('zoom-in').onclick=()=>map.zoomIn({duration:duration(350)});$('zoom-out').onclick=()=>map.zoomOut({duration:duration(350)});
  $('pitch-button').onclick=()=>map.easeTo({pitch:map.getPitch()>5?0:45,duration:duration(650)});
  $('rotate-button').onclick=()=>map.easeTo({bearing:map.getBearing()+45,duration:duration(550)});
  $('north-button').onclick=()=>map.easeTo({bearing:0,duration:duration(450)});
  $('layers-button').onclick=()=>{const open=$('map-settings').hidden;$('map-settings').hidden=!open;$('layers-button').setAttribute('aria-expanded',String(open));$('layers-button').classList.toggle('is-active',open);};
  $('labels-toggle').onchange=()=>{state.labels=$('labels-toggle').checked;scheduleLabels();};
  $('routes-toggle').onchange=()=>{state.routes=$('routes-toggle').checked;updateRoutes();scheduleLabels();};
  $('streets-toggle').onchange=toggleStreets;
  $('about-open').onclick=()=>$('about').showModal();$('about-close').onclick=()=>$('about').close();$('about-explore').onclick=()=>$('about').close();
  $('about').onclick=e=>{if(e.target===$('about')){const r=$('about').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('about').close();}};
  $('export-data').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${className}-页面数据.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMobileList();$('map-settings').hidden=true;$('layers-button').setAttribute('aria-expanded','false');if(!$('detail').hidden)closeDetail();}});
  function bindMapEvents() {
  const instance=map;
  map.on('load',()=>{
    if(map!==instance)return;
    clearTimeout(mapLoadTimer);state.ready=true;$('fatal').hidden=true;
    map.addSource('schools',{type:'geojson',data:schoolGeo()});map.addSource('routes',{type:'geojson',data:collection([])});map.addSource('origin',{type:'geojson',data:hasOriginPoint()?feat({type:'Point',coordinates:[data.origin.lng,data.origin.lat]}):collection([])});
    map.addLayer({id:'routes',type:'line',source:'routes',layout:{visibility:'none','line-cap':'round','line-join':'round'},paint:{'line-color':'#e6bc83','line-width':['interpolate',['linear'],['zoom'],4,1,10,2],'line-opacity':.55}});
    map.addLayer({id:'origin',type:'circle',source:'origin',layout:{visibility:'none'},paint:{'circle-radius':5,'circle-color':'#e6bc83','circle-stroke-color':'#e6bc8350','circle-stroke-width':5}});
    map.addLayer({id:'school-halo',type:'circle',source:'schools',minzoom:config.schoolPointMinZoom,paint:{'circle-radius':11,'circle-color':'#e6bc83','circle-opacity':.12}});
    map.addLayer({id:'school-points',type:'circle',source:'schools',minzoom:config.schoolPointMinZoom,paint:{'circle-radius':4,'circle-color':'#e6bc83','circle-stroke-color':'#122f37','circle-stroke-width':1.5}});
    map.addLayer({id:'school-selected',type:'circle',source:'schools',filter:['==',['get','id'],''],paint:{'circle-radius':9,'circle-color':'#e6bc83','circle-opacity':.2,'circle-stroke-color':'#e6bc83','circle-stroke-width':1.5}});
    map.on('click','school-points',e=>{e.originalEvent.stopPropagation();selectSchool(e.features[0].properties.id);});
    map.on('click','province-fill',e=>{if(map.getZoom()<config.regionLabelMaxZoom&&e.features.length)selectProvince(e.features[0].properties.name);});
    map.on('mouseenter','school-points',()=>map.getCanvas().style.cursor='pointer');map.on('mouseleave','school-points',()=>map.getCanvas().style.cursor='');
    if(!initialized){resetView(false);initialized=true;}
    else {
      refreshSources();renderList();updateBreadcrumb();
      if(state.school&&isLocated(schools.get(state.school)))focusSchool(schools.get(state.school));
      else fit(state.province?visibleSchools().map(s=>[s.lng,s.lat]):overviewPoints(),state.province?config.provinceDetailZoom:config.overviewMaxZoom,false);
    }
    updateZoomUI();syncStreets();syncPitchButton();$('loading').classList.add('done');setTimeout(()=>$('loading').hidden=true,550);
  });
  map.on('render',scheduleLabels);
  map.on('zoom',updateZoomUI);
  map.on('pitch',syncPitchButton);
  map.on('rotate',()=>{$('compass-needle').style.transform=`rotate(${-map.getBearing()}deg)`;});
  map.on('error',e=>{if(e.sourceId==='streets'||String(e.error?.message).includes('openfreemap.org'))stopStreets();else console.error('Map error',e.error);});
  window.addEventListener('offline',stopStreets);
  window.addEventListener('online',syncStreets);
  map.on('webglcontextlost',()=>{if(map===instance)activateFallback('context-lost');});
  }
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{map.resize();if(state.school&&isLocated(schools.get(state.school)))focusSchool(schools.get(state.school),map.getZoom());else map.easeTo({padding:padding(),duration:0});scheduleLabels();},120);});
  renderList();configureMap();bindMapEvents();
  // Read-only inspection surface for local verification; application data stays in the JSON block above.
  window.classMap={get map(){return map;},data,model,state,counts,schoolStudents,stats,selectProvince,selectSchool,selectStudent,resetView};
})();
