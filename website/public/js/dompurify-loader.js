(function(){
  // Provide a minimal DOMPurify-like shim if a real DOMPurify isn't available.
  if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') return;

  function basicSanitize(html){
    if (!html || typeof html !== 'string') return '';
    // Remove unresolved template placeholders
    html = html.replace(/\$\{[^}]*\}/g, '');
    html = html.replace(/%24%7B/gi, '');
    // Strip <script> tags
    html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    // Remove event handler attributes (on...)
    html = html.replace(/\s+on[a-zA-Z]+\s*=\s*"[^"]*"/g, '');
    html = html.replace(/\s+on[a-zA-Z]+\s*=\s*'[^']*'/g, '');
    // Remove javascript: URLs in href/src
    html = html.replace(/href\s*=\s*"javascript:[^\"]*"/gi, '');
    html = html.replace(/src\s*=\s*"javascript:[^\"]*"/gi, '');
    return html;
  }

  window.DOMPurify = {
    sanitize: function(html, cfg){
      // The real DOMPurify offers many options; this shim only performs conservative cleaning.
      return basicSanitize(html);
    }
  };
})();
