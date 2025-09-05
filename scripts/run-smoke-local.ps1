param(
    [int]$Port = 4000,
    [int]$WaitSeconds = 30
)

$ErrorActionPreference = 'Stop'
Write-Output "Starting local smoke tests (port=$Port)"

Write-Output "Starting website server..."
$proc = Start-Process -FilePath 'node' -ArgumentList 'website/server.js' -PassThru
Write-Output "Server started (pid=$($proc.Id)). Waiting for readiness..."

$ready = $false
for ($i = 1; $i -le $WaitSeconds; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$Port/dashboard" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200 -or $resp.StatusCode -eq 302) {
            Write-Output "server ready (checked at attempt $i)"
            $ready = $true
            break
        }
    } catch {
        # ignore and retry
    }
    Start-Sleep -Seconds 1
}

if (-not $ready) {
    Write-Error "Server did not become ready within $WaitSeconds seconds. See logs or run 'node website/server.js' manually."
    try { Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue } catch {}
    exit 2
}

try {
    Write-Output "Running fetch-based smoke test..."
    & node website/tools/e2e-smoke-fetch.js
    $fetchExit = $LASTEXITCODE
    if ($fetchExit -ne 0) {
        Write-Error "Fetch-based smoke test failed with exit code $fetchExit"
        throw "fetch-failed"
    }

    Write-Output "Running headless smoke test..."
    & node website/tools/e2e-smoke-headless.js
    $headlessExit = $LASTEXITCODE
    if ($headlessExit -ne 0) {
        Write-Error "Headless smoke test failed with exit code $headlessExit"
        throw "headless-failed"
    }

    Write-Output "Smoke tests passed."
    exit 0
} catch {
    Write-Error "Smoke tests failed: $_"
    exit 3
} finally {
    Write-Output "Stopping website server (pid=$($proc.Id))..."
    try { Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue } catch {}
}
