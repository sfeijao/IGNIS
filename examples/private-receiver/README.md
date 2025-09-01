# Exemplo: Private Receiver para PRIVATE_LOG_ENDPOINT
# Exemplo: Private Receiver para PRIVATE_LOG_ENDPOINT

Pequeno servidor Node.js para testes locais do recurso `PRIVATE_LOG_ENDPOINT`.

O servidor aceita POST em `/hooks/tickets` com payload JSON e grava cada pedido em `examples/private-receiver/received/`.

Principais pontos
- Requer `Authorization: Bearer <token>` se `PRIVATE_LOG_TOKEN` estiver definido no processo; caso contrário, o endpoint fica aberto para testes locais.
- Limite simples de payload: 5 MB.

Segurança adicional (HMAC)
- Se definires `PRIVATE_LOG_HMAC_SECRET`, o receiver exigirá um header de assinatura HMAC-SHA256. Por padrão o exemplo usa um modo com timestamp:
  - Envia `X-Timestamp: <ms-since-epoch>` e `X-Signature: sha256=<hex>` onde a assinatura é HMAC-SHA256 sobre `String(timestamp) + '.' + rawBodyBytes`.
  - O receiver valida a assinatura e rejeita pedidos com timestamp com idade maior que `PRIVATE_LOG_HMAC_TTL` (em segundos, default 300).

Exemplo (PowerShell) — cliente assinado (timestamped):

```powershell
$env:PRIVATE_LOG_HMAC_SECRET='testsecret'; $env:PRIVATE_LOG_TOKEN='testtoken'; node .\examples\private-receiver\test-post-signed.js
```

Exemplo (do lado do bot) — usando o helper do projeto (`website/utils/privateLogger`):

```powershell
$env:PRIVATE_LOG_HMAC_SECRET='testsecret'; $env:PRIVATE_LOG_TOKEN='testtoken'; node .\examples\private-receiver\test-send-from-bot.js
```

Replay protection
- The receiver keeps a short in-memory cache of seen signatures for the TTL window and will reject repeated identical signatures (response: 401, message: "Replay detected").

Quick test runner
- You can run `node .\examples\private-receiver\run_tests.js` while the server is running to execute the included tests (signed POST, helper send, replay test).

Como usar (PowerShell)

1) Iniciar o servidor (com token opcional):

```powershell
$env:PRIVATE_LOG_TOKEN = 'testtoken'
node .\examples\private-receiver\server.js
```

2) Enviar um POST de teste:

```powershell
$body = @{ 
  event = 'ticket_closed';
  ticket = @{ id = '123'; channelId = '456' };
  messages = @(@{ author = 'User#0001'; content = 'Olá'; ts = (Get-Date).ToString('o') });
  transcriptUrl = 'https://exemplo/transcript/123'
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'http://localhost:3001/hooks/tickets' -Method Post -Body $body -ContentType 'application/json' -Headers @{ Authorization = 'Bearer testtoken' }
```

Os ficheiros recebidos serão gravados em `examples/private-receiver/received/` com timestamp no nome.

Avisos
- Este receiver é um utilitário de desenvolvimento. Para produção, use HTTPS, autenticação forte e armazenamento seguro.

2) Run the ad-hoc tests:
```powershell
  node .\examples\private-receiver\test-post-signed.js
  node .\examples\private-receiver\test-send-from-bot.js
  node .\examples\private-receiver\test-replay.js
```

3) Run the mocha integration tests (requires the receiver to be running on localhost:3001 with the env vars shown above):
```powershell
  npm run test:private-receiver
```

CI notes
--
The repository includes a GitHub Actions workflow `private-receiver-tests.yml` that starts the example receiver, waits for a healthy HTTP 200 on `/`, runs the mocha tests, and prints `receiver.log` on failure. The workflow uses `node` to start the receiver and redirects its output to `receiver.log` for easier debugging.

Local quickstart
--
1) Start the server for local testing (PowerShell):
```powershell
$env:PRIVATE_LOG_TOKEN = 'testtoken'
$env:PRIVATE_LOG_HMAC_SECRET = 'testsecret'
node .\examples\private-receiver\server.js
```
2) Run all tests (mocha should be installed via `npm install`):
```powershell
npm run test:private-receiver
```

Optional: sqlite-backed replay cache
--
To enable durable replay detection across restarts, set `PRIVATE_LOG_USE_SQLITE=1` before starting the receiver. This will store seen signatures and expiry times in `examples/private-receiver/replay-cache.sqlite` using `better-sqlite3`.

On Windows PowerShell:
```powershell
$env:PRIVATE_LOG_USE_SQLITE = '1'
node .\examples\private-receiver\server.js
```
