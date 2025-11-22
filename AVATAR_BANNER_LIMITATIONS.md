# 🤖 Limitações da API do Discord - Avatar e Banner do Bot

## ❌ IMPORTANTE: Avatar e Banner são GLOBAIS

### Limitação Técnica
A API do Discord **NÃO** permite que bots tenham avatares ou banners diferentes por servidor. Estas configurações são **GLOBAIS** para toda a conta do bot.

### O que isso significa?

- ✅ **Possível**: Alterar o avatar/banner do bot globalmente (afeta todos os servidores)
- ❌ **Impossível**: Ter um avatar diferente em cada servidor
- ✅ **Possível**: Alterar o nickname do bot por servidor (usando `/bot setnick`)

### Por que é assim?

O avatar e banner do bot fazem parte do **perfil da conta Discord** do bot, não das configurações específicas de um servidor. Isto é uma limitação da própria arquitetura da API do Discord.

### Alternativas

Se você precisa de personalização visual por servidor, considere:

1. **Webhooks**: Use webhooks com avatares customizados para cada servidor
2. **Nickname**: Altere o nickname do bot por servidor (`/bot setnick`)
3. **Embeds Personalizados**: Use embeds com thumbnails e imagens customizadas

### Comandos Disponíveis

#### `/bot setavatar`
- Altera o avatar do bot **globalmente**
- Afeta todos os servidores onde o bot está
- Requer permissão de Gerenciar Servidor
- Limite: 2 alterações por hora (limite da API Discord)

#### `/bot setbanner`
- Altera o banner do bot **globalmente** (se disponível)
- Requer que o bot tenha boost/premium
- Afeta todos os servidores

#### `/bot setnick`
- Altera o nickname do bot **apenas no servidor atual**
- Esta SIM é uma configuração por servidor
- Requer permissão de Gerenciar Apelidos

### Recomendações

1. **Use o comando `/bot setavatar` com cuidado** - Ele afeta todos os servidores
2. **Comunique mudanças importantes** - Se você administra múltiplos servidores com o mesmo bot
3. **Considere usar webhooks** - Para logs e mensagens com aparência customizada por servidor

### Links Úteis

- [Documentação da API Discord - Bots](https://discord.com/developers/docs/topics/oauth2#bots)
- [Rate Limits da API Discord](https://discord.com/developers/docs/topics/rate-limits)

---

**Conclusão**: Se você tentou configurar avatares diferentes por servidor e não funcionou, não é um bug - é uma limitação intencional da API do Discord.
