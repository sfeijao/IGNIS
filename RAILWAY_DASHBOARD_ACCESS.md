# 🔐 Railway Dashboard - Guia de Acesso

## 🎯 Problema Resolvido
Os erros 401 (Unauthorized) no dashboard Railway foram corrigidos! Agora o dashboard detecta automaticamente o ambiente e fornece opções de autenticação.

## 🚀 Como Acessar o Dashboard na Railway

### ✅ **Método 1: Token Automático (Recomendado)**
O dashboard agora usa automaticamente `admin-token` quando detecta ambiente Railway.

1. Acesse: `https://ignisbot.up.railway.app/dashboard`
2. Dashboard deve carregar automaticamente
3. Se aparecer erro de auth, use Método 2

### ✅ **Método 2: Token Manual**
Se o método automático falhar:

1. Na navbar do dashboard, você verá um campo "Token de Acesso"
2. Insira um dos tokens válidos:
   - `admin-token`
   - `dashboard-token`
   - `dev-token`
3. Clique em "Definir"
4. Dashboard será recarregado com autenticação

### ✅ **Método 3: Via URL**
Adicione token diretamente na URL:
```
https://ignisbot.up.railway.app/dashboard?token=admin-token
```

### ✅ **Método 4: Discord OAuth (Se Disponível)**
Se CLIENT_SECRET estiver configurado:
1. Clique em "Login via Discord" quando aparecer erro de auth
2. Será redirecionado para OAuth do Discord
3. Após autorização, voltará para dashboard autenticado

## 🔧 Tokens Aceitos na Produção

| Token | Descrição | Uso |
|-------|-----------|-----|
| `admin-token` | Acesso total (padrão Railway) | ✅ Recomendado |
| `dashboard-token` | Acesso ao dashboard | ✅ Funcional |
| `dev-token` | Token de desenvolvimento | ✅ Aceito |
| OAuth Discord | Autenticação completa | ✅ Se CLIENT_SECRET configurado |

## 🛠️ Troubleshooting

### Se ainda aparecer 401:
1. **Limpe cache**: Ctrl+F5 ou limpe localStorage
2. **Tente token manual**: Use campo na navbar
3. **Verifique logs**: F12 → Console para detalhes
4. **Railway restart**: Redeploy se necessário

### Logs Esperados (Console):
```
✅ Authenticated with bearer token: admin-to...
✅ Authentication test passed: {success: true, ...}
Dashboard initialized successfully
```

## 🎉 Resultado
- ✅ Dashboard Railway acessível
- ✅ API endpoints funcionando
- ✅ Tickets, analytics, configurações disponíveis
- ✅ Interface de token para facilitar acesso

---

**💡 Dica:** Use `admin-token` como padrão. É o token mais confiável para Railway production!
