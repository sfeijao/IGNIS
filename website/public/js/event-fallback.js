// Small event fallback to make inline handlers that reference `event` safe.
(function(){
  if (window._eventFallbackInstalled) return; window._eventFallbackInstalled = true;
  // store last captured event and mirror to window.event for legacy inline handlers
  window.__lastEvent = null;
  function capture(e){
    try {
      window.__lastEvent = e;
      // mirror to window.event so inline onclick="event.stopPropagation()" works
      try { window.event = e; } catch(_){}
    } catch(_){}
  }
  // capture common interactive events in the capture phase
  ['click','submit','change','input','keydown','keyup','pointerdown'].forEach(evt => {
    document.addEventListener(evt, capture, true);
  });

  // helpers (optional) for code to call instead of referencing global event directly
  window.safeStopPropagation = function(){
    var e = window.__lastEvent || window.event;
    if (e && typeof e.stopPropagation === 'function') try { e.stopPropagation(); } catch(_){}
  };
  window.safePreventDefault = function(){
    var e = window.__lastEvent || window.event;
    if (e && typeof e.preventDefault === 'function') try { e.preventDefault(); } catch(_){}
  };
})();
