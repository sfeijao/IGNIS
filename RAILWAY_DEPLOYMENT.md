# 🚂 Railway Deployment Checklist - IGNIS Bot

## ✅ Pre-Deployment Configuration

### 1. Environment Variables Setup
Copy these environment variables into Railway dashboard:

```bash
NODE_ENV=production
DISCORD_TOKEN=MTQwNDU4NDk0OTI4NTM4ODMzOQ.G9k9GO.NbLtyHTQpM1GD3tzvOywlPxQn9qQFWATemyZGk
DISCORD_CLIENT_ID=1404584949285388339
DISCORD_CLIENT_SECRET=b9gCodmzBXd1jIXeQHGuhoZXrxGRPY-2
DISCORD_GUILD_ID=1333820000791691284
BASE_URL=https://ignisbot.up.railway.app
SESSION_SECRET=a15b5cc7f6fff2e0204119e033c4d99f3af62a23a29291f09a572b954105e96f
CALLBACK_URL=/auth/discord/callback
UPDATES_CHANNEL_ID=1407240868334800958
VERIFICATION_CHANNEL_ID=1333820001282560020
LOGS_CHANNEL_ID=1407237814617116692
VERIFIED_ROLE_ID=1333820000846483482
STAFF_ROLE_ID=1333820000892616726
ADMIN_ROLE_ID=1333820000892616724
OWNER_ROLE_ID=381762006329589760
DATABASE_PATH=./website/database/ignis_dashboard.db
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2. Required Variables (Critical)
- ✅ `NODE_ENV=production`
- ✅ `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- ✅ `DISCORD_CLIENT_ID` - Application ID from Discord
- ✅ `DISCORD_CLIENT_SECRET` - Client secret from Discord
- ✅ `DISCORD_GUILD_ID` - Your Discord server ID
- ✅ `BASE_URL` - Your Railway app URL (https://ignisbot.up.railway.app)
- ✅ `SESSION_SECRET` - Random 32+ character string for session security

### 3. Optional Variables
- `CALLBACK_URL=/auth/discord/callback` - OAuth2 callback path
- `DATABASE_PATH=./website/database/ignis_dashboard.db` - SQLite database location
- `RATE_LIMIT_WINDOW_MS=900000` - Rate limiting window (15 minutes)
- `RATE_LIMIT_MAX_REQUESTS=100` - Max requests per window

## 🔧 Railway Configuration Steps

### Step 1: Access Railway Dashboard
1. Go to [Railway.app](https://railway.app)
2. Navigate to your IGNIS Bot project
3. Click on "Settings" → "Environment"

### Step 2: Set Environment Variables
1. Click "Add Environment Variable"
2. Add each variable from the list above
3. Make sure `NODE_ENV=production`
4. Verify `BASE_URL` matches your Railway domain

### Step 3: Discord OAuth2 Configuration
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Select your IGNIS Bot application
3. Go to "OAuth2" → "General"
4. Add redirect URI: `https://ignisbot.up.railway.app/auth/discord/callback`
5. Save changes

### Step 4: Deploy Configuration
1. Push latest changes to GitHub: `git push origin main`
2. Railway will automatically deploy
3. Check deployment logs for any errors
4. Verify bot comes online in Discord

## 🛠️ Troubleshooting

### Common Issues:

#### 1. "CLIENT_SECRET é obrigatório" Error
- ✅ **FIXED**: Updated config.js to support both `CLIENT_SECRET` and `DISCORD_CLIENT_SECRET`
- Ensure `DISCORD_CLIENT_SECRET` is set in Railway environment

#### 2. OAuth2 Redirect URI Mismatch
- Verify redirect URI in Discord Developer Portal matches Railway URL
- Should be: `https://ignisbot.up.railway.app/auth/discord/callback`

#### 3. Database Connection Issues
- Railway provides persistent storage
- Database will be created automatically on first run
- Check `DATABASE_PATH` environment variable

#### 4. Bot Permission Issues
- Ensure bot has necessary permissions in Discord server
- Required permissions: Manage Roles, Manage Channels, Send Messages

## 🚀 Deployment Commands

```bash
# Test configuration locally
node scripts/railway-config.js

# Test configuration loading
node -e "const config = require('./utils/config'); console.log('✅ Config OK');"

# Deploy to Railway (automatic when pushing to main)
git add .
git commit -m "🚂 Railway deployment configuration"
git push origin main
```

## 📊 Post-Deployment Verification

### 1. Bot Status Check
- [ ] Bot appears online in Discord
- [ ] All 25 slash commands are registered
- [ ] Bot responds to `/ping` command

### 2. Dashboard Access
- [ ] Dashboard loads at: https://ignisbot.up.railway.app
- [ ] OAuth2 login works
- [ ] Admin panel accessible

### 3. Core Features
- [ ] Ticket system functional
- [ ] Verification system working
- [ ] Analytics collecting data
- [ ] Database operations successful

## 🔄 Maintenance Commands

```bash
# View Railway logs
railway logs

# Restart Railway service
railway up --detach

# Update environment variables
railway variables set NODE_ENV=production

# Check service status
railway status
```

## 📞 Support

If deployment issues persist:
1. Check Railway deployment logs
2. Verify all environment variables are set
3. Ensure Discord OAuth2 configuration is correct
4. Test locally first with same configuration

---

**Last Updated**: 2024-12-19  
**Version**: 2.1.1  
**Status**: Production Ready ✅
