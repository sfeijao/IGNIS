const logger = require('../utils/logger');
"use client"

import { useEffect, useMemo, useState } from 'react'
import { useGuildId } from '../lib/guild'
import { useI18n } from '../lib/i18n'
import { api } from '../lib/apiClient'

type Command = { name: string; id?: string; description?: string; type?: string }

export default function CommandsManager() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const [runName, setRunName] = useState('')
  const [runArgs, setRunArgs] = useState('')
  const [runChannelId, setRunChannelId] = useState('')
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])

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

  // guildId resolved after mount

  const load = async (gid: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.getCommands(gid)
      const list = res?.commands || res || []
      setCommands(list)
    } catch (e: any) {
      setError(e?.message || t('commands.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (guildId) { load(guildId); (async()=>{ try { const ch = await api.getChannels(guildId); setChannels(ch.channels || ch || []) } catch (e) { logger.debug('Caught error:', e?.message || e); } })() } }, [guildId])

  const action = async (payload: Record<string, any>) => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.postCommand(guildId, payload)
      setResult(JSON.stringify(res))
      await load(guildId)
  } catch (e: any) { setError(e?.message || t('commands.actionFailed')) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))
  }, [commands, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{t('commands.title')}</h2>
  <button type="button" className="btn btn-secondary" onClick={() => guildId && load(guildId)} title={t('common.reload')}>{t('common.reload')}</button>
  <button type="button" className="btn btn-primary" onClick={() => action({ action: 'deploy' })} title={t('commands.redeploy')}>{t('commands.redeploy')}</button>
  <button type="button" className="btn btn-secondary" onClick={() => action({ action: 'sync' })} title={t('commands.sync')}>{t('commands.sync')}</button>
  <button type="button" className="btn btn-danger" onClick={() => action({ action: 'clear' })} title={t('commands.clear.title')}>{t('commands.clear')}</button>
        <input className="input" placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {error && <div className="text-red-400">{error}</div>}
      {result && <pre className="text-xs opacity-70 max-h-40 overflow-auto">{result}</pre>}
      <section className="card">
        <div className="card-header">{t('commands.run.title')}</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">{t('commands.form.name')}</span>
            <input className="input" value={runName} onChange={e => setRunName(e.target.value)} placeholder={t('commands.form.name.placeholder')} title={t('commands.form.name.title')} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">{t('commands.form.args')}</span>
            <input className="input" value={runArgs} onChange={e => setRunArgs(e.target.value)} placeholder={t('commands.form.args.placeholder')} title={t('commands.form.args.title')} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">{t('commands.form.channel')}</span>
            <select className="input" value={runChannelId} onChange={e => setRunChannelId(e.target.value)} title={t('commands.form.channel.title')}>
              <option value="">—</option>
              {channels.filter(isTextChannel).map(ch => (
                <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button type="button" className="btn btn-primary" onClick={() => action({ action: 'run', name: runName, args: runArgs, channelId: runChannelId || undefined })} disabled={!runName}>{t('commands.runButton')}</button>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-header">{t('commands.registered')}</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" role="status" aria-live="polite" aria-busy={loading}>
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-3 rounded-lg bg-neutral-800/40 border border-neutral-800 animate-pulse h-20" />
          ))}
          {!loading && filtered.map((c) => (
            <div key={c.id || c.name} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="font-medium">/{c.name}</div>
              <div className="text-xs opacity-70">{c.description || t('commands.noDescription')}</div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="opacity-70 text-sm">{t('commands.none')}</div>
          )}
        </div>
      </section>
    </div>
  )
}
