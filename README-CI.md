# IGNIS_BOT — Quick dev guide

This repository contains the IGNIS Discord bot and the website dashboard.

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

- The test scripts use the local SQLite file `website/ignis_dashboard.db` and will create backups before migrations.
- CI runs unit tests then e2e tests on pushes and PRs to `main` via `.github/workflows/ci.yml`.

## CI/CD

This project is configured to run on Railway using Nixpacks.

### Deterministic installs (npm ci)

- Railway builds use `npm ci` (see `railway.json`) for reproducible installs.
- Keep `package-lock.json` committed and in sync with `package.json`.
- If `npm ci` fails in Railway complaining that lockfile is out of sync, clear the build cache in the Railway service settings and redeploy.

### Node/npm versions

- The project pins the package manager via `packageManager` in `package.json`.
- A local Node version suggestion is stored in `.nvmrc`.
- You can run: `nvm use` (if you have nvm) or install the matching Node version manually.

