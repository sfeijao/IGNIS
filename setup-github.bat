@echo off
echo ========================================
echo 🚀 YSNM Discord Bot - Setup GitHub
echo ========================================
echo.

echo 📁 Inicializando repositório Git...
git init
echo.

echo 📝 Adicionando arquivos...
git add .
echo.

echo 💾 Fazendo primeiro commit...
git commit -m "🎉 Initial commit: YSNM Discord Bot v2.1.0

✨ Features:
- 🤖 9 comandos slash completos
- 🔐 Sistema de verificação automática  
- 🏷️ Sistema de tags/cargos avançado
- 📊 Painel de status roxo interativo
- 📝 Sistema de logs completo
- 🚀 Configuração Railway ready
- 📖 Documentação completa

🎨 Theme: Purple (#7B68EE, #9932CC, #8B5FBF)
🔧 Tech: Discord.js v14, Node.js 16+, Railway deploy"
echo.

echo 🌐 Conectando ao GitHub...
echo Para conectar ao GitHub:
echo 1. Cria um repositório em https://github.com/new
echo 2. Nome: YSNM-Discord-Bot
echo 3. Executa os comandos abaixo:
echo.
echo git remote add origin https://github.com/SEU_USUARIO/YSNM-Discord-Bot.git
echo git branch -M main
echo git push -u origin main
echo.

echo ✅ Setup concluído!
echo 📖 Lê o DEPLOY.md para instruções do Railway
echo 🚀 Próximo passo: Upload para GitHub e deploy no Railway
echo.
pause
