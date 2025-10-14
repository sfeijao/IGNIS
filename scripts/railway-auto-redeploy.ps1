# Requires: git with push access configured for this repo.
# Purpose: Poll Railway status until healthy, then trigger a redeploy by pushing an empty commit.

param(
    [int]$IntervalSeconds = 60
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Get-RailwayStatusJson {
    try {
        # Ensure TLS12 for Invoke-RestMethod
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        return Invoke-RestMethod -Uri 'https://status.railway.app/api/v2/summary.json' -TimeoutSec 15
    }
    catch {
        Write-Warning "Failed to query Railway status: $($_.Exception.Message)"
        return $null
    }
}

function Is-Healthy($data) {
    if (-not $data) { return $false }
    # Statuspage: indicator 'none' means all good; 'minor/major/critical' means incidents.
    $indicator = $data.status.indicator
    if ($indicator -eq 'none') { return $true }

    # Additionally check components that look like Network CP / Control Plane / Network
    $comp = $data.components | Where-Object { $_.name -match 'Network CP' -or $_.name -match 'Control Plane' -or $_.name -match '^Network$' }
    if ($comp) {
        $allOperational = $true
        foreach ($c in $comp) {
            if ($c.status -ne 'operational') { $allOperational = $false }
        }
        return $allOperational -and ($indicator -eq 'none')
    }

    return $false
}

Write-Host "[auto-redeploy] Monitoring Railway status... (every $IntervalSeconds s)" -ForegroundColor Cyan

while ($true) {
    $data = Get-RailwayStatusJson
    if (Is-Healthy $data) {
        Write-Host "[auto-redeploy] Railway status healthy. Triggering redeploy via git push..." -ForegroundColor Green
        try {
            git fetch --no-tags | Out-Null
            $branch = (git rev-parse --abbrev-ref HEAD).Trim()
            if (-not $branch) { throw "Unable to determine current git branch" }
            $timestamp = Get-Date -Format s
            git commit --allow-empty -m "chore(deploy): auto redeploy after Railway recovery ($timestamp)" | Out-Null
            git push | Out-Null
            Write-Host "[auto-redeploy] Pushed empty commit on '$branch'. Railway should auto-deploy." -ForegroundColor Green
        }
        catch {
            Write-Error "[auto-redeploy] Failed to push redeploy commit: $($_.Exception.Message)"
        }
        break
    }
    else {
        $summary = if ($data) { $data.status.description } else { 'no data' }
        Write-Host "[auto-redeploy] Still degraded: $summary" -ForegroundColor Yellow
    }
    Start-Sleep -Seconds $IntervalSeconds
}

Write-Host "[auto-redeploy] Done." -ForegroundColor Cyan
