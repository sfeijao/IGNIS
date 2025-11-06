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

Ticket panels restore on restart

- The bot used to auto-recreate ticket/verification panels on startup. This is now DISABLED by default to prevent duplicate panels.
- To enable it temporarily for all guilds, set the environment variable before starting:

```powershell
$env:AUTO_RESTORE_PANELS = 'true'; node index.js
```

- To enable it per guild only, set in the guild config the key `autoRestorePanels: true` (this can be toggled later in the dashboard UI; for now it’s only via storage/DB).
- Related legacy keys that also enable it if present: `autoResendTicketPanel`, `restorePanelsOnReady`, `autoRecreatePanels`.

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

## Production checklist (quick)

Run the automated environment check:

```powershell
npm run env:check
```

Confirm these before deploying:

- BASE_URL points to your public dashboard URL (e.g., <https://ignis.example.com>)
- OAUTH_CALLBACK (or CALLBACK_URL) matches the Discord application settings exactly
- DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET are set and valid
- DISCORD_TOKEN is the production bot token; bot is in the target guild(s)
- SESSION_SECRET is long and random
- INTERNAL_API_TOKEN set (and unique) if using internal modlog webhook
- MONGO_URI set (recommended for production) and reachable; MONGO_DB_NAME provided if your URI has no path
- CORS_ORIGIN set to your website origin if you need cross-origin access
- DASHBOARD_BYPASS_AUTH disabled (unset or false) in production
- Logs and backups policy defined (see scripts/ and data/)
