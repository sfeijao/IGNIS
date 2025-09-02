// Centralized frontend helpers: sanitization, image fallbacks, and debug gating
(function(){
    function sanitizeTemplatePlaceholders(root=document){
        try{
            // Remove visible template placeholders in text nodes
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            while(walker.nextNode()) textNodes.push(walker.currentNode);
            textNodes.forEach(node => {
                if(!node.nodeValue) return;
                const v = node.nodeValue;
                if(v.includes('${') || v.toLowerCase().includes('%24%7b')){
                    node.nodeValue = v.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,'');
                }
            });

            // Sanitize common attributes
            const attrs = ['src','href','alt','title','value','placeholder','data-user','data-id'];
            const els = root.querySelectorAll('*');
            els.forEach(el => {
                attrs.forEach(a => {
                    if(el.hasAttribute && el.hasAttribute(a)){
                        let val = el.getAttribute(a) || '';
                        if(val.includes('${') || val.toLowerCase().includes('%24%7b')){
                            el.setAttribute(a, val.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,''));
                        }
                    }
                });
            });
        }catch(e){ /* best-effort */ }
    }

    function attachImageFallbacks(root=document){
        try{
            const imgs = root.querySelectorAll('img');
            imgs.forEach(img => {
                const src = img.getAttribute('src') || '';
                if(!src || src.includes('${') || src.toLowerCase().includes('%24%7b')){
                    img.src = '/default-avatar.png';
                }
                // Attach robust onerror fallback
                img.onerror = function(){
                    try{
                        if(!this.dataset._fallbacked){
                            this.dataset._fallbacked = '1';
                            this.src = '/default-avatar.png';
                        }
                    }catch(e){}
                };
            });
        }catch(e){ /* best-effort */ }
    }

    function safeText(v){
        if(v === null || v === undefined) return '';
        return String(v).replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,'');
    }

    function sanitizeAttr(v){
        if(v === null || v === undefined) return '';
        return String(v).replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,'');
    }

    function stripHtml(input){
        if(input === null || input === undefined) return '';
        let s = String(input);
        // Remove HTML tags
        s = s.replace(/<[^>]*>/g, '');
        // Remove template placeholders
        s = s.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,'');
        return s;
    }

    function isDebug(){
        try{ return localStorage.getItem('ysnm-debug') === '1'; }catch(e){ return false; }
    }

    function toggleDebug(){
        try{
            const cur = isDebug();
            if(cur) localStorage.removeItem('ysnm-debug'); else localStorage.setItem('ysnm-debug','1');
            gateConsole();
        }catch(e){}
    }

    function gateConsole(){
        try{
            if(!window._ysnmConsoleBackup) window._ysnmConsoleBackup = { log: console.log, warn: console.warn, error: console.error, info: console.info };
            if(!isDebug()){
                console.log = function(){}; console.warn = function(){}; console.error = function(){}; console.info = function(){};
            }else{
                if(window._ysnmConsoleBackup){
                    console.log = window._ysnmConsoleBackup.log;
                    console.warn = window._ysnmConsoleBackup.warn;
                    console.error = window._ysnmConsoleBackup.error;
                    console.info = window._ysnmConsoleBackup.info;
                }
            }
        }catch(e){}
    }

    // Expose helpers
    window.FrontendHelpers = {
        sanitizeTemplatePlaceholders,
        attachImageFallbacks,
        safeText,
        sanitizeAttr,
    stripHtml,
        isDebug,
        toggleDebug,
        gateConsole
    };

    // Run on load to remove stray template markers and ensure images don't 404
    document.addEventListener('DOMContentLoaded', function(){
        try{
            FrontendHelpers.gateConsole();
            FrontendHelpers.sanitizeTemplatePlaceholders(document);
            FrontendHelpers.attachImageFallbacks(document);
            // Observe DOM changes and sanitize newly added nodes (covers innerHTML insertions)
            try{
                const obs = new MutationObserver((mutations) => {
                    mutations.forEach(m => {
                        if(m.addedNodes && m.addedNodes.length){
                            m.addedNodes.forEach(node => {
                                try{
                                    if(node.nodeType === Node.TEXT_NODE){
                                        if(node.nodeValue && (node.nodeValue.includes('${') || node.nodeValue.toLowerCase().includes('%24%7b'))){
                                            node.nodeValue = node.nodeValue.replace(/\$\{[^}]*\}/g, '').replace(/%24%7B/gi,'');
                                        }
                                    }else if(node.nodeType === Node.ELEMENT_NODE){
                                        FrontendHelpers.sanitizeTemplatePlaceholders(node);
                                        FrontendHelpers.attachImageFallbacks(node);
                                    }
                                }catch(e){}
                            });
                        }
                    });
                });
                obs.observe(document.body || document, { childList: true, subtree: true });
            }catch(e){}
        }catch(e){}
    });

})();
