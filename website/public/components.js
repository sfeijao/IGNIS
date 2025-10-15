// Simple component factory for shared layout elements
// Exposes window.IGNISComponents
(function(){
  function createNavbar(options){
    const { username = 'Utilizador', logoutHref = '/logout' } = options || {};
    const nav = document.createElement('nav');
    nav.className = 'navbar';
    const wrap = document.createElement('div');
    wrap.className = 'navbar-content container';
    const brand = document.createElement('a');
    brand.className = 'navbar-brand';
    brand.href = '#/servers';
    brand.id = 'nav-dashboard';
    brand.setAttribute('aria-label','Ir para o menu principal');
    brand.innerHTML = '🔥 <span class="ignis-logo">IGNIS</span> • Central';

  const user = document.createElement('div');
    user.className = 'navbar-user';
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar';
    avatar.setAttribute('aria-hidden','true');
    avatar.textContent = '👤';
    const name = document.createElement('span');
    name.id = 'userName';
    name.textContent = username;
  const toggle = document.createElement('button');
    toggle.className = 'theme-toggle';
    toggle.type = 'button';
    toggle.id = 'themeToggle';
    toggle.setAttribute('aria-label','Alternar tema');
    toggle.textContent = 'Tema';

    const logout = document.createElement('a');
    logout.href = logoutHref;
    logout.className = 'nav-btn';
    logout.setAttribute('aria-label','Terminar sessão');
    logout.textContent = 'Sair';

    // Burger (mobile)
    const burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.type = 'button';
    burger.setAttribute('aria-label','Abrir menu');
    burger.textContent = '☰';

    const menu = document.createElement('div');
    menu.className = 'nav-menu';
    const mTheme = document.createElement('button'); mTheme.className = 'menu-item'; mTheme.type = 'button'; mTheme.id = 'menuTheme'; mTheme.textContent = 'Alternar tema';
    const mLogout = document.createElement('a'); mLogout.className = 'menu-item'; mLogout.href = logoutHref; mLogout.textContent = 'Sair';
    menu.append(mTheme, mLogout);

  // Backdrop for mobile menu (append after menu so it's an adjacent sibling)
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';

    // Toggle function with ARIA and focus trap
    function toggleMenu(force){
      const open = force !== undefined ? !!force : !menu.classList.contains('open');
      if (open){
        menu.classList.add('open');
        document.body.classList.add('menu-open');
        burger.setAttribute('aria-expanded','true');
        // attach overlay as adjacent sibling
        if (!overlay.isConnected) menu.parentElement && menu.parentElement.insertBefore(overlay, menu.nextSibling);
        // focus first item
        setTimeout(()=>{
          const focusable = menu.querySelectorAll('.menu-item');
          if (focusable[0]) focusable[0].focus();
        },0);
      } else {
        menu.classList.remove('open');
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded','false');
        overlay.remove();
        burger.focus();
      }
    }

  burger.addEventListener('click', () => toggleMenu());
    overlay.addEventListener('click', () => toggleMenu(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('open')){
        e.preventDefault();
        toggleMenu(false);
      } else if (e.key === 'Tab' && menu.classList.contains('open')){
        // Focus trap within menu
        const focusable = Array.from(menu.querySelectorAll('.menu-item'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length-1];
        if (e.shiftKey && document.activeElement === first){
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last){
          e.preventDefault(); first.focus();
        }
      }
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && e.target !== burger && menu.classList.contains('open')) toggleMenu(false);
    });

    // Expose simple global nav controls
    window.IGNISNav = {
      open: () => toggleMenu(true),
      close: () => toggleMenu(false),
      isOpen: () => menu.classList.contains('open')
    };

    user.append(avatar, name, toggle, logout, burger, menu);
    wrap.append(brand, user);
    nav.appendChild(wrap);
    return nav;
  }

  function createFooter(){
    const footer = document.createElement('footer');
    footer.className = 'footer';
    const span = document.createElement('span');
    span.textContent = 'Sistema v2.1 • Powered by IGNIS';
    footer.appendChild(span);
    return footer;
  }

  window.IGNISComponents = { createNavbar, createFooter };
})();

// Toasts
(function(){
  // Toast queue with limit, priority, de-duplication, and per-type caps
  const rootSel = '#toast-root';
  const MAX = 3;
  const PER_TYPE_MAX = 2;
  const DEDUPE_WINDOW_MS = 5000; // collapse duplicates within 5s
  let queue = [];
  let active = [];
  // Track duplicates by signature
  const counters = new Map(); // key -> {count, lastAt}

  function ensureRoot(){
    let root = document.querySelector(rootSel);
    if (!root){
      root = document.createElement('div');
      root.id = 'toast-root';
      root.className = 'toast-container';
      document.body.appendChild(root);
    }
    return root;
  }

  function typeCount(list, type){
    return list.filter(t => t.type === type).length;
  }

  function render(){
    const root = ensureRoot();
    // Clean missing
    active = active.filter(t => document.body.contains(t.el));
    while (active.length < MAX && queue.length){
      // priority: error > success > info (default)
      queue.sort((a,b)=> prio(b.type) - prio(a.type));
      // enforce per-type max among active
      const idx = queue.findIndex(item => typeCount(active, item.type) < PER_TYPE_MAX);
      const t = idx >= 0 ? queue.splice(idx,1)[0] : queue.shift();
      root.appendChild(t.el);
      active.push(t);
      t.timer = setTimeout(()=> close(t), t.timeout);
    }
  }

  function prio(type){
    if (type === 'error') return 3;
    if (type === 'success') return 2;
    return 1; // info/default
  }

  function close(t){
    if (t.timer) clearTimeout(t.timer);
    t.el.remove();
    active = active.filter(x => x !== t);
    render();
  }

  function show({ title = 'Sucesso', message = '', type = 'success', timeout = 3500 } = {}){
    const key = `${type}|${title}|${message}`;
    const now = Date.now();
    const existing = active.find(t => t.key === key) || queue.find(t => t.key === key);
    if (existing){
      // within dedupe window? increment count badge
      if (!existing.countBadge){
        existing.count = 1;
        existing.countBadge = document.createElement('div');
        existing.countBadge.className = 'count-badge';
        existing.el.appendChild(existing.countBadge);
      }
      existing.count = (existing.count || 1) + 1;
      existing.countBadge.textContent = `x${existing.count}`;
      existing.lastAt = now;
      // reset timer to keep visible
      if (existing.timer){ clearTimeout(existing.timer); existing.timer = setTimeout(()=> close(existing), timeout); }
      return;
    }
    // new toast
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const content = document.createElement('div');
    const h = document.createElement('div'); h.className = 'title'; h.textContent = title;
    const p = document.createElement('div'); p.className = 'body'; p.textContent = message;
    content.append(h,p);
    el.append(content);
    const t = { el, type, timeout, timer: null, key, lastAt: now };
    el.addEventListener('click', () => close(t));
    queue.push(t);
    render();
  }
  window.IGNISToast = { show };
})();

// Theme handling
(function(){
  const KEY = 'ignis:theme';
  function apply(theme){
    document.documentElement.setAttribute('data-theme', theme);
  }
  function init(){
    let theme = localStorage.getItem(KEY);
    if (!theme){
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      theme = prefersLight ? 'light' : 'dark';
    }
    apply(theme);
    const btn = document.getElementById('themeToggle');
    if (btn){
      btn.textContent = theme === 'light' ? '🌙' : '☀️';
      // Sync burger menu theme item
      const menuTheme = document.getElementById('menuTheme');
      if (menuTheme) menuTheme.textContent = 'Alternar tema';
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'light' ? 'dark' : 'light';
        apply(next);
        localStorage.setItem(KEY, next);
        btn.textContent = next === 'light' ? '🌙' : '☀️';
      });
      if (menuTheme){
        menuTheme.addEventListener('click', () => btn.click());
      }
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();

// Pills skeleton helpers
(function(){
  function setPillsSkeleton(enable){
    const pills = document.querySelector('.pills');
    if (!pills) return;
    const selectors = [
      '[data-guild-name]',
      '[data-staff-online]',
      '[data-system-status]',
      '[data-active-tickets]',
      '[data-total-members]'
    ];
    const widths = {
      '[data-guild-name]': '120px',
      '[data-staff-online]': '40px',
      '[data-system-status]': '70px',
      '[data-active-tickets]': '48px',
      '[data-total-members]': '60px'
    };
    const found = selectors.map(sel => pills.querySelector(sel)).filter(Boolean);
    if (enable){
      found.forEach(el => {
        el.classList.add('skeleton-text');
        let key = null;
        if (el.hasAttribute('data-guild-name')) key = '[data-guild-name]';
        else if (el.hasAttribute('data-staff-online')) key = '[data-staff-online]';
        else if (el.hasAttribute('data-system-status')) key = '[data-system-status]';
        else if (el.hasAttribute('data-active-tickets')) key = '[data-active-tickets]';
        else if (el.hasAttribute('data-total-members')) key = '[data-total-members]';
        el.style.setProperty('--skw', widths[key] || '80px');
      });
    } else {
      found.forEach(el => { el.classList.remove('skeleton-text'); el.style.removeProperty('--skw'); });
    }
  }
  window.IGNISPills = { setSkeleton: setPillsSkeleton };
})();