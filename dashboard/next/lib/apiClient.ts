export const api = {
  async getLogStats(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/logs/stats${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch stats')
    return res.json()
  },
  async getLogs(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/logs${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch logs')
    return res.json()
  },
  exportLogsUrl(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    return `/api/guild/${guildId}/logs/export${qs}`
  },
  async getSettings(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/settings`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch settings')
    return res.json()
  },
  async postSettings(guildId: string, payload: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to save settings')
    return res.json()
  },
  async getRoles(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/roles`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch roles')
    return res.json()
  },
  async getRole(guildId: string, roleId: string) {
    const res = await fetch(`/api/guild/${guildId}/roles/${roleId}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch role')
    return res.json()
  },
  async updateRole(
    guildId: string,
    roleId: string,
    payload: { name?: string; color?: string; hoist?: boolean; mentionable?: boolean; permissions?: string[] | string }
  ) {
    const res = await fetch(`/api/guild/${guildId}/roles/${roleId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to update role')
    return res.json()
  },
  async moveRole(
    guildId: string,
    roleId: string,
    options: { direction?: 'up'|'down'; delta?: number; position?: number }
  ) {
    const res = await fetch(`/api/guild/${guildId}/roles/${roleId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(options)
    })
    if (!res.ok) throw new Error('Failed to move role')
    return res.json()
  },
  async getMembers(
    guildId: string,
    params?: { role?: string; q?: string; limit?: number; refresh?: boolean }
  ) {
    const query = params ? new URLSearchParams(
      Object.entries(params).filter(([,v]) => v !== undefined && v !== null).map(([k,v]) => [k, String(v)])
    ).toString() : ''
    const res = await fetch(`/api/guild/${guildId}/members${query ? `?${query}` : ''}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch members')
    return res.json()
  },
  async updateMemberRoles(guildId: string, userId: string, payload: { add?: string[]; remove?: string[] }) {
    const res = await fetch(`/api/guild/${guildId}/members/${userId}/roles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload || {})
    })
    if (!res.ok) throw new Error('Failed to update member roles')
    return res.json()
  },
  async setMemberNickname(guildId: string, userId: string, nick: string, reason?: string) {
    const res = await fetch(`/api/guild/${guildId}/members/${userId}/nickname`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ nick, reason })
    })
    if (!res.ok) throw new Error('Failed to set nickname')
    return res.json()
  },
  async timeoutMember(guildId: string, userId: string, seconds: number, reason?: string) {
    const res = await fetch(`/api/guild/${guildId}/members/${userId}/timeout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ seconds, reason })
    })
    if (!res.ok) throw new Error('Failed to timeout member')
    return res.json()
  },
  async kickMember(guildId: string, userId: string, reason?: string) {
    const res = await fetch(`/api/guild/${guildId}/members/${userId}/kick`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ reason })
    })
    if (!res.ok) throw new Error('Failed to kick member')
    return res.json()
  },
  async banMember(guildId: string, userId: string, opts?: { reason?: string; deleteMessageSeconds?: number }) {
    const res = await fetch(`/api/guild/${guildId}/members/${userId}/ban`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(opts || {})
    })
    if (!res.ok) throw new Error('Failed to ban member')
    return res.json()
  },
  async getCurrentUser() {
    const res = await fetch(`/api/user`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch current user')
    return res.json()
  },
  async getTickets(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/tickets${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch tickets')
    return res.json()
  },
  exportTicketsUrl(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    return `/api/guild/${guildId}/tickets/export${qs}`
  },
  async getTicketDetails(guildId: string, ticketId: string) {
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch ticket details')
    return res.json()
  },
  async getTicketLogs(guildId: string, ticketId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}/logs${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch ticket logs')
    return res.json()
  },
  async getTicketMessages(
    guildId: string,
    ticketId: string,
    params?: { before?: string; limit?: number }
  ) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}/messages${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch ticket messages')
    return res.json()
  },
  async ticketAction(guildId: string, ticketId: string, action: string, data?: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/tickets/${ticketId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, data })
    })
    if (!res.ok) throw new Error('Failed to perform ticket action')
    return res.json()
  }
  ,
  // Tickets Panels & Categories
  async getPanels(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/panels`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch panels')
    return res.json()
  },
  async scanPanels(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/panels/scan`, { method: 'POST', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to scan panels')
    return res.json()
  },
  async createPanel(guildId: string, payload: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/panels/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to create panel')
    return res.json()
  },
  async panelAction(guildId: string, panelId: string, action: string, data?: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/panels/${panelId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, data })
    })
    if (!res.ok) throw new Error('Failed to perform panel action')
    return res.json()
  },
  async getCategories(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/categories`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch categories')
    return res.json()
  },
  async createCategory(guildId: string, payload: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/categories/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to create category')
    return res.json()
  },
  async getChannels(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/channels`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch channels')
    return res.json()
  },
  // Tickets Config
  async getTicketsConfig(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/tickets/config`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch tickets config')
    return res.json()
  },
  async saveTicketsConfig(guildId: string, payload: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/tickets/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to save tickets config')
    return res.json()
  },
  // Commands Manager
  async getCommands(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/commands`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch commands')
    return res.json()
  },
  async postCommand(guildId: string, payload: Record<string, any>) {
    const res = await fetch(`/api/guild/${guildId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to execute command action')
    return res.json()
  },
  // Automod Events
  async getAutomodEvents(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/mod/automod/events${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch automod events')
    return res.json()
  },
  async reviewAutomodEvent(guildId: string, id: string, decision: string, reason?: string) {
    const res = await fetch(`/api/guild/${guildId}/mod/automod/events/${id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // Server expects { action: 'release'|'confirm' }
      body: JSON.stringify({ action: decision })
    })
    if (!res.ok) throw new Error('Failed to review event')
    return res.json()
  },
  // Appeals
  async getAppeals(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/mod/appeals${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch appeals')
    return res.json()
  },
  async decideAppeal(guildId: string, id: string, decision: string, reason?: string) {
    const res = await fetch(`/api/guild/${guildId}/mod/appeals/${id}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      // Server expects { status: 'accepted'|'rejected', response: string }
      body: JSON.stringify({ status: decision as any, response: reason || '' })
    })
    if (!res.ok) throw new Error('Failed to submit appeal decision')
    return res.json()
  },
  // Verification metrics & logs
  async getVerificationMetrics(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/verification/metrics`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch verification metrics')
    return res.json()
  },
  async getVerificationLogs(guildId: string, params?: Record<string, string | number | boolean>) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k,v]) => [k, String(v)]))}` : ''
    const res = await fetch(`/api/guild/${guildId}/verification/logs${qs}`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch verification logs')
    return res.json()
  },
  async purgeVerificationLogs(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/verification/logs`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to purge verification logs')
    return res.json()
  },
  // Webhooks
  async getWebhooks(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/webhooks`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch webhooks')
    return res.json()
  },
  async createWebhookInChannel(guildId: string, payload: { type: string; channel_id: string; name?: string }) {
    const res = await fetch(`/api/guild/${guildId}/webhooks/create-in-channel`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('Failed to create webhook in channel')
    return res.json()
  },
  async autoSetupWebhook(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/webhooks/auto-setup`, { method: 'POST', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to auto-setup webhook')
    return res.json()
  },
  async testWebhook(guildId: string, type: string) {
    const res = await fetch(`/api/guild/${guildId}/webhooks/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ type }) })
    if (!res.ok) throw new Error('Failed to test webhook')
    return res.json()
  },
  async deleteWebhook(guildId: string, id: string, type?: string) {
    const url = `/api/guild/${guildId}/webhooks/${id}${type ? `?type=${encodeURIComponent(type)}` : ''}`
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to delete webhook')
    return res.json()
  },
  // Advanced Tags
  async getTags(guildId: string) {
    const res = await fetch(`/api/guild/${guildId}/tags`, { credentials: 'include' })
    if (!res.ok) throw new Error('Failed to fetch tags')
    return res.json()
  },
  async upsertTag(guildId: string, tag: { id?: string; name: string; prefix: string; color?: string; icon?: string; roleIds?: string[] }) {
    const res = await fetch(`/api/guild/${guildId}/tags`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ tag })
    })
    if (!res.ok) throw new Error('Failed to save tag')
    return res.json()
  },
  async deleteTag(guildId: string, id: string) {
    const res = await fetch(`/api/guild/${guildId}/tags/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('Failed to delete tag')
    return res.json()
  },
  async applyTag(guildId: string, payload: { tagId: string; userIds: string[]; reason?: string; expireSeconds?: number }) {
    const res = await fetch(`/api/guild/${guildId}/tags/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to apply tag')
    return res.json()
  },
  async removeTag(guildId: string, payload: { tagId: string; userIds: string[]; reason?: string }) {
    const res = await fetch(`/api/guild/${guildId}/tags/remove`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload) })
    if (!res.ok) throw new Error('Failed to remove tag')
    return res.json()
  },
}
