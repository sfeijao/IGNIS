This folder contains smoke tests for the website.

Quick commands (PowerShell):

# Start the website server (background job)
Start-Job -ScriptBlock { $env:PORT='4000'; npm run server }

# Fetch-based smoke test (fast)
npm run smoke:fetch

# Headless Puppeteer smoke test (requires puppeteer installed)
npm run smoke:headless

Notes:
- The fetch test checks for visible template placeholders (`${...}` / `%24%7B`) and unsafe DOM APIs in raw HTML.
- The headless test loads pages in headless Chrome and inspects rendered text for placeholders. If your server requires login, set `$env:ALLOW_LOCAL_AUTH_BYPASS='true'` or authenticate accordingly.
- If running on CI, set `BASE_URL` env var to point to the deployed site (example: `http://127.0.0.1:4000` or your staging URL).
