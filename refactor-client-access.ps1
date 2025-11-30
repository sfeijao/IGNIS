# Script para refatorar acessos a global.discordClient
$filePath = "c:\Users\simao\OneDrive\Desktop\Discord_BOTS\IGNIS\dashboard\server.js"
$content = Get-Content $filePath -Raw

# Padrão 1: const client = global.discordClient; if (!client) ...
$pattern1 = '(?m)(\s+)const client = global\.discordClient;\s+if\s*\(\s*!client\s*\)\s*return\s+res\.status\(500\)\.json\(\{\s*success:\s*false,\s*error:\s*[''"]Bot not available[''"]'
$replacement1 = '$1const { client, ready, error: clientError } = getDiscordClient(); if (!ready) return res.status(503).json({ success: false, error: clientError'
$content = $content -replace $pattern1, $replacement1

# Padrão 2: const guild = client.guilds.cache.get(X); if (!guild) return 404 Guild not found
$pattern2 = '(?m)(\s+)const guild = client\.guilds\.cache\.get\(([^\)]+)\);\s+if\s*\(\s*!guild\s*\)\s*return\s+res\.status\(404\)\.json\(\{\s*success:\s*false,\s*error:\s*[''"]Guild not found[''"]'
$replacement2 = '$1const { guild, error: guildError } = getGuild(client, $2); if (!guild) return res.status(404).json({ success: false, error: guildError'
$content = $content -replace $pattern2, $replacement2

# Padrão 3: const client = global.discordClient; (sem verificação imediata seguida de guild fetch)
$pattern3 = '(?m)(\s+)const client = global\.discordClient;\s+if\s*\(\s*!client\s*\)\s*\{\s*return res\.status\(500\)\.json\(\{\s*success:\s*false,\s*error:\s*[''"]Bot not available[''"]'
$replacement3 = '$1const { client, ready, error: clientError } = getDiscordClient(); if (!ready) { return res.status(503).json({ success: false, error: clientError'
$content = $content -replace $pattern3, $replacement3

# Salvar
$content | Set-Content $filePath -NoNewline

Write-Host "Refatoração completa!" -ForegroundColor Green
Write-Host "Verifique os resultados e teste o código." -ForegroundColor Yellow
