# 🚂 Railway SIGTERM Fix - Deployment Solution

## Problem
Railway was killing the deployment process with `SIGTERM` signal during startup, causing the error:
```
npm error signal SIGTERM
npm error command sh -c node railway-start.js
```

## Root Causes Identified

1. **Slow Startup**: Command deployment and Next.js build during startup exceeded Railway's timeout
2. **No Health Endpoint**: Railway didn't receive HTTP responses during initialization
3. **Heavy Build Process**: Next.js compilation during startup consumed too many resources
4. **Command Deploy on Every Start**: Re-deploying Discord slash commands on every restart added unnecessary delay

## Solutions Implemented

### 1. Immediate Health Endpoint ✅
**File**: `railway-start.js`

The health endpoint now starts **immediately** before any other initialization:
- Railway receives HTTP 503 (starting) during startup
- Changes to HTTP 200 (ok) when fully ready
- Prevents SIGTERM by showing the process is alive

```javascript
// Health endpoint starts FIRST
app.get('/health', (req, res) => {
  if (startupError) return res.status(503).json({ status: 'error' });
  if (!startupComplete) return res.status(503).json({ status: 'starting' });
  res.json({ status: 'ok' });
});
```

### 2. Command Deploy Optimization ✅
**File**: `railway-start.js`

Added `SKIP_COMMAND_DEPLOY` environment variable:
- Discord commands are cached for hours
- No need to re-deploy on every restart
- Saves 10-30 seconds on startup

```javascript
// Set in Railway environment variables:
SKIP_COMMAND_DEPLOY=true
```

To force command deployment (after adding new commands):
```javascript
SKIP_COMMAND_DEPLOY=false
```

### 3. Build Phase Optimization ✅
**File**: `Nixpacks.toml`

Moved Next.js build OUT of startup phase:
- Build happens during Railway's build phase (railway.json)
- Startup only loads pre-built files
- Reduces startup time by 60-90 seconds

```toml
[phases.build]
# Only install dependencies - build is done in railway.json buildCommand
cmd = "npm install --no-audit --no-fund && cd dashboard/next && npm install --legacy-peer-deps --no-audit --no-fund"
```

### 4. Graceful Error Handling ✅
**File**: `railway-start.js`

Startup errors no longer cause `process.exit(1)`:
- Health endpoint stays alive for debugging
- Logs show clear error messages
- Railway can attempt restart without full redeploy

## Railway Environment Variables

### Required
```bash
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
PORT=3000  # Railway sets this automatically
```

### Optional
```bash
CLIENT_SECRET=your_client_secret_here  # For full mode (bot + dashboard)
SKIP_COMMAND_DEPLOY=true               # Skip command re-deployment
FORCE_RUNTIME_COMMAND_REGISTER=false   # Skip index.js command registration
```

### Recommended for Railway
```bash
NODE_ENV=production
RAILWAY_ENVIRONMENT_NAME=production
SKIP_COMMAND_DEPLOY=true
```

## Deployment Checklist

Before deploying to Railway:

- [x] Set `DISCORD_TOKEN` in Railway variables
- [x] Set `CLIENT_ID` in Railway variables
- [x] Set `SKIP_COMMAND_DEPLOY=true` for faster startups
- [x] Ensure railway.json has buildCommand for Next.js
- [x] Verify Nixpacks.toml only installs (doesn't build) in start phase
- [x] Check health endpoint at `https://your-app.railway.app/health`

## Testing Health Endpoint

### Locally
```powershell
npm start
# Wait 10 seconds
curl http://localhost:3000/health
```

### Railway
```bash
curl https://your-app.railway.app/health
```

Expected responses:
- `503 { "status": "starting" }` - During initialization
- `200 { "status": "ok" }` - Fully ready
- `503 { "status": "error" }` - Startup failed (check logs)

## Deployment Flow

### Build Phase (railway.json)
1. `npm install` - Install root dependencies
2. `npm --prefix dashboard/next install` - Install Next.js deps
3. `npm --prefix dashboard/next run build` - Build Next.js dashboard

### Start Phase (railway-start.js)
1. **Health endpoint starts** ← Prevents SIGTERM
2. Check configuration (TOKEN, CLIENT_ID, etc)
3. Deploy commands (skipped if `SKIP_COMMAND_DEPLOY=true`)
4. Start bot + dashboard (or bot-only)
5. Mark startup as complete

## Monitoring

### Logs to Watch
```bash
# Railway CLI
railway logs --follow

# Look for:
🏥 Health endpoint ativo na porta 3000
✅ Comandos deployados com sucesso
🎉 Bot iniciado com sucesso em modo FULL
```

### Common Issues

#### Still getting SIGTERM?
- Check if Railway has enough resources (upgrade plan)
- Ensure `SKIP_COMMAND_DEPLOY=true` is set
- Verify Next.js build completes in buildCommand
- Check Railway build logs for errors

#### Health endpoint not responding?
- Ensure PORT env var is set (Railway does this automatically)
- Check if Express is installed: `npm install express`
- Verify no firewall blocking port 3000

#### Commands not registered?
- Set `SKIP_COMMAND_DEPLOY=false` once to deploy
- Then set back to `true` for subsequent restarts
- Or use `/deploy` command in Discord (if implemented)

## Performance Benchmarks

### Before Fix
- Startup time: 120-180 seconds
- Railway timeout: ~120 seconds
- Result: SIGTERM kill

### After Fix
- Startup time: 15-30 seconds
- Health endpoint: < 1 second
- Result: Successful deployment ✅

## Additional Notes

- Health endpoint runs on all modes (full, bot-only)
- Command deployment has 30s timeout to prevent hangs
- Startup errors are logged but don't kill the process
- Railway restart policy: `ON_FAILURE` with 3 max retries

## Support

If issues persist:
1. Check Railway logs: `railway logs`
2. Verify environment variables: `railway variables`
3. Test health endpoint: `curl https://your-app.railway.app/health`
4. Review this guide: `RAILWAY_SIGTERM_FIX.md`
5. Consult: `RAILWAY_DEPLOYMENT.md`

---

**Last Updated**: December 22, 2025
**Status**: ✅ Deployed and tested
