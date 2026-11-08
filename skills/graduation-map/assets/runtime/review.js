(() => {
  'use strict';
  let dialog, sourceImage, imagePromise, activeId, filter = 'all', showingWhole = false, zoom = 4;
  const ui = {};
  const getData = () => window.CLASS_MAP_DATA || {meta:{},students:[],schools:[]};
  const pending = s => s.nameStatus === 'needs_review' || String(s.name || '').includes('□');
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  function button(text, action, className = '') {
    const el = make('button', 'sr-button ' + className, text);
    el.type = 'button';
    el.addEventListener('click', action);
    return el;
  }
  function install() {
    if (dialog) return;
    const style = make('style');
    style.textContent = `
      #source-review{box-sizing:border-box;width:min(1030px,calc(100vw - 32px));max-width:none;height:min(790px,90dvh);max-height:90dvh;padding:0;overflow:hidden;color:var(--ink,#f0eee3);background:var(--panel,#102630);border:1px solid #54706e;border-radius:14px;font-family:var(--sans,system-ui,sans-serif);box-shadow:0 20px 100px #0009}
      #source-review[open]{display:flex;flex-direction:column}
      #source-review::backdrop{background:#04141ecc;backdrop-filter:blur(6px)}
      #source-review *{box-sizing:border-box}
      #source-review .sr-head{padding:20px 24px 15px;display:flex;gap:16px;align-items:flex-start;border-bottom:1px solid var(--line,#45626a);flex-shrink:0}
      #source-review .sr-heading{flex:1;min-width:0}
      #source-review h2{font:25px var(--serif,serif);font-weight:400;margin:0 0 7px;letter-spacing:1px}
      #source-review .sr-subtitle{font-size:11px;line-height:1.7;color:var(--muted,#90a6aa);margin:0;overflow-wrap:anywhere}
      #source-review .sr-close{width:36px;min-height:36px;font-size:24px;padding:0;flex-shrink:0}
      #source-review .sr-body{display:grid;grid-template-columns:255px minmax(0,1fr);flex:1;min-height:0}
      #source-review .sr-sidebar{border-right:1px solid var(--line,#45626a);padding:16px 10px 10px;display:flex;flex-direction:column;min-height:0;gap:10px}
      #source-review .sr-filter{display:flex;gap:7px;padding:0 5px;flex-shrink:0}
      #source-review .sr-button{font:12px var(--sans,system-ui,sans-serif);color:var(--ink,#f0eee3);background:transparent;border:1px solid var(--line,#45626a);border-radius:6px;padding:8px 11px;cursor:pointer;line-height:1.5}
      #source-review .sr-button.sr-close{width:36px;min-height:36px;font-size:24px;padding:0;flex-shrink:0}
      #source-review .sr-button:hover{background:#8ec9bd15}
      #source-review .sr-button:focus-visible,#source-review .sr-entry:focus-visible,#source-review .sr-image-frame:focus-visible{outline:2px solid var(--gold,#e6bc83);outline-offset:2px}
      #source-review .sr-button[aria-pressed=true]{border-color:var(--gold,#e6bc83);color:var(--gold,#e6bc83)}
      #source-review .sr-button:disabled{opacity:.4;cursor:default}
      #source-review .sr-counter{font-size:10px;color:var(--muted,#90a6aa);padding:0 7px}
      #source-review .sr-list{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#496269 transparent}
      #source-review .sr-entry{display:block;text-align:left;width:100%;padding:11px 9px;border:0;border-radius:5px;background:none;color:var(--ink,#f0eee3);cursor:pointer;font:12px var(--sans,system-ui,sans-serif)}
      #source-review .sr-entry:hover{background:#8ec9bd0e}
      #source-review .sr-entry[aria-pressed=true]{background:#8ec9bd17;box-shadow:inset 2px 0 var(--gold,#e6bc83)}
      #source-review .sr-entry-top{display:flex;gap:8px;justify-content:space-between;align-items:center}
      #source-review .sr-state{font-size:9px;color:var(--gold,#e6bc83);white-space:nowrap}
      #source-review .sr-entry-school{font-size:10px;line-height:1.7;color:var(--muted,#90a6aa);display:block;margin-top:4px;overflow-wrap:anywhere}
      #source-review .sr-content{padding:19px 24px;min-width:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#496269 transparent}
      #source-review .sr-line{font-size:11px;color:var(--gold,#e6bc83);margin-bottom:8px}
      #source-review h3{font:25px var(--serif,serif);margin:0 0 10px;font-weight:400}
      #source-review .sr-school{font-size:13px;line-height:1.8;margin-bottom:14px;overflow-wrap:anywhere}
      #source-review .sr-school span{color:var(--muted,#90a6aa);font-size:11px;margin-right:10px}
      #source-review .sr-evidence{font-size:11px;line-height:1.85;color:var(--muted,#90a6aa);margin:10px 0 15px;overflow-wrap:anywhere}
      #source-review .sr-candidates{font-size:12px;line-height:1.9;border-left:2px solid var(--gold,#e6bc83);padding:8px 12px;background:#e6bc8309;color:var(--gold,#e6bc83);margin:12px 0}
      #source-review .sr-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:15px 0 9px}
      #source-review .sr-zoom-readout{font-size:11px;color:var(--muted,#90a6aa);margin:0 4px;min-width:28px;text-align:center}
      #source-review .sr-image-frame{overflow:auto;max-height:290px;min-height:110px;background:#e9e9e9;border-radius:6px;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#647779 #e9e9e9}
      #source-review .sr-image-frame.whole{max-height:410px}
      #source-review canvas{display:block;max-width:none;image-rendering:pixelated;margin:auto}
      #source-review .sr-image-description{font-size:10px;line-height:1.7;color:var(--muted,#90a6aa);margin:8px 0 0}
      #source-review .sr-image-error{font-size:12px;line-height:1.8;color:#17333d;padding:20px}
      #source-review .sr-empty{font-size:12px;line-height:1.8;padding:20px 12px;color:var(--muted,#90a6aa)}
      #source-review .sr-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid var(--line,#45626a);padding:12px 24px;flex-shrink:0}
      #source-review .sr-foot-note{font-size:10px;line-height:1.7;color:var(--muted,#90a6aa);margin:0}
      #source-review .sr-foot .sr-button{white-space:nowrap}
      @media(max-width:650px){#source-review{box-sizing:border-box;width:calc(100vw - 18px);height:94dvh;max-height:94dvh;border-radius:10px}#source-review .sr-head{padding:15px 14px 11px;gap:8px}#source-review h2{font-size:21px}#source-review .sr-subtitle{font-size:10px}#source-review .sr-body{display:flex;flex-direction:column}#source-review .sr-sidebar{height:168px;min-height:130px;flex-shrink:0;border-right:0;border-bottom:1px solid var(--line,#45626a);padding:9px 10px;gap:5px}#source-review .sr-filter{padding:0}#source-review .sr-counter{display:none}#source-review .sr-list{display:grid;grid-template-columns:1fr 1fr;align-content:start;gap:2px 6px}#source-review .sr-entry{padding:8px 7px}#source-review .sr-entry-top{gap:4px}#source-review .sr-entry-school{font-size:9px}#source-review .sr-state{font-size:8px}#source-review .sr-content{padding:14px;flex:1;min-height:0}#source-review h3{font-size:23px}#source-review .sr-toolbar{gap:5px;margin-top:10px}#source-review .sr-button{padding:7px 9px}#source-review .sr-image-frame{max-height:220px}#source-review .sr-image-frame.whole{max-height:280px}#source-review .sr-foot{padding:10px 14px;gap:8px}#source-review .sr-foot-note{font-size:9px}#source-review .sr-foot .sr-button{font-size:10px;padding:8px}#source-review .sr-evidence{font-size:11px}}
      @media(max-width:650px) and (max-height:650px){#source-review .sr-sidebar{height:126px;min-height:126px}#source-review .sr-head{padding-top:11px;padding-bottom:9px}#source-review .sr-subtitle{display:none}#source-review .sr-image-frame{max-height:170px}#source-review .sr-image-frame.whole{max-height:210px}}
    `;
    document.head.appendChild(style);
    dialog = make('dialog');
    dialog.id = 'source-review';
    dialog.setAttribute('aria-labelledby','source-review-title');
    const head = make('header','sr-head');
    const heading = make('div','sr-heading');
    const title = make('h2','', '对照毕业去向原图');title.id='source-review-title';
    ui.subtitle=make('p','sr-subtitle');
    heading.append(title,ui.subtitle);
    const close=button('×',()=>dialog.close(),'sr-close');close.setAttribute('aria-label','关闭原图对照');
    head.append(heading,close);
    const body=make('div','sr-body');
    const side=make('aside','sr-sidebar');side.setAttribute('aria-label','选择要核对的同学');
    const filters=make('div','sr-filter');filters.setAttribute('role','group');filters.setAttribute('aria-label','筛选识别条目');
    ui.all=button('全部',()=>setFilter('all'));
    ui.pending=button('姓名待核',()=>setFilter('pending'));
    filters.append(ui.all,ui.pending);
    ui.counter=make('div','sr-counter');
    ui.list=make('div','sr-list');
    side.append(filters,ui.counter,ui.list);
    ui.content=make('section','sr-content');ui.content.setAttribute('aria-label','当前条目的原图与识读结果');
    body.append(side,ui.content);
    const foot=make('footer','sr-foot');
    foot.append(make('p','sr-foot-note','原图与当前名单可逐条对照。图片在本机显示，不会上传。'),button('导出页面数据',exportData));
    dialog.append(head,body,foot);
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dialog.close();}});
    dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();});
    document.body.appendChild(dialog);
  }
  function schoolName(student) {
    const school=getData().schools.find(s=>s.id===student.schoolId);
    return student.schoolOriginal || student.schoolNameOriginal || school?.sourceName || school?.originalName || school?.name || student.schoolName || '学校名称待辨认';
  }
  function filtered(){return getData().students.filter(s=>filter==='all'||pending(s));}
  function setFilter(value) {
    filter=value;
    const rows=filtered();
    if(!rows.some(s=>s.id===activeId))activeId=rows[0]?.id;
    showingWhole=false;zoom=4;
    renderList();renderEntry();
  }
  function select(id) {activeId=id;showingWhole=false;zoom=4;renderList();renderEntry();}
  function renderList() {
    const all=getData().students,rows=filtered(),count=all.filter(pending).length;
    ui.all.textContent=`全部 ${all.length}`;ui.pending.textContent=`姓名待核 ${count}`;
    ui.all.setAttribute('aria-pressed',String(filter==='all'));ui.pending.setAttribute('aria-pressed',String(filter==='pending'));
    ui.counter.textContent=`共 ${rows.length} 条 · 按原图顺序`;
    ui.list.replaceChildren();
    if(!rows.length){ui.list.append(make('div','sr-empty','没有需要核对的姓名。'));return;}
    for(const student of rows){
      const entry=button('',()=>select(student.id));entry.className='sr-entry';entry.dataset.studentId=student.id;entry.setAttribute('aria-pressed',String(student.id===activeId));
      const top=make('span','sr-entry-top');top.append(make('span','',student.name||'姓名待辨认'),make('span','sr-state',pending(student)?'待核':student.nameStatus==='user_confirmed'?'已校对':'可辨'));
      entry.append(top,make('span','sr-entry-school',`${student.sourceLabel||student.province||'原图条目'} · ${schoolName(student)}`));ui.list.append(entry);
    }
  }
  function loadImage() {
    if(imagePromise)return imagePromise;
    imagePromise=new Promise((resolve,reject)=>{
      const source=window.SOURCE_ARCHIVE?.imageDataUrl;
      if(!source || !/^data:image\//i.test(source)){reject(new Error('没有找到内嵌原图。名单仍可查看。'));return;}
      sourceImage=new Image();sourceImage.onload=()=>resolve(sourceImage);sourceImage.onerror=()=>reject(new Error('内嵌图片未能读取。请重新打开 HTML 文件。'));sourceImage.src=source;
    });
    return imagePromise;
  }
  function validRect(student,image) {
    const raw=student?.sourceRect;
    if(!Array.isArray(raw)||raw.length!==4||!raw.every(Number.isFinite)||raw[2]<=0||raw[3]<=0)return null;
    const x=Math.max(0,Math.min(image.naturalWidth-1,raw[0])),y=Math.max(0,Math.min(image.naturalHeight-1,raw[1]));
    return [x,y,Math.max(1,Math.min(raw[2],image.naturalWidth-x)),Math.max(1,Math.min(raw[3],image.naturalHeight-y))];
  }
  function renderEntry() {
    ui.content.replaceChildren();
    const student=getData().students.find(s=>s.id===activeId);
    if(!student){ui.content.append(make('div','sr-empty','请选择左侧或上方的一个条目。'));return;}
    const currentId=activeId;
    ui.content.append(make('div','sr-line',student.sourceLabel||'原图条目'),make('h3','',student.name||'姓名待辨认'));
    const school=make('div','sr-school');school.append(make('span','','学校原文'),document.createTextNode(schoolName(student)));ui.content.append(school);
    if(pending(student)){
      const candidates=Array.isArray(student.nameCandidates)?student.nameCandidates.filter(Boolean):[];
      ui.content.append(make('div','sr-candidates',candidates.length?`待核候选：${candidates.join(' / ')}。这些是识读候选，尚未确认。`:'姓名存在不清楚的字，使用 □ 占位，留待本人或熟悉名单的同学校对。'));
    }
    const evidence=student.nameCorrectionNote ? student.nameCorrectionNote+(student.reviewNote?' 原有备注：'+student.reviewNote:'') : student.reviewNote;
    ui.content.append(make('p','sr-evidence',evidence||(pending(student)?'原图分辨率有限，不能从模糊笔画确定全部姓名。':'此条按当前资料录入；可对照来源检查。')));
    const toolbar=make('div','sr-toolbar');
    const toggle=button(showingWhole?'返回当前条目':'查看整张原图',()=>{showingWhole=!showingWhole;zoom=showingWhole?1:4;renderEntry();});
    toggle.setAttribute('aria-pressed',String(showingWhole));
    const smaller=button('−',()=>{zoom=Math.max(showingWhole ? .5 : 1,zoom-(showingWhole ? .5 : 1));draw();});smaller.setAttribute('aria-label','缩小原图');
    const larger=button('+',()=>{zoom=Math.min(showingWhole?4:10,zoom+(showingWhole ? .5 : 1));draw();});larger.setAttribute('aria-label','放大原图');
    const readout=make('span','sr-zoom-readout');
    toolbar.append(toggle,smaller,readout,larger);
    const frame=make('div','sr-image-frame'+(showingWhole?' whole':''));frame.setAttribute('role','region');frame.setAttribute('aria-label',showingWhole?'完整原图，可滚动查看':'当前条目原图放大，可滚动查看');frame.tabIndex=0;
    const loading=make('div','sr-image-error','正在读取内嵌原图…');frame.append(loading);
    const description=make('p','sr-image-description','仅从原始图片裁切与放大，不补画文字。放大后可在图像区域横向或纵向滚动。');
    ui.content.append(toolbar,frame,description);
    let loadedImage;
    async function draw() {
      try{
        loadedImage=loadedImage||await loadImage();
        if(currentId!==activeId||!frame.isConnected)return;
        const rect=validRect(student,loadedImage);
        const whole=showingWhole||!rect;
        const [x,y,w,h]=whole?[0,0,loadedImage.naturalWidth,loadedImage.naturalHeight]:rect;
        const displayScale=whole?Math.max(1,frame.clientWidth)/w*zoom:zoom;
        const canvas=make('canvas');
        // Integer nearest-neighbour enlargement preserves source pixels; no reconstruction is applied.
        const pixelScale=Math.max(1,Math.ceil(displayScale));
        canvas.width=Math.ceil(w*pixelScale);canvas.height=Math.ceil(h*pixelScale);
        canvas.style.width=`${Math.round(w*displayScale)}px`;canvas.style.height=`${Math.round(h*displayScale)}px`;
        canvas.setAttribute('role','img');canvas.setAttribute('aria-label',whole?'用户提供的完整毕业去向图片':`${student.sourceLabel||student.name}的原图局部，需人工对照识读`);
        const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(loadedImage,x,y,w,h,0,0,canvas.width,canvas.height);
        if(whole&&rect){ctx.strokeStyle='#d87527';ctx.lineWidth=Math.max(2,pixelScale*1.5);ctx.strokeRect(rect[0]*pixelScale,rect[1]*pixelScale,rect[2]*pixelScale,rect[3]*pixelScale);}
        frame.replaceChildren(canvas);
        readout.textContent=whole?`${Math.round(zoom*100)}%`:`${zoom}×`;
        smaller.disabled=zoom<=(showingWhole ? .5 : 1);larger.disabled=zoom>=(showingWhole?4:10);
        if(!rect)description.textContent='此条未配置局部裁切范围，当前显示完整原图。原图仅在本机读取。';
        else if(whole)description.textContent='橙色框标出当前条目的位置。整图可放大并滚动查看，未修改原图文字。';
      }catch(error){frame.replaceChildren(make('div','sr-image-error',error.message));}
    }
    draw();
  }
  function exportData(){
    const url=URL.createObjectURL(new Blob([JSON.stringify(getData(),null,2)],{type:'application/json;charset=utf-8'}));
    const link=make('a');link.href=url;link.download=`${getData().meta?.className||'毕业去向'}-页面数据.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.openSourceReview = studentId => {
    install();
    const data=getData();
    ui.subtitle.textContent=(data.meta?.sourceTitle||'原图对照') + (data.students.some(s=>s.nameStatus==='user_confirmed') ? ` · ${data.students.filter(s=>s.nameStatus==='user_confirmed').length} 个姓名已由用户校对` : '');
    if(studentId&&data.students.some(s=>s.id===studentId)){filter='all';activeId=studentId;}
    else {filter='all';activeId=data.students.find(pending)?.id||data.students[0]?.id;}
    showingWhole=false;zoom=4;
    renderList();
    if(!dialog.open)dialog.showModal();
    renderEntry();
    const selected=ui.list.querySelector(`[data-student-id="${CSS.escape(String(activeId))}"]`);selected?.scrollIntoView({block:'nearest'});
  };
})();
