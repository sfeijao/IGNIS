let browser = null;

async function getBrowser() {
  if (browser) return browser;
  try {
    const puppeteer = require('puppeteer');
    browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    return browser;
  } catch {
    return null;
  }
}

async function renderCaptchaImage(code) {
  const b = await getBrowser();
  if (!b) return null;
  const page = await b.newPage();
  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8"><style>
  body{margin:0;background:#0b1023;display:flex;align-items:center;justify-content:center;width:400px;height:160px;font-family:Inter,Arial,sans-serif}
  .box{background:#11193a;border:2px solid #1f2a60;border-radius:12px;width:360px;height:120px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}
  .code{font-size:48px;color:#e4e8ff;letter-spacing:6px;text-shadow:0 0 8px rgba(96,165,250,0.5)}
  .noise{position:absolute;inset:0}
  .noise:before,.noise:after{content:'';position:absolute;width:120%;height:2px;background:linear-gradient(90deg,transparent,#7c3aed,transparent);opacity:0.6;transform:rotate(-10deg)}
  .noise:after{transform:rotate(15deg)}
  </style></head><body>
  <div class="box"><div class="noise"></div><div class="code">${code}</div></div>
  </body></html>`;
  await page.setViewport({ width: 400, height: 160, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const buf = await page.screenshot({ type: 'png' });
  await page.close().catch(()=>{});
  return buf;
}

module.exports = { renderCaptchaImage };
