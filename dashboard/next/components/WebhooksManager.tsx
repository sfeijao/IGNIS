"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

type Webhook = { id: string; type?: string; name?: string; channelId?: string; url?: string; loaded?: boolean }
type TicketsConfig = { transcriptWebhook?: string }
type Channel = { id: string; name: string; type?: any }

const allowsWebhookChannel = (ch: Channel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  // Allow common text-capable types for webhooks
  return t === '' || t === '0' || t === 'text' || t === 'guild_text' || t === '5' || t === 'announcement' || t === 'guild_announcement'
}

const channelTypeLabel = (ch: Channel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  if (t === '0' || t === 'text' || t === 'guild_text') return 'Text'
  if (t === '2' || t === 'voice' || t === 'guild_voice') return 'Voice'
  if (t === '4' || t === 'category' || t === 'guild_category') return 'Category'
  if (t === '5' || t === 'announcement' || t === 'guild_announcement') return 'Announcement'
  return 'Channel'
}

export default function WebhooksManager() {
  const guildId = getGuildId()
  const [hooks, setHooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState('')
  const [name, setName] = useState('IGNIS')
  const [type, setType] = useState('logs')
  const { toast } = useToast()
  const { t } = useI18n()
  const [transcriptUrl, setTranscriptUrl] = useState<string>('')
  const [channels, setChannels] = useState<Channel[]>([])
  const [channelQuery, setChannelQuery] = useState('')

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const [hooksRes, cfgRes, chRes] = await Promise.all([
        api.getWebhooks(guildId),
        api.getTicketsConfig(guildId).catch(() => ({} as TicketsConfig)),
        api.getChannels(guildId).catch(() => ({ channels: [] as Channel[] }))
      ])
      const data = hooksRes
      const list = (data.webhooks || data || []).map((w: any) => ({ id: String(w._id || w.id || `${w.type}:${w.channel_id || ''}`), type: w.type || 'logs', name: w.name, channelId: w.channel_id, url: w.url, loaded: !!w.loaded }))
      setHooks(list)
      const cfg = (cfgRes as any)?.config || cfgRes || {}
      setTranscriptUrl(cfg.transcriptWebhook || '')
      const ch = (chRes as any)?.channels || chRes || []
      setChannels((ch as Channel[]).filter(c => c && c.id && c.name))
  } catch (e: any) { setError(e?.message || t('webhooks.error')) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  const create = async () => {
    if (!guildId || !channel) return
    setLoading(true)
    try {
      await api.createWebhookInChannel(guildId, { type, channel_id: channel, name })
      toast({ type: 'success', title: t('webhooks.created'), description: `Type ${type}` })
      await load()
    } catch (e: any) {
      toast({ type: 'error', title: t('common.saveFailed'), description: e?.message })
    } finally { setLoading(false) }
  }

  const remove = async (id: string, typeParam?: string) => {
    if (!guildId) return
    if (!confirm(t('webhooks.confirmRemove'))) return
    setLoading(true)
    try {
      await api.deleteWebhook(guildId, id, typeParam)
      toast({ type: 'success', title: t('webhooks.removed') })
      await load()
    } catch (e: any) { toast({ type: 'error', title: t('common.saveFailed'), description: e?.message }) }
    finally { setLoading(false) }
  }

  const test = async (type?: string) => {
    if (!guildId) return
    setLoading(true)
    try { await api.testWebhook(guildId, type || 'logs'); toast({ type: 'success', title: t('webhooks.test.sent') }) } catch (e: any) { toast({ type:'error', title: t('webhooks.test.fail'), description: e?.message }) } finally { setLoading(false) }
  }

  const setAsTranscript = async (url?: string) => {
    if (!guildId || !url) return
    setLoading(true)
    try {
      const current = await api.getTicketsConfig(guildId).catch(() => ({} as any))
      const base = current?.config || current || {}
      const updated = { ...base, transcriptWebhook: url }
      await api.saveTicketsConfig(guildId, updated)
      setTranscriptUrl(url)
      toast({ type: 'success', title: t('webhooks.setAsTranscript.ok') })
    } catch (e: any) {
      toast({ type: 'error', title: t('webhooks.setAsTranscript.fail'), description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const selectableChannels = useMemo(() => (
    channels
      .filter(ch => allowsWebhookChannel(ch))
      .filter(ch => ch.name.toLowerCase().includes(channelQuery.toLowerCase()))
  ), [channels, channelQuery])

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">{t('webhooks.selectGuild')}</div>}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-400">{t('webhooks.type')}</label>
          <select className="mt-1 w-40 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={type} onChange={e=> setType(e.target.value)} title="Tipo de webhook">
            <option value="logs">logs</option>
            <option value="tickets">tickets</option>
            <option value="updates">updates</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400">{t('webhooks.channelId')}</label>
          <select className="mt-1 w-64 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={channel} onChange={e=> setChannel(e.target.value)} title="Canal para criar webhook">
            <option value="">—</option>
            {selectableChannels.map(ch => (
              <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400">Pesquisar</label>
          <input className="mt-1 w-44 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={channelQuery} onChange={e=> setChannelQuery(e.target.value)} placeholder="nome do canal…" />
        </div>
        <div>
          <label className="text-xs text-neutral-400">{t('webhooks.name')}</label>
          <input className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={name} onChange={e=> setName(e.target.value)} placeholder="IGNIS" />
        </div>
  <button type="button" onClick={create} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={!guildId || !channel || loading}>{t('webhooks.create')}</button>
  <button type="button" onClick={() => guildId && api.autoSetupWebhook(guildId).then(()=>{ toast({ type:'success', title: t('webhooks.autosetup.ok') }); load(); }).catch((e:any)=> toast({ type:'error', title: t('webhooks.autosetup.fail'), description: e?.message }))} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={!guildId || loading}>{t('webhooks.autosetup')}</button>
  <button type="button" onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={!guildId || loading}>{t('webhooks.refresh')}</button>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">{t('webhooks.loading')}</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {hooks.map(h => (
            <div key={h.id} className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{h.name || 'Webhook'} <span className="text-xs text-neutral-400">({h.type})</span>
                  {h.loaded && <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-emerald-700/60 text-emerald-300">{t('webhooks.active')}</span>}
                  {h.url && transcriptUrl && h.url === transcriptUrl && <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full border border-sky-700/60 text-sky-300">{t('webhooks.transcript')}</span>}
                </div>
                <div className="text-xs text-neutral-500">{h.id} • {h.channelId}</div>
              </div>
              <button type="button" onClick={()=> test(h.type)} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('webhooks.test')}</button>
              {h.url && <button type="button" onClick={()=> setAsTranscript(h.url)} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">{t('webhooks.setAsTranscript')}</button>}
              <button type="button" onClick={()=> remove(h.id, h.type)} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500">{t('webhooks.remove')}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
