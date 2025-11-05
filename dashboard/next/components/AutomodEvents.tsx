"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '../lib/i18n'

type Event = { id: string; type?: string; userId?: string; content?: string; status?: string; createdAt?: string }

export default function AutomodEvents() {
  const { t } = useI18n()
  const [guildId, setGuildId] = useState<string | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      // Server supports filter by resolved boolean; pending == resolved=false
      const res = await api.getAutomodEvents(gid, { resolved: false })
      setEvents(res?.events || res || [])
    } catch (e: any) { setError(e?.message || 'Erro ao carregar eventos') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (!guildId) return
    setLoading(true)
    try {
      // Map UI decisions to server actions
      const action = decision === 'approve' ? 'confirm' : 'release'
      await api.reviewAutomodEvent(guildId, id, action)
      await load(guildId)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('automod.title')}</h2>
  <button type="button" className="btn btn-secondary" onClick={() => guildId && load(guildId)} title={t('common.reload')}>{t('common.reload')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">{t('automod.queue')}</div>
        <div className="card-body grid gap-3">
          {events.length === 0 && <div className="opacity-70">{t('automod.empty')}</div>}
          {events.map(ev => (
            <div key={ev.id} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-sm opacity-70">{ev.type} • {ev.userId} • {new Date(ev.createdAt || Date.now()).toLocaleString()}</div>
              <div className="mt-1">{ev.content || t('automod.content.empty')}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-primary btn-xs" onClick={() => decide(ev.id, 'approve')}>{t('automod.approve')}</button>
                <button type="button" className="btn btn-danger btn-xs" onClick={() => decide(ev.id, 'reject')}>{t('automod.reject')}</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
