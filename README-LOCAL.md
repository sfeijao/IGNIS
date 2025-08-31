# YSNM Bot — Local Start Instructions

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

Install and start
1. Install deps:

```powershell
npm install
```

2. Start the website server only:

```powershell
node website/server.js
```

3. Or start the full bot (registers slash commands):

```powershell
node index.js
```

Local dev notes
- The dev-token bypass is active when NODE_ENV != 'production' or when `ALLOW_DEV_TOKENS=true` is set.
- To access admin UI quickly use: `http://localhost:4000/admin-guild-config.html`

Security
- Do not enable dev tokens in production. Set `ALLOW_DEV_TOKENS` to `false` or omit it.

Troubleshooting
- If port 4000 is in use, stop the existing node process or change `PORT` env.
- Database file: `website/database/ysnm_dashboard.db` — backup before schema changes.

Contact
- Repo: https://github.com/sfeijao/YSNM_BOT
