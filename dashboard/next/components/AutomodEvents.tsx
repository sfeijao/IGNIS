"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'

type Event = { id: string; type?: string; userId?: string; content?: string; status?: string; createdAt?: string }

export default function AutomodEvents() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const res = await api.getAutomodEvents(gid, { status: 'pending', limit: 50 })
      setEvents(res?.events || res || [])
    } catch (e: any) { setError(e?.message || 'Erro ao carregar eventos') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (!guildId) return
    setLoading(true)
    try { await api.reviewAutomodEvent(guildId, id, decision) ; await load(guildId) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Eventos de Automod (pendentes)</h2>
        <button className="btn btn-secondary" onClick={() => guildId && load(guildId)} title="Recarregar">Recarregar</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">Fila</div>
        <div className="card-body grid gap-3">
          {events.length === 0 && <div className="opacity-70">Sem eventos</div>}
          {events.map(ev => (
            <div key={ev.id} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-sm opacity-70">{ev.type} • {ev.userId} • {new Date(ev.createdAt || Date.now()).toLocaleString()}</div>
              <div className="mt-1">{ev.content || '(sem conteúdo)'}</div>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-primary btn-xs" onClick={() => decide(ev.id, 'approve')}>Aprovar</button>
                <button className="btn btn-danger btn-xs" onClick={() => decide(ev.id, 'reject')}>Rejeitar</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
