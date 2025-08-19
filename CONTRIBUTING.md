# 🤝 Contribuindo para YSNM Discord Bot

Obrigado por considerar contribuir para o YSNM Discord Bot! Seguindo essas diretrizes, você ajuda a manter o projeto organizado e funcional.

## 📋 Como Contribuir

### 🐛 Reportar Bugs

Se encontraste um bug, por favor:

1. **Verifica** se já existe uma [issue](https://github.com/SEU_USUARIO/YSNM-Discord-Bot/issues) relacionada
2. **Cria** uma nova issue com o template de bug
3. **Inclui** informações detalhadas:
   - Versão do Node.js
   - Versão do Discord.js
   - Comando/funcionalidade afetada
   - Passos para reproduzir
   - Comportamento esperado vs atual

### 💡 Sugerir Funcionalidades

Para sugerir novas funcionalidades:

1. **Verifica** se já existe uma issue de feature request
2. **Cria** uma nova issue explicando:
   - Problema que a funcionalidade resolve
   - Solução proposta
   - Alternativas consideradas
   - Contexto adicional

### 🔧 Pull Requests

1. **Fork** o repositório
2. **Cria** uma branch a partir de `main`:
   ```bash
   git checkout -b feature/nome-da-funcionalidade
   # ou
   git checkout -b fix/nome-do-bug
   ```
3. **Faz** as alterações seguindo o style guide
4. **Testa** localmente com `npm start`
5. **Commit** com mensagens descritivas:
   ```bash
   git commit -m "feat: adiciona comando de moderação avançada"
   git commit -m "fix: corrige emojis no painel de status"
   git commit -m "docs: atualiza README com novas instruções"
   ```
6. **Push** para tua branch:
   ```bash
   git push origin feature/nome-da-funcionalidade
   ```
7. **Abre** um Pull Request no GitHub

## 📝 Style Guide

### JavaScript
- **Usar** ES6+ syntax
- **Seguir** padrão semicolon
- **Indentação** de 4 espaços
- **Nomes** descritivos para variáveis e funções
- **Comentários** em português para explicar lógica complexa

### Commits
Seguir o padrão [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Nova funcionalidade
- `fix:` - Correção de bug
- `docs:` - Alterações na documentação
- `style:` - Formatação, sem mudança de código
- `refactor:` - Refatoração sem adicionar features ou corrigir bugs
- `test:` - Adicionar ou corrigir testes
- `chore:` - Mudanças em ferramentas, configs, etc.

### Estrutura de Arquivos
```
commands/
├── categoria-comando.js     # Nome descritivo
events/
├── nomeEvento.js           # CamelCase
```

## 🧪 Testes

Antes de submeter um PR:

1. **Testa** localmente:
   ```bash
   npm start
   ```
2. **Verifica** se todos comandos funcionam
3. **Testa** interações com botões
4. **Confirma** que não quebrou funcionalidades existentes

## 📂 Estrutura de Issues

### Bug Report
```markdown
**Descrição do Bug**
Descrição clara do que está errado.

**Passos para Reproduzir**
1. Vá para '...'
2. Clique em '....'
3. Scroll down para '....'
4. Vê o erro

**Comportamento Esperado**
O que deveria acontecer.

**Screenshots**
Se aplicável, adiciona screenshots.

**Ambiente:**
- OS: [ex: Windows 10]
- Node.js: [ex: 18.17.0]
- Discord.js: [ex: 14.14.1]
```

### Feature Request
```markdown
**A sua solicitação de funcionalidade está relacionada a um problema?**
Descrição clara do problema.

**Descreve a solução que gostarias**
Descrição da funcionalidade desejada.

**Alternativas consideradas**
Outras soluções que consideraste.

**Contexto adicional**
Qualquer informação adicional.
```

## 🎯 Áreas de Contribuição

### 🔥 Prioridade Alta
- **Correções de bugs** críticos
- **Melhorias de performance**
- **Documentação** faltante
- **Testes** unitários

### 🎨 Melhorias
- **Novos comandos** úteis para comunidade
- **Interface** do bot (embeds, botões)
- **Funcionalidades** de moderação
- **Integração** com APIs externas

### 🧹 Manutenção
- **Refatoração** de código legacy
- **Atualização** de dependências
- **Otimização** de queries
- **Limpeza** de código não utilizado

## 💬 Comunicação

- **Issues** - Para bugs e feature requests
- **Discussions** - Para dúvidas e ideias gerais
- **Discord** - Para comunicação rápida ([YSNM Community](https://discord.gg/ysnm))

## 🏆 Reconhecimento

Contribuidores serão:
- **Listados** no README
- **Mencionados** nos releases
- **Reconhecidos** na comunidade Discord

## ❓ Dúvidas?

Se tens dúvidas sobre como contribuir:
1. **Verifica** este guia novamente
2. **Procura** issues similares
3. **Cria** uma discussion
4. **Contacta** via Discord

---

**Obrigado por contribuíres para o YSNM Discord Bot! 💜**
