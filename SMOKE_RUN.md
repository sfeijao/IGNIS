Smoke tests (local runner)

Quick guide to run the website smoke tests locally (Windows PowerShell):

1. Install dependencies:

```powershell
npm ci
```

2. Run the convenience local smoke runner (starts server, runs fetch+headless tests, stops server):

```powershell
npm run smoke:local
```

3. If you prefer manual steps:

- Start server in one terminal: `npm run server` (wait for "YSNM Dashboard rodando")
- In another terminal run: `npm run smoke:fetch`
- Then: `npm run smoke:headless`

Notes:
- `smoke:local` uses `scripts/run-smoke-local.ps1` and requires PowerShell.
- On non-Windows systems run the `e2e` scripts directly or adapt the runner.
