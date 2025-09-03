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

      // Check for visible template tokens
      const containsTemplate = body.includes('${') || body.toLowerCase().includes('%24%7b');
      console.log('Visible template placeholders present in raw HTML:', containsTemplate);

      if (containsTemplate) {
        console.error('FAIL: Found visible template placeholders in raw HTML for', url);
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
