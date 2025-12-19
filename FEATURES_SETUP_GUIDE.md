# IGNIS Features Setup Guide

This guide explains how to enable and configure optional features in IGNIS bot.

---

## 📊 Server Stats (Dynamic Voice Channels)

Server Stats creates dynamic voice channels that automatically update with server statistics like member count, online users, boosters, etc.

### Current Status
- ⚠️ **DISABLED** - No servers have enabled Server Stats yet
- Message in logs: `[ServerStatsProcessor] No enabled configurations found`

### How to Enable

#### Option 1: Via Dashboard (Recommended)
1. Access the Next.js dashboard: `http://localhost:5175/next/guild/{YOUR_GUILD_ID}/stats`
2. Select the metrics you want to track:
   - 👥 Total Members
   - 👤 Human Members
   - 🤖 Bot Members
   - 🟢 Online Members
   - 💎 Boosters
   - 📺 Total Channels
   - 🎭 Total Roles
   - 🎫 Active Tickets
3. Choose or create a category for the stat channels
4. Set update interval (5-60 minutes)
5. Click "Setup Stats Channels"

#### Option 2: Via API
```bash
POST /api/guild/{guildId}/stats/setup
Content-Type: application/json

{
  "metrics": ["total_members", "human_members", "online_members"],
  "categoryId": "1234567890123456789",  // Optional
  "updateInterval": 10  // Minutes (5-60)
}
```

#### Option 3: Via MongoDB
```javascript
const { ServerStatsConfigModel } = require('./utils/db/models');

await ServerStatsConfigModel.create({
  guild_id: 'YOUR_GUILD_ID',
  enabled: true,
  update_interval_minutes: 10,
  metrics: {
    total_members: true,
    human_members: true,
    online_members: true,
    boosters: false,
    bot_members: false,
    total_channels: false,
    total_roles: false,
    active_tickets: false
  }
});
```

### Features
- ✨ Auto-creates voice channels with dynamic names
- 🔄 Updates every 5-60 minutes (configurable)
- 🎨 Customizable emoji and format per metric
- 📁 Organizes channels in a dedicated category
- 🔒 Channels are locked (users can't join)
- 📊 Real-time statistics from Discord

### Example Output
```
📊 SERVER STATS
├─ 👥 Members: 1,234
├─ 👤 Humans: 1,150
├─ 🟢 Online: 234
└─ 💎 Boosters: 42
```

---

## 🧩 Panel Auto-Restoration

Panel Auto-Restoration automatically recreates ticket/verification panels if they're deleted.

### Current Status
- ⚠️ **DISABLED by default** to prevent spam on startup
- Message in logs: `Restauração automática de painéis no arranque: DESATIVADA por padrão`

### How to Enable

#### Option 1: Global (All Servers)
Set environment variable:
```bash
AUTO_RESTORE_PANELS=true
```

This will restore panels for ALL servers on bot startup.

#### Option 2: Per-Server (Recommended)
Enable in guild configuration:

**Via Storage (SQLite):**
```javascript
const storage = require('./utils/storage');
await storage.updateGuildConfig(guildId, {
  autoRestorePanels: true
});
```

**Via Dashboard API:**
```bash
PATCH /api/guild/{guildId}/config
Content-Type: application/json

{
  "autoRestorePanels": true
}
```

### How It Works
1. On bot startup, scans all guilds for saved panels
2. Checks if panel messages still exist
3. If deleted, recreates the panel in the same channel
4. Updates database with new message ID

### Safety Features
- ✅ Only restores if explicitly enabled
- ✅ Skips servers without permission
- ✅ Skips if channel was deleted
- ✅ Non-destructive (doesn't delete existing panels)
- ✅ Logs all restoration attempts

### Panel Types Supported
- 🎫 Ticket Panels (`type: 'tickets'`)
- ✅ Verification Panels (`type: 'verification'`)

---

## 📋 Current Configuration Summary

Based on your startup logs:

### ✅ Working Features
- MongoDB: **Connected** (storage + main connection)
- Next.js Dashboard: **Running** on `http://127.0.0.1:5175`
- Bot: **Online** (IGNIS#2419)
- Servers: **4 guilds**, **109 users**
- Background Jobs: **All initialized**
- Webhooks: **Configured and loaded**
- Giveaway Claim Job: **Running** (300s interval)

### ⚠️ Optional Features (Disabled)
- **Server Stats**: No enabled configurations
  - To enable: Configure via dashboard `/guild/{guildId}/stats`
- **Panel Auto-Restore**: Disabled by default
  - To enable: Set `AUTO_RESTORE_PANELS=true` or per-guild config

### 🔍 Non-Critical Warnings
- "Mongo não está pronto para hidratação" - Normal during startup, resolves in <100ms
- "No enabled configurations found" - Server Stats not configured yet
- "Falha a restaurar painéis" - Expected when auto-restore is disabled

---

## 🚀 Quick Start Checklist

### To Enable Server Stats:
1. [ ] Access dashboard: `http://localhost:5175/next/guild/{GUILD_ID}/stats`
2. [ ] Select desired metrics
3. [ ] Click "Setup Stats Channels"
4. [ ] Wait 5-10 minutes for first update
5. [ ] Check bot logs for: `[ServerStatsProcessor] Updating stats for: {Guild Name}`

### To Enable Panel Restoration:
1. [ ] Option A: Set `AUTO_RESTORE_PANELS=true` in `.env`
2. [ ] Option B: Enable per-server via dashboard/API
3. [ ] Restart bot
4. [ ] Check logs for: `Restauração automática de painéis no arranque: ATIVADA`

---

## 📊 Monitoring

### Server Stats Logs
```
✅ Success:
[ServerStatsProcessor] Updating stats for: My Server (123...)
[ServerStatsProcessor] Stats update cycle complete

⚠️ Issues:
[ServerStatsProcessor] Failed to update guild 123...: Permission denied
[ServerStatsProcessor] Guild 123... not found in cache
```

### Panel Restoration Logs
```
✅ Success:
🧩 Restauração automática de painéis no arranque: ATIVADA
✅ Panel restored in #support (1234567890)

⚠️ Skipped:
⏭️  [My Server] Restauração de painéis DESATIVADA para este servidor

❌ Failed:
Falha a restaurar painel: Missing Access
```

---

## 🔧 Troubleshooting

### Server Stats Not Updating
1. Check bot has permissions: `Manage Channels`, `View Channel`
2. Verify category exists and bot can access it
3. Check update interval hasn't elapsed yet
4. Look for errors in logs: `[ServerStatsProcessor] Failed to update...`

### Panel Restoration Not Working
1. Verify feature is enabled (check startup logs)
2. Check bot has permissions: `Send Messages`, `Embed Links`, `Manage Messages`
3. Verify channel still exists
4. Check if panels are in database: MongoDB/SQLite queries

### Dashboard Not Accessible
1. Ensure Next.js server is running
2. Access: `http://127.0.0.1:5175/next/`
3. Check logs for: `▲ Next.js 14.2.35` and `Ready in XXms`

---

## 📝 Notes

- Server Stats uses **voice channels** that can't be joined (display only)
- Panel restoration runs **once on startup**, not continuously
- Both features require MongoDB or SQLite backend
- Dashboard changes are applied in real-time
- Stats update interval is per-guild configurable

---

**Need help?** Check the logs for detailed error messages or consult the API documentation at `/api/docs`.
