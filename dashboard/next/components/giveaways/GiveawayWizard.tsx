"use client"

import { useEffect, useRef, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { useGiveawaysI18n } from '@/lib/useI18nGiveaways'

export default function GiveawayWizard(){
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [winners, setWinners] = useState(1)
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [activeCount, setActiveCount] = useState<number|null>(null)
  const triggerRef = useRef<HTMLButtonElement|null>(null)
  const firstFieldRef = useRef<HTMLInputElement|null>(null)
  const t = useGiveawaysI18n()

  const guildId = typeof window !== 'undefined' ? getGuildId() : null

  async function create(){
    if (!guildId) { setError('Select a guild first'); return }
    setCreating(true); setError(null)
    try {
      const ends_at = new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000).toISOString()
      const res = await fetch(`/api/guilds/${guildId}/giveaways`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, winners_count: winners, ends_at })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'create_failed')
      window.location.href = `/giveaways/${data.giveaway._id}`
    } catch (e:any) {
      setError(e.message || String(e))
    } finally { setCreating(false) }
  }

  useEffect(() => {
    if (open) {
      // focus first field when opening
      setTimeout(() => { try { firstFieldRef.current?.focus() } catch {} }, 0)
      // Prefetch quick context (active giveaways count) to aid decisions and avoid extra request later
      const gid = guildId
      if (gid) {
        fetch(`/api/guilds/${gid}/giveaways?status=active`, { credentials: 'include' })
          .then(r => r.json().then(j => ({ ok: r.ok, data: j })))
          .then(({ ok, data }) => { if (ok && data && Array.isArray(data.giveaways)) setActiveCount(data.giveaways.length) })
          .catch(()=>{})
      }
    }
  }, [open])

  function openModal(){
    triggerRef.current = (document.activeElement as HTMLButtonElement) || null
    setOpen(true)
  }
  function closeModal(){
    setOpen(false)
    setTimeout(()=>{ try { triggerRef.current?.focus() } catch {} }, 0)
  }

  return (
    <div>
      <button onClick={openModal} className="px-3 py-2 rounded bg-brand-600 hover:bg-brand-500 transition">{t('giveaways.new')}</button>
      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="create-giveaway-title">
          <div className="w-[95%] max-w-xl rounded-xl border border-neutral-800 bg-neutral-900 p-4 shadow-xl">
            <div id="create-giveaway-title" className="text-lg font-semibold mb-3">{t('giveaways.action.create')}</div>
            {error && <div className="text-sm text-red-400 mb-2">{error}</div>}
            <div className="grid gap-3">
              {activeCount != null && (
                <div className="text-xs opacity-70">{t('giveaways.meta.activeCount','Ativos')}: {activeCount}</div>
              )}
              <label className="grid gap-1">
                <span className="text-sm opacity-80">{t('giveaways.field.title')}</span>
                <input ref={firstFieldRef} value={title} onChange={e=>setTitle(e.target.value)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" placeholder="Nitro semanal" />
              </label>
              <label className="grid gap-1">
                <span className="text-sm opacity-80">{t('giveaways.field.description')}</span>
                <textarea value={description} onChange={e=>setDescription(e.target.value)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" placeholder="Participa para ganhar!" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1">
                  <span className="text-sm opacity-80">{t('giveaways.field.winners')}</span>
                  <input type="number" min={1} value={winners} onChange={e=>setWinners(parseInt(e.target.value||'1')||1)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm opacity-80">{t('giveaways.field.duration')}</span>
                  <input type="number" min={1} value={durationMinutes} onChange={e=>setDurationMinutes(parseInt(e.target.value||'60')||60)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">{t('giveaways.action.cancel')}</button>
              <button onClick={create} disabled={creating || !title} className="px-3 py-2 rounded bg-brand-600 hover:bg-brand-500 disabled:opacity-60 transition">
                {creating ? 'A criar...' : t('giveaways.action.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
