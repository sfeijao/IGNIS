# Sistema de Tickets IGNIS - Guia de Utilização

## 🎫 Funcionalidades Implementadas

### ✨ Criação de Tickets
- **Título personalizado** para identificação rápida
- **Descrição detalhada** do problema ou solicitação
- **Níveis de severidade** com indicadores visuais:
  - 🟢 **Low** (Baixa) - Questões menores
  - 🟡 **Medium** (Média) - Questões moderadas
  - 🟠 **High** (Alta) - Questões importantes
  - 🔴 **Urgent** (Urgente) - Questões críticas
- **Seleção de usuário** específico para o ticket

### 👥 Gestão de Usuários
- **Pesquisa em tempo real** de membros do Discord
- **Adição de múltiplos usuários** a um ticket
- **Remoção de usuários** quando necessário
- **Visualização de avatares** e nomes de utilizador

### ⚙️ Gestão de Tickets
- **Atualização de severidade** em tempo real
- **Eliminação segura** de tickets
- **Refresh automático** da lista
- **Histórico completo** de alterações

## 🖥️ Como Utilizar

### Criar Novo Ticket
1. Clique no botão **"Criar Ticket"** 📝
2. Preencha o **título** do ticket
3. Adicione uma **descrição detalhada**
4. Selecione a **severidade** apropriada
5. **Pesquise e selecione** o usuário (opcional)
6. Clique em **"Criar Ticket"**

### Gerir Ticket Existente
1. Clique no botão **"Gerir"** ⚙️ do ticket desejado
2. **Adicionar usuários**: Pesquise e clique em "Adicionar"
3. **Remover usuários**: Clique no "×" ao lado do usuário
4. **Alterar severidade**: Selecione nova severidade e clique "Atualizar"
5. **Eliminar ticket**: Clique "Eliminar Ticket" e confirme

### Pesquisar Usuários
- Digite pelo menos **2 caracteres** na caixa de pesquisa
- Os resultados aparecem **instantaneamente**
- Funciona com **username**, **displayName** ou **tag**

## 🎨 Indicadores Visuais

### Cores de Severidade
- **Verde** 🟢 - Severidade baixa
- **Amarelo** 🟡 - Severidade média  
- **Laranja** 🟠 - Severidade alta
- **Vermelho** 🔴 - Severidade urgente

### Estados dos Tickets
- **Aberto** - Ticket ativo aguardando atenção
- **Atribuído** - Ticket atribuído a um moderador
- **Fechado** - Ticket resolvido e arquivado

## 🔧 Funcionalidades Técnicas

### API Endpoints
- `POST /api/tickets` - Criar ticket
- `PUT /api/tickets/:id/severity` - Atualizar severidade
- `POST /api/tickets/:id/users` - Adicionar usuário
- `DELETE /api/tickets/:id/users/:userId` - Remover usuário
- `DELETE /api/tickets/:id` - Eliminar ticket
- `GET /api/discord/users/search` - Pesquisar usuários

### Base de Dados
- **Tabela tickets** atualizada com `title` e `severity`
- **Nova tabela ticket_users** para usuários múltiplos
- **Índices otimizados** para melhor performance
- **Migração automática** da base existente

### Integração Discord
- **Criação automática** de canais de ticket
- **Permissões apropriadas** para usuários envolvidos
- **Mensagens embed** com informações completas
- **Cores dinâmicas** baseadas na severidade

## 📱 Interface Responsiva

- **Modais adaptativos** para todos os tamanhos de tela
- **Pesquisa instantânea** com feedback visual
- **Botões intuitivos** com ícones informativos
- **Feedback em tempo real** para todas as ações

## 🔒 Segurança

- **Autenticação obrigatória** para todas as operações
- **Validação rigorosa** de dados de entrada
- **Permissões do Discord** respeitadas
- **Logs completos** de todas as ações

---

**Sistema desenvolvido para o IGNIS Bot Dashboard**  
*Versão atualizada com funcionalidades avançadas de gestão de tickets*
