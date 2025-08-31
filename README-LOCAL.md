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
- Database file: `website/database/ysnm_dashboard.db` — backup before schema changes.

Contact
- Repo: https://github.com/sfeijao/YSNM_BOT
