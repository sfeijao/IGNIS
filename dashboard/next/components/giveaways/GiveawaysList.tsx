"use client"

import { useEffect, useState, useRef } from 'react'
import { getGuildId } from '@/lib/guild'
import useGiveawaySocket from '@/lib/useGiveawaySocket'
import { useGiveawaysI18n } from '@/lib/useI18nGiveaways'
import GuildSelector from '@/components/GuildSelector'

export default function GiveawaysList(){
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('open')
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string|null>(null)
  const liveRegionRef = useRef<HTMLDivElement|null>(null)

  const guildId = typeof window !== 'undefined' ? getGuildId() : null
  const t = useGiveawaysI18n()
  useGiveawaySocket(guildId, (evt: any) => {
    if (!evt || !evt.type) return
    if (evt.type === 'giveaway_enter') {
      setItems(prev => prev.map(it => it._id === evt.giveawayId ? { ...it, entries_count: (it.entries_count||0)+1 } : it))
      if (liveRegionRef.current) liveRegionRef.current.textContent = t('giveaways.live.updateEntrant')
    }
    if (evt.type === 'giveaway_end') {
      setItems(prev => prev.map(it => it._id === evt.giveawayId ? { ...it, status: 'ended' } : it))
      if (liveRegionRef.current) liveRegionRef.current.textContent = t('giveaways.live.ended')
    }
    if (evt.type === 'giveaway_reroll') {
      if (liveRegionRef.current) liveRegionRef.current.textContent = t('giveaways.live.reroll')
    }
  })

  async function fetchList(){
    if (!guildId) return
    setLoading(true); setError(null)
    try {
      if (status === 'open') {
        // Fetch active + scheduled concurrently and merge
        const makeUrl = (s:string) => {
          const qs = new URLSearchParams()
          qs.set('status', s)
          if (search) qs.set('search', search)
          return `/api/guilds/${guildId}/giveaways?` + qs.toString()
        }
        const [r1, r2] = await Promise.all([
          fetch(makeUrl('active'), { credentials: 'include' }),
          fetch(makeUrl('scheduled'), { credentials: 'include' })
        ])
        const j1 = await r1.json(); const j2 = await r2.json()
        if (!r1.ok) throw new Error(j1?.error || 'fetch_failed')
        if (!r2.ok) throw new Error(j2?.error || 'fetch_failed')
        const map: Record<string, any> = {}
        ;(j1.giveaways||[]).forEach((g:any)=>{ map[g._id]=g })
        ;(j2.giveaways||[]).forEach((g:any)=>{ map[g._id]=g })
        const merged = Object.values(map) as any[]
        // Sort by created time (ObjectId) desc if present
        merged.sort((a:any,b:any)=> (String(b._id)).localeCompare(String(a._id)))
        setItems(merged)
      } else {
        const qs = new URLSearchParams()
        if (status) qs.set('status', status)
        if (search) qs.set('search', search)
        const res = await fetch(`/api/guilds/${guildId}/giveaways?`+qs.toString(), { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || 'fetch_failed')
        setItems(data.giveaways || [])
      }
    } catch (e:any) {
      setError(e.message || String(e))
    } finally { setLoading(false) }
  }

  useEffect(()=>{ fetchList() }, [guildId, status])

  if (!guildId) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="text-sm opacity-80 mb-2">Selecione um servidor para ver os sorteios.</div>
          <GuildSelector />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">🎉 {t('giveaways.title')}</h1>
        <div className="ml-auto flex gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('giveaways.search.placeholder')} aria-label={t('giveaways.search.placeholder')} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700" />
          <select value={status} onChange={e=>setStatus(e.target.value)} className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700">
            <option value="open">Ativos + Agendados</option>
            <option value="active">{t('giveaways.status.active')}</option>
            <option value="scheduled">{t('giveaways.status.scheduled')}</option>
            <option value="ended">{t('giveaways.status.ended')}</option>
          </select>
          <button onClick={fetchList} className="px-3 py-1 rounded bg-brand-600 hover:bg-brand-500 transition">{t('giveaways.action.refresh', 'Refresh')}</button>
        </div>
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {loading ? (
        <div className="text-sm opacity-80" aria-live="polite">{t('giveaways.loading', 'Loading...')}</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map(it => (
            <a key={it._id} href={`/giveaways/${it._id}`} className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4 hover:border-brand-600 transition">
              <div className="text-lg font-medium flex items-center gap-2">
                <span>🎉</span>
                <span>{it.title}</span>
              </div>
              <div className="mt-2 text-sm opacity-80 line-clamp-3">{it.description}</div>
              <div className="mt-3 text-xs opacity-70 flex gap-3">
                <span>{t('giveaways.label.status','Status')}: {it.status}</span>
                <span>{t('giveaways.field.winners')}: {it.winners_count}</span>
                {typeof it.entries_count === 'number' && <span>{t('giveaways.field.entries','Entries')}: {it.entries_count}</span>}
              </div>
            </a>
          ))}
          {!items.length && <div className="opacity-70">{t('giveaways.none')}</div>}
        </div>
      )}
      <div ref={liveRegionRef} className="sr-only" aria-live="polite" />
    </div>
  )
}
