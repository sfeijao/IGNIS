// Lightweight toast fallback helper used across pages.
(function () {
  if (typeof window.showToast === 'function') return;

  function _getToastElement() {
    let t = document.getElementById('toast');
    if (!t) {
      // create minimal toast container if not present
      t = document.createElement('div');
      t.id = 'toast';
      t.style.position = 'fixed';
      t.style.right = '16px';
      t.style.bottom = '16px';
      t.style.display = 'none';
      t.style.background = '#222';
      t.style.color = '#fff';
      t.style.padding = '12px 16px';
      t.style.borderRadius = '8px';
      t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
      document.body.appendChild(t);
    }
    return t;
  }

  window.showToast = function (message, ms = 5000) {
    try {
      const t = _getToastElement();
      if (!t) return;
      t.textContent = message;
      t.style.display = 'block';
      t.style.opacity = '1';
      if (ms > 0) setTimeout(() => { t.style.display = 'none'; }, ms);
    } catch (e) {
      // last-resort fallback
      try { console.debug('showToast fallback error', e); } catch (_) {}
    }
  };
})();
