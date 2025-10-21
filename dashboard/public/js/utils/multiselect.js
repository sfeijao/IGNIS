(function(){
  const NS = window.IGNISMultiselect || (window.IGNISMultiselect = {});
  const map = new WeakMap();
  let stylesInjected = false;

  function injectStyles(){
    if (stylesInjected) return; stylesInjected = true;
    const css = `
    .ms-container{position:relative}
    .ms-control{display:flex;flex-wrap:wrap;gap:6px;align-items:center;border:1px solid var(--glass-border);border-radius:10px;background:var(--glass-bg);padding:6px 10px;min-height:40px;cursor:pointer}
    .ms-control:focus-within{outline:2px solid rgba(124,58,237,.45)}
    .ms-chip{display:inline-flex;align-items:center;gap:6px;background:rgba(124,58,237,0.18);color:#C4B5FD;border:1px solid rgba(124,58,237,0.35);border-radius:999px;padding:2px 8px;font-size:12px}
    .ms-chip .x{opacity:.7;cursor:pointer}
    .ms-search{flex:1 1 auto;min-width:120px;background:transparent;color:var(--text-primary);border:none;outline:none}
    .ms-arrow{margin-left:auto;color:var(--text-secondary);}
  .ms-dropdown{position:absolute;left:0;right:0;top:calc(100% + 6px);background:var(--bg-secondary);border:1px solid var(--glass-border);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);z-index:1500}
    .ms-dropdown.hidden{display:none}
  .ms-actions{display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--glass-border);background:rgba(255,255,255,0.02)}
  .ms-actions .btn{padding:6px 8px;border-radius:8px;border:1px solid var(--glass-border);background:rgba(255,255,255,0.08);color:var(--text-primary);font-size:12px}
    .ms-count{margin-left:auto;color:var(--text-secondary);font-size:12px}
  .ms-list{max-height:240px;overflow:auto;padding:6px;background:var(--bg-secondary)}
  .ms-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer}
  .ms-item:hover{background:rgba(255,255,255,0.08)}
    .ms-item input{pointer-events:none}
    `;
    const style = document.createElement('style');
    style.textContent = css; document.head.appendChild(style);
  }

  function build(select, opts){
    injectStyles();
    const state = { select, open:false, opts: opts||{}, items: [], container:null, control:null, dropdown:null, chips:null, list:null, search:null, count:null };
    const container = document.createElement('div'); container.className='ms-container';
    const control = document.createElement('div'); control.className='ms-control'; control.tabIndex = 0;
    const chips = document.createElement('div'); chips.className='ms-chips';
    const search = document.createElement('input'); search.className='ms-search'; search.placeholder = opts?.searchPlaceholder || 'Pesquisar…';
    const arrow = document.createElement('div'); arrow.className='ms-arrow'; arrow.innerHTML = '<i class="fas fa-chevron-down"></i>';
    control.appendChild(chips); control.appendChild(search); control.appendChild(arrow);

    const dropdown = document.createElement('div'); dropdown.className='ms-dropdown hidden';
    const actions = document.createElement('div'); actions.className='ms-actions';
    const btnAll = document.createElement('button'); btnAll.className='btn'; btnAll.textContent='Selecionar todos';
    const btnNone = document.createElement('button'); btnNone.className='btn'; btnNone.textContent='Limpar';
    const count = document.createElement('span'); count.className='ms-count';
    actions.appendChild(btnAll); actions.appendChild(btnNone); actions.appendChild(count);
    const list = document.createElement('div'); list.className='ms-list';
    dropdown.appendChild(actions); dropdown.appendChild(list);

    container.appendChild(control); container.appendChild(dropdown);
    select.style.display='none'; select.parentNode.insertBefore(container, select.nextSibling);

    state.container = container; state.control = control; state.dropdown = dropdown; state.chips = chips; state.list = list; state.search = search; state.count = count;

    // Build items from options
    const optsArr = Array.from(select.options).map(o=>({ value:o.value, label:o.textContent, selected:o.selected }));
    state.items = optsArr;
    renderList(state);
    renderChips(state);

    // Events
    const toggle = ()=>{ state.open = !state.open; dropdown.classList.toggle('hidden', !state.open); if(state.open) search.focus(); };
    control.addEventListener('click', (e)=>{ if(e.target===search) return; toggle(); });
    search.addEventListener('input', ()=>{ renderList(state); });
    btnAll.addEventListener('click', (e)=>{ e.preventDefault(); setAll(state, true); });
    btnNone.addEventListener('click', (e)=>{ e.preventDefault(); setAll(state, false); });
    document.addEventListener('click', (e)=>{ if(!container.contains(e.target)) { state.open=false; dropdown.classList.add('hidden'); }});

    map.set(select, state);
    updateCount(state);
  }

  function setAll(state, val){
    state.items.forEach(it=> it.selected = val);
    syncToSelect(state);
    renderList(state); renderChips(state); updateCount(state);
  }

  function toggleItem(state, value){
    const it = state.items.find(x=>`${x.value}`===`${value}`); if(!it) return;
    it.selected = !it.selected; syncToSelect(state); renderChips(state); updateCount(state);
  }

  function renderList(state){
    const q = (state.search.value||'').toLowerCase();
    const filtered = state.items.filter(it => it.label.toLowerCase().includes(q));
    state.list.innerHTML = filtered.map(it=>`
      <label class="ms-item"><input type="checkbox" ${it.selected?'checked':''} value="${escapeHtml(it.value)}"/> ${escapeHtml(it.label)}</label>
    `).join('');
    state.list.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
      chk.addEventListener('change', ()=>{ toggleItem(state, chk.value); });
    });
  }

  function renderChips(state){
    const sel = state.items.filter(it=>it.selected);
    state.chips.innerHTML = sel.slice(0,5).map(it=>{
      const el = document.createElement('span'); el.className='ms-chip'; el.innerHTML = `${escapeHtml(it.label)} <span class="x">×</span>`; el.querySelector('.x').addEventListener('click', (e)=>{ e.stopPropagation(); toggleItem(state, it.value); renderList(state); }); return el.outerHTML;
    }).join('');
    if(sel.length>5){ const more=document.createElement('span'); more.className='text-secondary'; more.style.fontSize='12px'; more.textContent = `+${sel.length-5}`; state.chips.insertAdjacentElement('beforeend', more); }
  }

  function syncToSelect(state){
    const { select, items } = state;
    for (const o of select.options){ const it = items.find(x=>`${x.value}`===`${o.value}`); o.selected = !!(it && it.selected); }
    select.dispatchEvent(new Event('change'));
  }

  function syncFromSelect(state){
    const cur = new Set(Array.from(state.select.options).filter(o=>o.selected).map(o=>`${o.value}`));
    state.items.forEach(it=>{ it.selected = cur.has(`${it.value}`); });
    renderList(state); renderChips(state); updateCount(state);
  }

  function updateCount(state){
    const n = state.items.filter(it=>it.selected).length;
    state.count.textContent = `${n} selecionado${n===1?'':'s'}`;
  }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c)); }

  NS.enhance = function(select, opts){
    if (!select || select.tagName !== 'SELECT' || !select.multiple) return null;
    if (map.has(select)) { const st = map.get(select); syncFromSelect(st); return st; }
    return build(select, opts);
  };
  NS.refresh = function(select){ const st = map.get(select); if(st) syncFromSelect(st); };
})();
