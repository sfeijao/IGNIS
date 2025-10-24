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
}
