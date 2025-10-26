"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'

type Webhook = { id: string; name?: string; channelId?: string; url?: string }

export default function WebhooksManager() {
  const guildId = getGuildId()
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState('')
  const [name, setName] = useState('IGNIS')

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks`, { credentials: 'include' })
      if (!res.ok) throw new Error('Falha')
      const data = await res.json()
      setHooks(data.webhooks || data)
    } catch (e: any) { setError(e?.message || 'Falha ao obter webhooks') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  const create = async () => {
    if (!guildId || !channel) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/webhooks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ channelId: channel, name })
      })
      await load()
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!guildId) return
    if (!confirm('Remover webhook?')) return
    setLoading(true)
    try { await fetch(`/api/guild/${guildId}/webhooks/${id}`, { method: 'DELETE', credentials: 'include' }); await load() } finally { setLoading(false) }
  }

  const test = async (id: string) => {
    if (!guildId) return
    setLoading(true)
    try { await fetch(`/api/guild/${guildId}/webhooks/test`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify({ id }) }) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">Selecione um servidor para gerir webhooks.</div>}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-400">Channel ID</label>
          <input className="mt-1 w-56 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={channel} onChange={e=> setChannel(e.target.value)} placeholder="123…" />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Nome</label>
          <input className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={name} onChange={e=> setName(e.target.value)} placeholder="IGNIS" />
        </div>
        <button onClick={create} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={!guildId || !channel || loading}>Criar</button>
        <button onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={!guildId || loading}>Atualizar</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">A carregar…</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {hooks.map(h => (
            <div key={h.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{h.name || 'Webhook'}</div>
                <div className="text-xs text-neutral-500">{h.id} • {h.channelId}</div>
              </div>
              <button onClick={()=> test(h.id)} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Testar</button>
              <button onClick={()=> remove(h.id)} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500">Remover</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
