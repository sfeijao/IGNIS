@echo off
echo =====================================
echo    IGNIS Bot - Sistema de Monitoramento
echo =====================================
echo.
echo [%TIME%] Iniciando sistema de monitoramento...
echo.

:loop
echo [%TIME%] Verificando status do bot...

REM Verificar se o bot está rodando
tasklist /FI "IMAGENAME eq node.exe" /FI "WINDOWTITLE eq *IGNIS*" 2>NUL | find /I /N "node.exe" >NUL
if "%ERRORLEVEL%"=="0" (
    echo [%TIME%] ✅ Bot está online
) else (
    echo [%TIME%] ❌ Bot offline - Reiniciando...
    echo.
    cd /d "%~dp0"
    start /min "" node index.js
    echo [%TIME%] 🔄 Bot reiniciado
)

echo [%TIME%] Próxima verificação em 30 segundos...
echo.
timeout /t 30 /nobreak >nul
goto loop
