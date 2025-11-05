"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '@/lib/i18n'

type AnyChannel = { id: string; name: string; type?: any }
const isTextChannel = (ch: AnyChannel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  // Common Discord types: 0=text, 5=announcement; accept if missing type as fallback
  return (
    t === '' || t === '0' || t === 'text' || t === 'guild_text' || t === '5' || t === 'announcement' || t === 'guild_announcement'
  )
}

const channelTypeLabel = (ch: AnyChannel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  if (t === '0' || t === 'text' || t === 'guild_text') return 'Text'
  if (t === '2' || t === 'voice' || t === 'guild_voice') return 'Voice'
  if (t === '4' || t === 'category' || t === 'guild_category') return 'Category'
  if (t === '5' || t === 'announcement' || t === 'guild_announcement') return 'Announcement'
  return 'Channel'
}

export default function TicketsConfigForm() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [config, setConfig] = useState<any>({})
  const [json, setJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<boolean>(false)
  const { t } = useI18n()

  // Data sources for selectors
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [webhooks, setWebhooks] = useState<Array<{ id: string; name?: string; type?: string; url?: string }>>([])

  // Filters (search) for each selector
  const [roleQuery, setRoleQuery] = useState('')
  const [panelQuery, setPanelQuery] = useState('')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [logChannelQuery, setLogChannelQuery] = useState('')
  const [webhookQuery, setWebhookQuery] = useState('')

  useEffect(() => {
    setGuildId(getGuildId())
  }, [])

  useEffect(() => {
    const load = async () => {
      if (!guildId) return
      setLoading(true)
      setError(null)
      setSaved(false)
      try {
        const c = await api.getTicketsConfig(guildId)
        const obj = c?.config || c || {}
        setConfig(obj)
        setJson(JSON.stringify(obj, null, 2))
        // Load selectable resources in parallel
        const [rolesRes, channelsRes, categoriesRes, webhooksRes] = await Promise.allSettled([
          api.getRoles(guildId),
          api.getChannels(guildId),
          api.getCategories(guildId),
          api.getWebhooks(guildId)
        ])
        if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.roles || rolesRes.value || [])
        if (channelsRes.status === 'fulfilled') setChannels((channelsRes.value.channels || channelsRes.value || []).filter((x: any) => x && x.id && x.name))
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.categories || categoriesRes.value || [])
        if (webhooksRes.status === 'fulfilled') {
          const list = (webhooksRes.value.webhooks || webhooksRes.value || []).map((w: any) => ({ id: String(w._id || w.id || `${w.type}:${w.channel_id || ''}`), name: w.name, type: w.type, url: w.url }))
          setWebhooks(list)
        }
      } catch (e: any) {
  setError(e?.message || t('common.saveFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [guildId])

  const save = async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      // Try to parse edited JSON; fallback to current config
      let payload = config
      try { payload = JSON.parse(json) } catch {}
      const res = await api.saveTicketsConfig(guildId, payload)
      const obj = res?.config || payload
      setConfig(obj)
      setJson(JSON.stringify(obj, null, 2))
      setSaved(true)
    } catch (e: any) {
      setError(e?.message || 'Erro ao salvar config')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('tickets.config.title')}</h2>
        <button onClick={() => guildId && setGuildId(guildId)} className="btn btn-secondary" title={t('tickets.reload')}>{t('tickets.reload')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">{t('tickets.fields.common')}</div>
          <div className="card-body grid grid-cols-1 gap-3">
            <LabeledSelectWithSearch
              label={t('tickets.panelChannelId')}
              value={config.panelChannelId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, panelChannelId: v }))}
              query={panelQuery}
              setQuery={setPanelQuery}
              options={useMemo(() => channels
                .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(panelQuery.toLowerCase()))
                .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, panelQuery])}
              placeholder="—"
            />
            <LabeledSelectWithSearch
              label={t('tickets.staffRoleId')}
              value={config.staffRoleId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, staffRoleId: v }))}
              query={roleQuery}
              setQuery={setRoleQuery}
              options={useMemo(() => roles
                .filter(r => r.name.toLowerCase().includes(roleQuery.toLowerCase()))
                .map(r => ({ value: r.id, label: r.name })), [roles, roleQuery])}
              placeholder="—"
            />
            <LabeledSelectWithSearch
              label={t('tickets.archiveCategoryId')}
              value={config.archiveCategoryId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, archiveCategoryId: v }))}
              query={archiveQuery}
              setQuery={setArchiveQuery}
              options={useMemo(() => categories
                .filter(cat => cat.name.toLowerCase().includes(archiveQuery.toLowerCase()))
                .map(cat => ({ value: cat.id, label: cat.name })), [categories, archiveQuery])}
              placeholder="—"
            />
            <LabeledSelectWithSearch
              label={t('tickets.logChannelId')}
              value={config.logChannelId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, logChannelId: v }))}
              query={logChannelQuery}
              setQuery={setLogChannelQuery}
              options={useMemo(() => channels
                .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(logChannelQuery.toLowerCase()))
                .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, logChannelQuery])}
              placeholder="—"
            />
            <div className="text-xs text-neutral-400">
              {t('tickets.transcriptManagedInWebhooks')}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm opacity-80">{t('tickets.enabled')}</label>
              <input type="checkbox" checked={!!config.enabled} onChange={e => setConfig((c:any) => ({ ...c, enabled: e.target.checked }))} title={t('tickets.enabled')} />
            </div>
            <button className="btn btn-primary w-fit" onClick={save} disabled={loading}>{t('common.save')}</button>
            {saved && <span className="text-green-400">{t('tickets.saved')}</span>}
          </div>
        </section>
        <section className="card">
          <div className="card-header">{t('tickets.json.editor')}</div>
          <div className="card-body">
            <textarea className="input min-h-[280px] font-mono" value={json} onChange={e => setJson(e.target.value)} title="Editor JSON" />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-secondary" onClick={() => setJson(JSON.stringify(config, null, 2))}>{t('tickets.json.revert')}</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>{t('tickets.json.save')}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm opacity-80">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} title={label} />
    </label>
  )
}

function LabeledSelectWithSearch({
  label,
  value,
  onChange,
  options,
  query,
  setQuery,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  query: string
  setQuery: (q: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm opacity-80">{label}</span>
      <input className="input" value={query} onChange={(e)=> setQuery(e.target.value)} placeholder={"Pesquisar…"} title={label + ' search'} />
      <select className="input" value={value} onChange={(e)=> onChange(e.target.value)} title={label}>
        <option value="">{placeholder || '—'}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  )
}
