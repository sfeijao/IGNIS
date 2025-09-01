# Exemplo: Private Receiver para PRIVATE_LOG_ENDPOINT

Este é um pequeno servidor Node.js que recebe POSTs em `/hooks/tickets` e grava o payload JSON em `examples/private-receiver/received/`.

Uso (PowerShell):

1) Iniciar o servidor (com token opcional):

```powershell
$env:PRIVATE_LOG_TOKEN='testtoken'; node .\examples\private-receiver\server.js
```

2) Enviar um POST de teste:

```powershell
$body = @{ 
  event='ticket_closed';
  ticket=@{ id=123; guild_id='987654321'; subject='Teste' };
  messages=@(@{ author='User#0001'; content='Olá'; ts=(Get-Date).ToString('o') });
  transcriptUrl='https://exemplo/transcript/123'
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'http://localhost:3001/hooks/tickets' -Method Post -Body $body -ContentType 'application/json' -Headers @{ Authorization = 'Bearer testtoken' }
```

3) Verifique os arquivos em `examples\private-receiver\received\`.

Configuração no bot:
- Defina `PRIVATE_LOG_ENDPOINT` como `http://<seu-ip-ou-host>:3001/hooks/tickets`.
- Se usar `PRIVATE_LOG_TOKEN`, defina também `PRIVATE_LOG_TOKEN` no ambiente do bot com o mesmo valor.

Observações:
- Este exemplo é apenas para testes locais. Em produção, coloque o receiver atrás de HTTPS e proteja o token.
