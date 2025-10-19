# IGNIS Bot — Local Start Instructions

This file documents minimal steps to start the bot + dashboard locally for development.

Prerequisites
- Node.js >= 16.9 (tested with Node v22)
- npm

Environment

- Copy `.env.example` to `.env` (if present) and set at minimum:
  - DISCORD_TOKEN — bot token
  - DISCORD_CLIENT_ID (or CLIENT_ID)
  - DISCORD_CLIENT_SECRET (or CLIENT_SECRET)
  - SESSION_SECRET — a long random string
  - For Mongo persistence: set MONGO_URI; if the URI has no `/db` path, also set MONGO_DB_NAME (e.g., `IGNIS`)

Install and start

1. Install deps:

```powershell
npm install
```

1. Start the website server only (optional; serves the new UI):

```powershell
node website/server.js
```

1. Start the full bot + dashboard (registers slash commands):

```powershell
node index.js
```

Local dev notes

- To bypass OAuth locally for quick previews, either set `DASHBOARD_BYPASS_AUTH=true` before starting, or append `?dev=1` to URLs (e.g. `http://localhost:4000/dashboard?dev=1`).

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
irm http://localhost:4000/api/health?dev=1 | ConvertTo-Json -Depth 5
```

- For SQLite you should see `storage.backend` = `sqlite`. For Mongo, `mongo` should be `connected`.

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
