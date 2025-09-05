const puppeteer = require('puppeteer');

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:4000';
  const pages = [
    '/dashboard',
    '/dashboard.html',
    '/dashboard-fixed.html',
    '/dashboard-original-backup.html',
    '/index.html',
    '/',
    '/admin.html',
    '/admin-guilds.html',
    '/admin-channels.html',
    '/admin-roles.html',
    '/admin-webhooks.html',
    '/analytics.html',
    '/auth-status.html',
    '/tickets.html',
    '/login.html',
    '/login_clean.html',
    '/debug.html',
    '/test-api.html',
    '/simple-test.html'
  ];

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  try {
    // Set cookie / bypass via env if server uses ALLOW_LOCAL_AUTH_BYPASS; otherwise server will redirect to /login
    for (const p of pages) {
      const url = base + p;
      console.log('Visiting', url);
      const resp = await page.goto(url, { waitUntil: 'networkidle2' });
      const status = resp && resp.status ? resp.status() : null;
      console.log('Status', status);

      // Wait briefly for frontend-helpers mutation observer to run
      if (typeof page.waitForTimeout === 'function') {
        await page.waitForTimeout(400);
      } else {
        // Puppeteer older versions may not have waitForTimeout; fallback to Node timer
        await new Promise(resolve => setTimeout(resolve, 400));
      }

      // Check for DOMPurify
      const hasDomPurify = await page.evaluate(() => !!(window.DOMPurify || window.DOMPurify !== undefined));
      console.log('DOMPurify available:', hasDomPurify);

      // Check visible text for template placeholder patterns
      const textContainsTemplate = await page.evaluate(() => {
        const walk = (node) => {
          if (!node) return '';
          if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (['SCRIPT','STYLE','NOSCRIPT'].includes(node.tagName)) return '';
            let acc = '';
            node.childNodes.forEach(c => { acc += walk(c); });
            return acc;
          }
          return '';
        };
        try {
          const text = walk(document.body);
          return text.includes('${') || text.toLowerCase().includes('%24%7b');
        } catch (e) {
          return false;
        }
      });

      console.log('Visible template placeholders present:', textContainsTemplate);

      if (textContainsTemplate) {
        console.error('FAIL: Found visible template placeholders on', url);
        await browser.close();
        process.exit(2);
      }
    }

    console.log('\nSmoke test passed — no visible template placeholders found on visited pages.');
    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('E2E smoke encountered an error:', err && err.message ? err.message : err);
    await browser.close();
    process.exit(3);
  }
})();
