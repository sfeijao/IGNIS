const fetch = require('node-fetch');

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000';
  const pages = ['/dashboard', '/tickets.html', '/debug.html'];

  let failed = false;

  for (const p of pages) {
    const url = base + p;
    try {
      console.log('Fetching', url);
      const res = await fetch(url, { redirect: 'follow' });
      console.log('Status', res.status);
      if (res.status >= 400) {
        console.error('FAIL: bad status for', url);
        failed = true;
        continue;
      }
      const body = await res.text();

      // Check for DOMPurify script include
      const hasDomPurify = /dompurify/i.test(body) || /dompurify\.min\.js/i.test(body) || /js\/(dompurify|dompurify.min)\.js/i.test(body);
      console.log('DOMPurify present in HTML:', hasDomPurify);

      // Check for visible template tokens (raw or URL-encoded) and unsafe DOM writes
      const containsTemplate = body.includes('${') || body.toLowerCase().includes('%24%7b') || /\$\{[^}]*\}/.test(body);
      const containsEncoded = /%24%7b/i.test(body);
      const unsafeInner = /innerHTML\s*=|document\.write\(|eval\(|new Function\(/i.test(body);
      const unsafeScriptUsage = unsafeInner;
      console.log('Visible template placeholders present in raw HTML:', containsTemplate);
      console.log('URL-encoded placeholders present in raw HTML:', containsEncoded);
      console.log('Unsafe DOM/script usage found in HTML (innerHTML/document.write/eval):', unsafeScriptUsage);

      if (containsTemplate || containsEncoded) {
        console.error('FAIL: Found visible or encoded template placeholders in raw HTML for', url);
        failed = true;
      }

      if (unsafeScriptUsage) {
        console.error('FAIL: Found potentially unsafe DOM or script usage in HTML for', url);
        failed = true;
      }
    } catch (err) {
      console.error('Error fetching', url, err && err.message ? err.message : err);
      failed = true;
    }
  }

  if (failed) {
    console.error('\nFetch-based smoke test failed.');
    process.exit(2);
  }

  console.log('\nFetch-based smoke test passed — no visible placeholders found in raw HTML.');
  process.exit(0);
})();
