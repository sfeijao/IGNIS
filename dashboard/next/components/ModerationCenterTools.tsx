"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

export default function ModerationCenterTools() {
  const guildId = getGuildId()
  const { toast } = useToast()
  const { t } = useI18n()
  const [userIdsRaw, setUserIdsRaw] = useState('')
  const [action, setAction] = useState<'timeout'|'kick'|'ban'>('timeout')
  const [duration, setDuration] = useState(600) // seconds for timeout or delete msg seconds for ban
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Array<{ userId: string; ok: boolean; error?: string }>>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])
  const [contextChannelId, setContextChannelId] = useState<string>('')

  // Helpers to filter/label channels consistently
  const isTextChannel = (ch: { id: string; name: string; type?: string }) => {
    const t = String(ch.type || '').toLowerCase()
    return t.includes('text') || t.includes('announcement')
  }
  const channelTypeLabel = (ch: { type?: string } | string | undefined) => {
    const t = typeof ch === 'string' ? ch : (ch?.type || '')
    switch (String(t).toLowerCase()) {
      case 'guild_text':
      case 'text': return 'Text'
      case 'guild_announcement':
      case 'announcement': return 'Announcement'
      case 'guild_voice':
      case 'voice': return 'Voice'
      case 'guild_category':
      case 'category': return 'Category'
      default: return 'Channel'
    }
  }

  useEffect(() => {
    if (!guildId) return
    ;(async () => {
      try {
        const ch = await api.getChannels(guildId)
        const list = ch.channels || ch || []
        setChannels(list)
      } catch {}
    })()
  }, [guildId])

  // Persist optional context channel selection
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('moderationContextChannelId')
    if (saved) setContextChannelId(saved)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (contextChannelId) localStorage.setItem('moderationContextChannelId', contextChannelId)
    else localStorage.removeItem('moderationContextChannelId')
  }, [contextChannelId])

  const parseUserIds = () => Array.from(new Set(userIdsRaw.split(/[\,\n\s]+/).map(s => s.trim()).filter(Boolean)))

  const run = async () => {
    if (!guildId) return toast({ type: 'error', title: 'Guild missing' })
    const ids = parseUserIds()
    if (ids.length === 0) return toast({ type: 'error', title: t('mod.bulk.noUsers') })

    setBusy(true)
    setResults([])
    const r: Array<{ userId: string; ok: boolean; error?: string }> = []
    try {
      for (const userId of ids) {
        try {
          if (action === 'timeout') {
            await api.timeoutMember(guildId, userId, Number(duration) || 0, reason || undefined)
          } else if (action === 'kick') {
            await api.kickMember(guildId, userId, reason || undefined)
          } else if (action === 'ban') {
            await api.banMember(guildId, userId, { reason: reason || undefined, deleteMessageSeconds: Number(duration) || 0 })
          }
          r.push({ userId, ok: true })
        } catch (e: any) {
          r.push({ userId, ok: false, error: e?.message || 'error' })
        }
      }
      setResults(r)
      const ok = r.filter(x => x.ok).length
      const fail = r.length - ok
      toast({ type: fail ? 'info' : 'success', title: t('mod.bulk.done'), description: `${ok}/${r.length}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="text-lg font-semibold">{t('nav.moderation')} – {t('mod.bulk.title')}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-neutral-400" htmlFor="context-channel">{t('mod.context.channel')}</label>
          <select id="context-channel" className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={contextChannelId} onChange={e=> setContextChannelId(e.target.value)}>
            <option value="">—</option>
            {channels.filter(isTextChannel).map((ch) => (
              <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
            ))}
          </select>
          <div className="text-[11px] text-neutral-500 mt-1">{t('mod.context.hint')}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs text-neutral-400" htmlFor="user-ids">{t('mod.bulk.userIds')}</label>
          <textarea id="user-ids" className="mt-1 w-full min-h-[100px] bg-neutral-900 border border-neutral-700 rounded px-2 py-1 font-mono text-xs" placeholder="123, 456, 789" value={userIdsRaw} onChange={e=> setUserIdsRaw(e.target.value)} />
          <div className="text-[11px] text-neutral-500 mt-1">{t('mod.bulk.hint')}</div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400" htmlFor="action">{t('mod.bulk.action')}</label>
            <select id="action" className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={action} onChange={e=> setAction(e.target.value as any)}>
              <option value="timeout">{t('mod.action.timeout')}</option>
              <option value="kick">{t('mod.action.kick')}</option>
              <option value="ban">{t('mod.action.ban')}</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-400" htmlFor="duration">{action === 'timeout' ? t('mod.bulk.durationSeconds') : action === 'ban' ? t('mod.bulk.deleteMsgSeconds') : t('mod.bulk.durationSeconds')}</label>
            <input id="duration" type="number" className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={duration} onChange={e=> setDuration(parseInt(e.target.value, 10) || 0)} min={0} />
          </div>
          <div>
            <label className="text-xs text-neutral-400" htmlFor="reason">{t('mod.reason')}</label>
            <input id="reason" className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" placeholder={t('mod.reason.placeholder')} value={reason} onChange={e=> setReason(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>{busy ? t('common.working') : t('mod.bulk.run')}</button>
            <button type="button" className="btn btn-secondary" onClick={()=> { setUserIdsRaw(''); setResults([]) }} disabled={busy}>{t('common.clear')}</button>
          </div>
        </div>
      </div>
      {results.length > 0 && (
        <div className="mt-2">
          <div className="text-sm text-neutral-300 mb-2">{t('mod.bulk.results')}</div>
          <div className="max-h-48 overflow-auto border border-neutral-800 rounded">
            {results.map((r, i) => (
              <div key={i} className={`px-3 py-1 text-xs border-b border-neutral-900 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.userId} — {r.ok ? 'OK' : (r.error || 'ERR')}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
