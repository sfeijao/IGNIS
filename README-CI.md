# YSNM_BOT — Quick dev guide

This repository contains the YSNM Discord bot and the website dashboard.

Quick commands

- Install dependencies:

```powershell
npm ci
```

- Run unit tests:

```powershell
npm run test:unit
```

- Run end-to-end test (creates a ticket in local sqlite, closes it and sends webhook to a mock server):

```powershell
npm run test:e2e
```

- Start website server:

```powershell
npm run server
```

Notes

- The test scripts use the local SQLite file `website/ysnm_dashboard.db` and will create backups before migrations.
- CI runs unit tests then e2e tests on pushes and PRs to `main` via `.github/workflows/ci.yml`.

