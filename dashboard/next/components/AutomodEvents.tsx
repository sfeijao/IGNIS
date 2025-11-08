"use client"

import { useEffect, useMemo, useState } from 'react'
import { useGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '../lib/i18n'

type Event = { id: string; type?: string; userId?: string; content?: string; status?: string; createdAt?: string }

export default function AutomodEvents() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 20

  // guildId resolved after mount

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      // Server supports filter by resolved boolean; pending == resolved=false
      const res = await api.getAutomodEvents(gid, { resolved: false })
      setEvents(res?.events || res || [])
    } catch (e: any) { setError(e?.message || t('automod.loadFailed')) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) { setPage(0); load(guildId) } }, [guildId])

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

  const filtered = useMemo(() => {
    const base = events
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(ev => [ev.type, ev.userId, ev.content].map(x => (x||'').toLowerCase()).join(' ').includes(q))
  }, [events, search])
  const paged = useMemo(() => filtered.slice(page*pageSize, (page*pageSize)+pageSize), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const skeletonCards = Array.from({ length: 4 }).map((_,i) => (
    <div key={i} className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-800 animate-pulse">
      <div className="h-3 w-40 bg-neutral-700 rounded mb-2" />
      <div className="h-3 w-60 bg-neutral-700 rounded mb-2" />
      <div className="h-8 w-full bg-neutral-700/60 rounded" />
    </div>
  ))

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{t('automod.title')}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => guildId && load(guildId)} title={t('common.reload')}>{t('common.reload')}</button>
        </div>
        <div className="flex items-center gap-2">
          <input className="input w-48" placeholder={t('common.search')} aria-label={t('common.search')} value={search} onChange={e=>{ setSearch(e.target.value); setPage(0) }} />
          <div className="flex items-center gap-1 text-xs">
            <button type="button" className="btn btn-secondary btn-xs" disabled={page===0} onClick={() => setPage(p=>Math.max(0,p-1))}>&lt;</button>
            <span className="opacity-70">{page+1}/{totalPages}</span>
            <button type="button" className="btn btn-secondary btn-xs" disabled={page>=totalPages-1} onClick={() => setPage(p=>Math.min(totalPages-1,p+1))}>&gt;</button>
          </div>
        </div>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">{t('automod.queue')}</div>
        <div className="card-body grid gap-3" role="status" aria-live="polite" aria-busy={loading}>
          {loading && <div className="grid md:grid-cols-2 gap-3">{skeletonCards}</div>}
          {!loading && paged.length === 0 && <div className="opacity-70">{t('automod.empty')}</div>}
          {!loading && paged.map(ev => (
            <div key={ev.id} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-sm opacity-70">
                {ev.type} • {ev.userId} • {ev.createdAt ? (
                  <time suppressHydrationWarning dateTime={new Date(ev.createdAt).toISOString()}>{new Date(ev.createdAt).toLocaleString()}</time>
                ) : '—'}
              </div>
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
