# Script PowerShell para reiniciar o bot
Write-Host "🔄 Parando processos Node.js..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "⏱️ Aguardando 2 segundos..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

Write-Host "🚀 Iniciando o bot..." -ForegroundColor Green
node index.js
