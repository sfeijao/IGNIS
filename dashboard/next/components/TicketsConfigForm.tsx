"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

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
  const { toast } = useToast()

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
      // Try to parse edited JSON; if it contains a `tickets` object use that, otherwise
      // if it looks like tickets-only shape, wrap into { tickets: ... }.
      let updates: any = {}
      try {
        const parsed = JSON.parse(json)
        if (parsed && typeof parsed === 'object') {
          if (parsed.tickets && typeof parsed.tickets === 'object') {
            updates = { tickets: parsed.tickets }
          } else if (
            'panelChannelId' in parsed || 'staffRoleId' in parsed || 'archiveCategoryId' in parsed || 'logChannelId' in parsed || 'enabled' in parsed
          ) {
            updates = { tickets: parsed }
          } else {
            // fallback: merge current config.tickets
            updates = { tickets: { ...(config.tickets || {}) } }
          }
        }
      } catch {
        // JSON invalid -> fall back to current form state
        updates = { tickets: { ...(config.tickets || {}) } }
      }
      // Ensure we at least send current tickets selection if empty
      if (!updates.tickets) updates.tickets = { ...(config.tickets || {}) }

      const res = await api.saveTicketsConfig(guildId, updates)
      const obj = res?.config ? { ...(res.config || {}) } : { ...config, ...(updates || {}) }
      setConfig(obj)
      setJson(JSON.stringify(obj, null, 2))
      setSaved(true)
      toast({ type: 'success', title: t('tickets.saved') })
    } catch (e: any) {
      const msg = e?.message || t('common.saveFailed')
      setError(msg)
      toast({ type: 'error', title: t('common.saveFailed'), description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const tickets = useMemo(() => (config?.tickets || {}), [config])

  // Quick validations to surface missing references
  const panelChannelMissing = !!tickets.panelChannelId && !channels.some(ch => ch.id === tickets.panelChannelId)
  const logChannelMissing = !!tickets.logChannelId && !channels.some(ch => ch.id === tickets.logChannelId)
  const staffRoleMissing = !!tickets.staffRoleId && !roles.some(r => r.id === tickets.staffRoleId)
  const archiveCategoryMissing = !!tickets.archiveCategoryId && !categories.some(c => c.id === tickets.archiveCategoryId)

  // Auto-fill sensible defaults
  const autoFill = () => {
    const pickByName = (arr: Array<{ id: string; name: string }>, patterns: RegExp[], fallback?: (arr: any[]) => any) => {
      const lower = (s: string) => (s || '').toLowerCase()
      for (const ptn of patterns) {
        const hit = arr.find(x => ptn.test(lower(x.name)))
        if (hit) return hit
      }
      return fallback ? fallback(arr) : undefined
    }
    const txt = channels.filter(isTextChannel)
    const panel = pickByName(
      txt,
      [/ticket/, /suporte|support/, /help|ajuda/],
      (arr) => arr[0]
    )
    const log = pickByName(
      txt,
      [/log/, /ticket/],
      (arr) => arr[1] || arr[0]
    )
    const cat = pickByName(
      categories,
      [/arquiv|archive/, /fechad|closed/],
      (arr) => arr[0]
    )
    const role = pickByName(
      roles,
      [/staff|equipa/, /mod/],
      (arr) => arr.find(r => /admin|gestor|manager/.test(r.name.toLowerCase())) || arr[0]
    )
    setConfig((c: any) => ({
      ...c,
      tickets: {
        ...(c.tickets || {}),
        panelChannelId: panel?.id || (c.tickets?.panelChannelId || ''),
        logChannelId: log?.id || (c.tickets?.logChannelId || ''),
        archiveCategoryId: cat?.id || (c.tickets?.archiveCategoryId || ''),
        staffRoleId: role?.id || (c.tickets?.staffRoleId || ''),
      }
    }))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('tickets.config.title')}</h2>
  <button type="button" onClick={() => guildId && setGuildId(guildId)} className="btn btn-secondary" title={t('tickets.reload')}>{t('tickets.reload')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">{t('tickets.fields.common')}</div>
          <div className="card-body grid grid-cols-1 gap-3">
            <LabeledSelectWithSearch
              label={t('tickets.panelChannelId')}
              value={tickets.panelChannelId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), panelChannelId: v } }))}
              query={panelQuery}
              setQuery={setPanelQuery}
              options={useMemo(() => channels
                .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(panelQuery.toLowerCase()))
                .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, panelQuery])}
              placeholder="—"
            />
            {panelChannelMissing && <div className="text-amber-400 text-xs">{t('tickets.warn.missingChannel')}</div>}
            <LabeledSelectWithSearch
              label={t('tickets.staffRoleId')}
              value={tickets.staffRoleId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), staffRoleId: v } }))}
              query={roleQuery}
              setQuery={setRoleQuery}
              options={useMemo(() => roles
                .filter(r => r.name.toLowerCase().includes(roleQuery.toLowerCase()))
                .map(r => ({ value: r.id, label: r.name })), [roles, roleQuery])}
              placeholder="—"
            />
            {staffRoleMissing && <div className="text-amber-400 text-xs">{t('tickets.warn.missingRole')}</div>}
            <LabeledSelectWithSearch
              label={t('tickets.archiveCategoryId')}
              value={tickets.archiveCategoryId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), archiveCategoryId: v } }))}
              query={archiveQuery}
              setQuery={setArchiveQuery}
              options={useMemo(() => categories
                .filter(cat => cat.name.toLowerCase().includes(archiveQuery.toLowerCase()))
                .map(cat => ({ value: cat.id, label: cat.name })), [categories, archiveQuery])}
              placeholder="—"
            />
            {archiveCategoryMissing && <div className="text-amber-400 text-xs">{t('tickets.warn.missingCategory')}</div>}
            <LabeledSelectWithSearch
              label={t('tickets.logChannelId')}
              value={tickets.logChannelId || ''}
              onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), logChannelId: v } }))}
              query={logChannelQuery}
              setQuery={setLogChannelQuery}
              options={useMemo(() => channels
                .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(logChannelQuery.toLowerCase()))
                .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, logChannelQuery])}
              placeholder="—"
            />
            {logChannelMissing && <div className="text-amber-400 text-xs">{t('tickets.warn.missingChannel')}</div>}
            <div className="text-xs text-neutral-400">
              {t('tickets.transcriptManagedInWebhooks')}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm opacity-80">{t('tickets.enabled')}</label>
              <input type="checkbox" checked={!!tickets.enabled} onChange={e => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), enabled: e.target.checked } }))} title={t('tickets.enabled')} />
            </div>
            <div className="flex gap-2 items-center">
              <button type="button" className="btn btn-secondary" onClick={autoFill} disabled={loading}>{t('tickets.config.autofill')}</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={loading}>{t('common.save')}</button>
              {saved && <span className="text-green-400">{t('tickets.saved')}</span>}
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-header">{t('tickets.json.editor')}</div>
          <div className="card-body">
            <textarea className="input min-h-[280px] font-mono" value={json} onChange={e => setJson(e.target.value)} title="Editor JSON" />
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setJson(JSON.stringify(config, null, 2))}>{t('tickets.json.revert')}</button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={loading}>{t('tickets.json.save')}</button>
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
