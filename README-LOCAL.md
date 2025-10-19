# IGNIS Bot — Local Start Instructions

This file documents minimal steps to start the bot + dashboard locally for development.

Prerequisites
- Node.js >= 16.9 (tested with Node v22)
- npm

Environment
- Copy `.env.example` to `.env` (if present) and set the following at minimum:
  - DISCORD_TOKEN — bot token
  - DISCORD_CLIENT_ID
  - DISCORD_CLIENT_SECRET
  - WEBSITE_SESSION_SECRET — a long random string
  - (optional) ALLOW_DEV_TOKENS=true to enable the dev-token bypass in non-dev environments
    - (optional) ALLOW_LOCAL_AUTH_BYPASS=true to enable a local session/auth bypass for quick development (preferred over ALLOW_DEV_TOKENS)

Install and start
1. Install deps:

```powershell
npm install
```

2. Start the website server only (recommended with local bypass for quick testing):

```powershell
# Enable local session bypass for development
$env:ALLOW_LOCAL_AUTH_BYPASS = 'true';
node website/server.js
```

3. Or start the full bot (registers slash commands):

```powershell
node index.js
```

Local dev notes
- The recommended way to bypass OAuth for local development is to set `ALLOW_LOCAL_AUTH_BYPASS=true` before starting the server.
- Avoid enabling `ALLOW_DEV_TOKENS` or exposing dev tokens in shared environments.
- To access admin UI quickly use: `http://localhost:4000/admin-guild-config.html`

Security
- Do not enable dev tokens in production. Set `ALLOW_DEV_TOKENS` to `false` or omit it.

Troubleshooting
- If port 4000 is in use, stop the existing node process or change `PORT` env.
- Database file: `website/database/ignis_dashboard.db` — backup before schema changes.

SQLite backend (tickets/configs/panels)

- To use the new SQLite backend locally:

```powershell
$env:STORAGE_BACKEND = 'sqlite'; $env:DATA_DIR = "$PWD/data"; npm run start:local
```

- Health check:

```powershell
irm http://localhost:3000/api/health | ConvertTo-Json -Depth 5
```

- You should see `storage.backend` = `sqlite`.

MongoDB (persistência)

- Opção B (URI sem DB no path + nome via variável):

```powershell
$env:MONGO_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority&appName=IGNIS'
$env:MONGO_DB_NAME = 'IGNIS'
```

- Remover forçamento de SQLite (se existir):

```powershell
Remove-Item Env:STORAGE_BACKEND -ErrorAction SilentlyContinue
```

- Arrancar e validar: Health deve mostrar mongo: connected

```powershell
node index.js
irm http://localhost:4000/api/health?dev=1 | ConvertTo-Json -Depth 5
```

- Persistência: altera algo no dashboard, reinicia `node index.js` e confirma que manteve.

Backups & migration (local)

- Create a backup (JSON + raw .db copy):

```powershell
npm run backup
```

- Migrate SQLite → Mongo (requires `MONGO_URI`):

```powershell
$env:MONGO_URI = 'mongodb+srv://user:pass@host/db'; npm run migrate:sqlite-to-mongo
```

- Migrate Mongo → SQLite:

```powershell
$env:MONGO_URI = 'mongodb+srv://user:pass@host/db'; npm run migrate:mongo-to-sqlite
```

Contact

- Repo: <https://github.com/sfeijao/IGNIS_BOT>
