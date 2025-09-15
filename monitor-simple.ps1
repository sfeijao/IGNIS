# IGNIS Bot Monitor Script
param(
    [int]$CheckInterval = 30
)

$BotPath = $PSScriptRoot
$LogFile = "monitor.log"
$HealthCheckUrl = "http://localhost:4000/ping"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Write-Host $logEntry
    $logEntry | Out-File -FilePath $LogFile -Append
}

function Test-BotProcess {
    # Verificar se ha processo node rodando que responde na porta 4001
    try {
        Invoke-RestMethod -Uri $HealthCheckUrl -TimeoutSec 2 -ErrorAction Stop | Out-Null
        return $true  # Se o health check responde, o bot esta rodando
    }
    catch {
        return $false
    }
}

function Test-BotHealth {
    try {
        $response = Invoke-RestMethod -Uri $HealthCheckUrl -TimeoutSec 5
        return $response.status -eq "ok"
    }
    catch {
        return $false
    }
}

function Start-Bot {
    try {
        Write-Log "Starting IGNIS Bot..."
        Set-Location $BotPath
        
        # Verificar se o arquivo index.js existe
        if (-not (Test-Path "index.js")) {
            Write-Log "ERROR: index.js not found in $BotPath" "ERROR"
            return $false
        }
        
        # Usar variavel de ambiente PORT para garantir porta correta
        $env:PORT = "4000"
        $process = Start-Process -FilePath "node" -ArgumentList "index.js" -PassThru -WindowStyle Hidden
        Write-Log "Bot process started with PID: $($process.Id)"
        
        # Aguardar tempo suficiente para inicializacao
        Start-Sleep -Seconds 20
        
        # Verificar se esta respondendo
        if (Test-BotProcess) {
            Write-Log "Bot started successfully and responding to health checks"
            return $true
        }
        else {
            Write-Log "Bot process not responding to health checks" "ERROR"
            return $false
        }
    }
    catch {
        Write-Log "Error starting bot: $($_.Exception.Message)" "ERROR"
        return $false
    }
}

Write-Log "=== IGNIS Bot Monitor Started ==="

while ($true) {
    $botProcess = Test-BotProcess
    $healthOk = Test-BotHealth
    
    if (-not $botProcess -or -not $healthOk) {
        Write-Log "Bot issues detected. Restarting..." "WARNING"
        
        if ($botProcess) {
            $botProcess | Stop-Process -Force
            Start-Sleep -Seconds 5
        }
        
        Start-Bot
    }
    else {
        Write-Log "Bot running normally"
    }
    
    Start-Sleep -Seconds $CheckInterval
}
