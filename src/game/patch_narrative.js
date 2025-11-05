
// === Consolidated Narrative Cinematics Patch ===
(function(){
  const PATH_JSON = (typeof NARRATIVE_PATH_JSON === 'string') ? NARRATIVE_PATH_JSON : 'narrative_auto.json';
  let DB = { sectors:{}, bosses:{}, intel:{} };

  function fetchJSON(url){
    return new Promise((resolve,reject)=>{
      try{
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.onreadystatechange = ()=>{
          if(xhr.readyState===4){
            if(xhr.status===200 || xhr.status===0){
              try{ resolve(JSON.parse(xhr.responseText)); }catch(e){ reject(e); }
            } else reject(new Error('HTTP '+xhr.status));
          }
        };
        xhr.send();
      }catch(e){ reject(e); }
    });
  }

  function el(tag, attrs={}, children=[]){
    const e = document.createElement(tag);
    Object.assign(e, attrs);
    if (attrs.style) Object.assign(e.style, attrs.style), delete e.style;
    (Array.isArray(children)?children:[children]).filter(Boolean).forEach(c=>{
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }

  function fullscreenCinematic(bgUrl){
    const root = el('div', { className:'cinematic-root', style:{
      position:'fixed', inset:'0', zIndex:13000, background:'#000', display:'flex', alignItems:'center', justifyContent:'center'
    }});
    const bg = el('div', { className:'cinematic-bg', style:{
      position:'absolute', inset:'0',
      backgroundImage: bgUrl ? `url('${bgUrl}')` : 'none',
      backgroundSize:'cover', backgroundPosition:'center',
      filter:'grayscale(0.2) contrast(1.05) brightness(0.55)',
      opacity:'1'
    }});
    const scrim = el('div', { className:'cinematic-scrim', style:{
      position:'absolute', inset:'0', background:'linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.85))'
    }});
    const card = el('div', { className:'cinematic-card', style:{
      position:'relative', maxWidth:'900px', width:'min(90vw, 900px)',
      border:'1px solid #2a2a2a', background:'rgba(10,10,10,0.8)',
      padding:'24px 28px', boxShadow:'0 12px 60px rgba(0,0,0,0.6)',
      color:'#e6e6e6'
    }});
    const title = el('div', { className:'cinematic-title', style:{
      fontSize:'20px', letterSpacing:'2px', color:'#90c7ff', marginBottom:'12px', textTransform:'uppercase'
    }});
    const body = el('div', { className:'cinematic-body', style:{
      fontSize:'16px', lineHeight:'1.6', minHeight:'90px', whiteSpace:'pre-wrap'
    }});
    const footer = el('div', { className:'cinematic-footer', style:{ display:'flex', alignItems:'center', gap:'16px', marginTop:'14px' }});
    const itemImg = el('img', { className:'cinematic-item', style:{
      display:'none', maxHeight:'96px', objectFit:'contain', border:'1px solid #333', background:'#111', padding:'6px'
    }});
    const btn = el('button', { className:'cinematic-btn', textContent:'CONTINUE', style:{
      marginLeft:'auto', padding:'8px 12px', border:'1px solid #555', background:'#111', color:'#fff', fontWeight:'bold', cursor:'pointer'
    }});
    btn.onclick = ()=> root.remove();

    footer.append(itemImg, btn);
    card.append(title, body, footer);
    root.append(bg, scrim, card);
    document.body.appendChild(root);
    return {root, title, body, btn, itemImg};
  }

  function typewriter(node, lines, cps=28){
    return new Promise(resolve=>{
      const text = Array.isArray(lines)? lines.join('\\n'): String(lines||'');
      let i=0;
      const t = setInterval(()=>{
        node.textContent = text.slice(0, ++i);
        if (i>=text.length){ clearInterval(t); resolve(); }
      }, Math.max(8, 1000/Math.max(10, cps)));
      node.addEventListener('click', ()=>{ node.textContent = text; clearInterval(t); resolve(); }, { once:true });
    });
  }

  function preload(url){
    return new Promise(res=>{
      if (!url){ res(); return; }
      const img = new Image();
      img.onload = img.onerror = ()=> res();
      img.src = url;
    });
  }

  async function showBossIntro(bossName, opts={}){
    const data = (DB.bosses && DB.bosses[bossName]) || {};
    const bg = opts.bg || data.bg_image || null;
    const lines = opts.lines || data.intro || `Target: ${bossName}`;
    await preload(bg);
    const ui = fullscreenCinematic(bg);
    ui.title.textContent = `CONTACT: ${String(bossName||'UNKNOWN').toUpperCase()}`;
    await typewriter(ui.body, lines, 28);
    return ui;
  }

  async function showIntelIntro(intelName, opts={}){
    const data = (DB.intel && DB.intel[intelName]) || {};
    const bg = opts.bg || data.bg_image || null;
    const item = opts.item || data.item_image || null;
    const lines = opts.lines || data.mini_lore || 'Recovered intel.';
    await Promise.all([preload(bg), preload(item)]);
    const ui = fullscreenCinematic(bg);
    ui.title.textContent = `INTEL RECOVERED: ${String(intelName||'UNKNOWN').toUpperCase()}`;
    if (item){ ui.itemImg.src = item; ui.itemImg.style.display = 'block'; }
    await typewriter(ui.body, lines, 28);
    return ui;
  }

  function dripText(lines, opts={}){
    const box = document.createElement('div');
    box.className='narrative-drip';
    Object.assign(box.style, {
      position:'fixed', left:'24px', top:'24px', color:'#e5e5e5',
      background:'rgba(0,0,0,0.5)', padding:'8px 12px', border:'1px solid #444',
      fontSize:'14px', zIndex:11000
    });
    document.body.appendChild(box);
    let i=0;
    const t = setInterval(()=>{
      if(i>=lines.length){ clearInterval(t); setTimeout(()=>box.remove(), 1400); return; }
      const line = document.createElement('div'); line.textContent = String(lines[i++]||''); box.appendChild(line);
    }, opts.interval || 900);
  }

  function hookGlobals(){
    window.NARRATIVE = DB;
    window.NARRATIVE_patch = Object.assign(window.NARRATIVE_patch||{}, {
      showBossIntro, showIntelIntro, dripText
    });
  }

  fetchJSON(PATH_JSON).then(j=>{ DB = j || DB; hookGlobals(); }).catch(()=>hookGlobals());
})();
