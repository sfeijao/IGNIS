"use client"

import { useEffect, useRef, useState } from 'react'
const logger = require('../../utils/logger');
import { useGuildId } from '@/lib/guild'
import { useGiveawaysI18n } from '@/lib/useI18nGiveaways'

// Duration parser: Converts "1h", "3d12h", "24h", "30m" into milliseconds
function parseDuration(input: string): number | null {
  const str = input.trim().toLowerCase()
  if (!str) return null

  // Match pattern like: 3d12h30m or 1h or 30m
  const dayMatch = str.match(/(\d+)d/)
  const hourMatch = str.match(/(\d+)h/)
  const minMatch = str.match(/(\d+)m/)

  const days = dayMatch ? parseInt(dayMatch[1]) : 0
  const hours = hourMatch ? parseInt(hourMatch[1]) : 0
  const minutes = minMatch ? parseInt(minMatch[1]) : 0

  // If no valid units found, try parsing as plain number (assume minutes)
  if (days === 0 && hours === 0 && minutes === 0) {
    const num = parseInt(str)
    if (!isNaN(num) && num > 0) return num * 60 * 1000
    return null
  }

  return (days * 24 * 60 + hours * 60 + minutes) * 60 * 1000
}

export default function GiveawayWizard(){
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [winners, setWinners] = useState(1)
  const [duration, setDuration] = useState('24h')
  const [channelId, setChannelId] = useState('')
  const [method, setMethod] = useState<'reaction' | 'button' | 'command'>('button')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [activeCount, setActiveCount] = useState<number|null>(null)
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type: number }>>([])
  const triggerRef = useRef<HTMLButtonElement|null>(null)
  const firstFieldRef = useRef<HTMLInputElement|null>(null)
  const t = useGiveawaysI18n()

  const guildId = useGuildId()

  async function create(){
    if (!guildId) { setError('Select a guild first'); return }
    if (!title.trim()) { setError('Title is required'); return }
    if (!channelId) { setError('Please select a channel'); return }

    const durationMs = parseDuration(duration)
    if (!durationMs || durationMs < 60000) {
      setError('Invalid duration. Use format like "1h", "3d12h", "30m" (minimum 1 minute)')
      return
    }

    setCreating(true); setError(null)
    try {
      const ends_at = new Date(Date.now() + durationMs).toISOString()
      const res = await fetch(`/api/guilds/${guildId}/giveaways`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          winners_count: winners,
          ends_at,
          channel_id: channelId,
          method
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'create_failed')
      window.location.href = `/giveaways/${data.giveaway._id}`
    } catch (e:any) {
      setError(e.message || String(e))
    } finally { setCreating(false) }
  }

  useEffect(() => {
    if (open && guildId) {
      // Focus first field
      setTimeout(() => { try { firstFieldRef.current?.focus() } catch (e: any) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); } }, 0)

      // Fetch active giveaway count
      fetch(`/api/guilds/${guildId}/giveaways?status=active`, { credentials: 'include' })
        .then(r => r.json().then(j => ({ ok: r.ok, data: j })))
        .then(({ ok, data }) => { if (ok && data && Array.isArray(data.giveaways)) setActiveCount(data.giveaways.length) })
        .catch(() => {})

      // Fetch text channels
      fetch(`/api/guild/${guildId}/channels`, { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          if (data.channels) {
            // Filter text channels (type 0) and announcement channels (type 5)
            const textChannels = data.channels.filter((c: any) => c.type === 0 || c.type === 5)
            setChannels(textChannels)
            // Auto-select first channel if available
            if (textChannels.length > 0 && !channelId) {
              setChannelId(textChannels[0].id)
            }
          }
        })
        .catch(() => {})
    }
  }, [open, guildId])

  function openModal(){
    triggerRef.current = (document.activeElement as HTMLButtonElement) || null
    setOpen(true)
  }
  function closeModal(){
    setOpen(false)
    setTimeout(()=>{ try { triggerRef.current?.focus() } catch (e: any) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); } }, 0)
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
                <textarea value={description} onChange={e=>setDescription(e.target.value)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" placeholder="Participa para ganhar!" rows={2} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm opacity-80">Canal</span>
                <select value={channelId} onChange={e=>setChannelId(e.target.value)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">
                  <option value="">Selecione um canal...</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>#{ch.name}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="grid gap-1">
                  <span className="text-sm opacity-80">{t('giveaways.field.winners')}</span>
                  <input type="number" min={1} max={100} value={winners} onChange={e=>setWinners(Math.max(1, Math.min(100, parseInt(e.target.value||'1')||1)))} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm opacity-80" title="Exemplos: 1h, 24h, 3d12h, 30m">Duração</span>
                  <input value={duration} onChange={e=>setDuration(e.target.value)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700" placeholder="24h" />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm opacity-80">Método</span>
                  <select value={method} onChange={e=>setMethod(e.target.value as any)} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">
                    <option value="button">Botão</option>
                    <option value="reaction">Reação</option>
                    <option value="command">Comando</option>
                  </select>
                </label>
              </div>
              <div className="text-xs opacity-60">
                <strong>Duração:</strong> Use formatos como "1h" (1 hora), "24h" (24 horas), "3d" (3 dias), "3d12h" (3 dias e 12 horas), "30m" (30 minutos)
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded bg-neutral-800 border border-neutral-700">{t('giveaways.action.cancel')}</button>
              <button onClick={create} disabled={creating || !title.trim() || !channelId} className="px-3 py-2 rounded bg-brand-600 hover:bg-brand-500 disabled:opacity-60 transition">
                {creating ? 'A criar...' : t('giveaways.action.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
