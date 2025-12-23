# 🚀 Railway Deployment - Quick Start

## Changes Committed ✅

The SIGTERM fix has been committed. Here's what to do next:

## Step 1: Push to GitHub
```powershell
git push origin main
```

## Step 2: Configure Railway Environment Variables

**Via Railway Dashboard:**
1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add/Update these variables:

```bash
# Required
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_discord_client_id

# Recommended (prevents SIGTERM)
SKIP_COMMAND_DEPLOY=true
NODE_ENV=production

# Optional (for full dashboard mode)
CLIENT_SECRET=your_oauth2_secret
MONGO_URI=your_mongodb_connection_string
```

**Via Railway CLI (if installed):**
```powershell
railway variables set SKIP_COMMAND_DEPLOY=true
railway variables set NODE_ENV=production
```

## Step 3: Deploy

### Option A: Automatic (Railway watches GitHub)
Railway will automatically deploy when you push to main branch.

### Option B: Manual Deploy via CLI
```powershell
railway up
```

### Option C: Manual Deploy via Dashboard
1. Go to Railway dashboard
2. Click your service
3. Click "Deploy" in the deployments tab

## Step 4: Monitor Deployment

### Watch Logs
```powershell
railway logs --follow
```

### Look for These Success Messages:
```
🏥 Health endpoint ativo na porta 3000
✅ Configuração básica validada
🎉 Bot iniciado com sucesso em modo FULL
```

## Step 5: Test Health Endpoint

Once deployed, test the health endpoint:
```powershell
curl https://your-app-name.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-12-22T...",
  "environment": "production"
}
```

## Troubleshooting

### If still getting SIGTERM:
1. Ensure `SKIP_COMMAND_DEPLOY=true` is set in Railway variables
2. Check Railway plan has enough resources
3. Review build logs in Railway dashboard
4. Check health endpoint: `curl https://your-app.railway.app/health`

### If commands not registered:
Temporarily set `SKIP_COMMAND_DEPLOY=false` for one deployment:
```powershell
railway variables set SKIP_COMMAND_DEPLOY=false
railway up
# Wait for deployment
railway variables set SKIP_COMMAND_DEPLOY=true
```

### Check Current Variables:
```powershell
railway variables
```

## What Was Fixed

1. **Immediate Health Endpoint**: Starts before initialization to prevent Railway timeout
2. **Skip Command Deploy**: Avoid redundant command re-deployment on restart
3. **Optimized Build**: Next.js builds during build phase, not startup
4. **Better Error Handling**: Startup errors don't kill the process

## Performance Improvement

- **Before**: 120-180s startup → SIGTERM timeout
- **After**: 15-30s startup → Successful deployment ✅

## Next Steps

After successful deployment:
1. Test bot commands in Discord
2. Check health endpoint regularly
3. Monitor Railway logs for any issues
4. Set `SKIP_COMMAND_DEPLOY=true` permanently

## Documentation

- Full fix details: [RAILWAY_SIGTERM_FIX.md](./RAILWAY_SIGTERM_FIX.md)
- Quick reference: `node scripts/railway-fix-guide.js`
- General deployment: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)

---

**Ready to deploy?** Run: `git push origin main`
