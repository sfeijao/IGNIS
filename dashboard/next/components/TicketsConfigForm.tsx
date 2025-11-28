"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

type AnyChannel = { id: string; name: string; type?: any }
const isTextChannel = (ch: AnyChannel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
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
  const guildId = useGuildId()
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<boolean>(false)
  const { t } = useI18n()
  const { toast } = useToast()
  const [reloadTick, setReloadTick] = useState(0)

  // Data sources for selectors
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])

  // Filters (search) for each selector
  const [roleQuery, setRoleQuery] = useState('')
  const [panelQuery, setPanelQuery] = useState('')
  const [archiveQuery, setArchiveQuery] = useState('')
  const [logChannelQuery, setLogChannelQuery] = useState('')

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

        const [rolesRes, channelsRes, categoriesRes] = await Promise.allSettled([
          api.getRoles(guildId),
          api.getChannels(guildId),
          api.getCategories(guildId)
        ])
        if (rolesRes.status === 'fulfilled') setRoles(rolesRes.value.roles || rolesRes.value || [])
        if (channelsRes.status === 'fulfilled') setChannels((channelsRes.value.channels || channelsRes.value || []).filter((x: any) => x && x.id && x.name))
        if (categoriesRes.status === 'fulfilled') setCategories(categoriesRes.value.categories || categoriesRes.value || [])
      } catch (e: any) {
        setError((e instanceof Error ? e.message : String(e)) || t('common.saveFailed'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [guildId, reloadTick, t])

  const save = useCallback(async () => {
    if (!guildId) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updates = { tickets: { ...(config.tickets || {}) } }

      const res = await api.saveTicketsConfig(guildId, updates)
      const obj = res?.config ? { ...(res.config || {}) } : { ...config, ...(updates || {}) }
      setConfig(obj)
      setSaved(true)
      toast({ type: 'success', title: t('tickets.saved') })
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) {
      const msg = (e instanceof Error ? e.message : String(e)) || t('common.saveFailed')
      setError(msg)
      toast({ type: 'error', title: t('common.saveFailed'), description: (e instanceof Error ? e.message : String(e)) })
    } finally {
      setSaving(false)
    }
  }, [guildId, config, t, toast])

  const tickets = useMemo(() => (config?.tickets || {}), [config])

  const panelChannelMissing = !!tickets.panelChannelId && !channels.some(ch => ch.id === tickets.panelChannelId)
  const logChannelMissing = !!tickets.logChannelId && !channels.some(ch => ch.id === tickets.logChannelId)
  const staffRoleMissing = !!tickets.staffRoleId && !roles.some(r => r.id === tickets.staffRoleId)
  const archiveCategoryMissing = !!tickets.archiveCategoryId && !categories.some(c => c.id === tickets.archiveCategoryId)

  const autoFill = useCallback(() => {
    const pickByName = (arr: Array<{ id: string; name: string }>, patterns: RegExp[], fallback?: (arr: any[]) => any) => {
      const lower = (s: string) => (s || '').toLowerCase()
      for (const ptn of patterns) {
        const hit = arr.find(x => ptn.test(lower(x.name)))
        if (hit) return hit
      }
      return fallback ? fallback(arr) : undefined
    }
    const txt = channels.filter(isTextChannel)
    const panel = pickByName(txt, [/ticket/, /suporte|support/, /help|ajuda/], (arr) => arr[0])
    const log = pickByName(txt, [/log/, /ticket/], (arr) => arr[1] || arr[0])
    const cat = pickByName(categories, [/arquiv|archive/, /fechad|closed/], (arr) => arr[0])
    const role = pickByName(roles, [/staff|equipa/, /mod/], (arr) => arr.find(r => /admin|gestor|manager/.test(r.name.toLowerCase())) || arr[0])

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
    toast({ type: 'success', title: 'Auto-preenchimento concluído' })
  }, [channels, categories, roles, toast])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {t('tickets.config.title')}
            </h1>
            <p className="text-gray-400 mt-1">Configure o sistema de tickets do seu servidor</p>
          </div>
          <button
            type="button"
            onClick={() => setReloadTick(x => x + 1)}
            className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 transition-all duration-200 flex items-center gap-2"
            disabled={loading}
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'A carregar...' : t('tickets.reload')}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            </svg>
            <div>
              <p className="font-semibold">Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Form */}
          <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-gray-700/50 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                </svg>
                {t('tickets.fields.common')}
              </h3>
            </div>
            <div className="p-6 space-y-5">
              <LabeledSelectWithSearch
                label={t('tickets.panelChannelId')}
                value={tickets.panelChannelId || ''}
                onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), panelChannelId: v } }))}
                query={panelQuery}
                setQuery={setPanelQuery}
                options={useMemo(() => channels
                  .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(panelQuery.toLowerCase()))
                  .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, panelQuery])}
                placeholder="Selecione o canal..."
                icon="📢"
              />
              {panelChannelMissing && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  {t('tickets.warn.missingChannel')}
                </div>
              )}

              <LabeledSelectWithSearch
                label={t('tickets.staffRoleId')}
                value={tickets.staffRoleId || ''}
                onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), staffRoleId: v } }))}
                query={roleQuery}
                setQuery={setRoleQuery}
                options={useMemo(() => roles
                  .filter(r => r.name.toLowerCase().includes(roleQuery.toLowerCase()))
                  .map(r => ({ value: r.id, label: r.name })), [roles, roleQuery])}
                placeholder="Selecione o cargo..."
                icon="👥"
              />
              {staffRoleMissing && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  {t('tickets.warn.missingRole')}
                </div>
              )}

              <LabeledSelectWithSearch
                label={t('tickets.archiveCategoryId')}
                value={tickets.archiveCategoryId || ''}
                onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), archiveCategoryId: v } }))}
                query={archiveQuery}
                setQuery={setArchiveQuery}
                options={useMemo(() => categories
                  .filter(cat => cat.name.toLowerCase().includes(archiveQuery.toLowerCase()))
                  .map(cat => ({ value: cat.id, label: cat.name })), [categories, archiveQuery])}
                placeholder="Selecione a categoria..."
                icon="📁"
              />
              {archiveCategoryMissing && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  {t('tickets.warn.missingCategory')}
                </div>
              )}

              <LabeledSelectWithSearch
                label={t('tickets.logChannelId')}
                value={tickets.logChannelId || ''}
                onChange={v => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), logChannelId: v } }))}
                query={logChannelQuery}
                setQuery={setLogChannelQuery}
                options={useMemo(() => channels
                  .filter(ch => isTextChannel(ch) && ch.name.toLowerCase().includes(logChannelQuery.toLowerCase()))
                  .map(ch => ({ value: ch.id, label: `#${ch.name} (${channelTypeLabel(ch)})` })), [channels, logChannelQuery])}
                placeholder="Selecione o canal..."
                icon="📝"
              />
              {logChannelMissing && (
                <div className="flex items-center gap-2 text-amber-400 text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" />
                  </svg>
                  {t('tickets.warn.missingChannel')}
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <p className="text-blue-300 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" />
                  </svg>
                  {t('tickets.transcriptManagedInWebhooks')}
                </p>
              </div>

              <div className="flex items-center justify-between bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium">{t('tickets.enabled')}</p>
                    <p className="text-sm text-gray-400">Ativar sistema de tickets</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!tickets.enabled}
                    onChange={e => setConfig((c:any) => ({ ...c, tickets: { ...(c.tickets || {}), enabled: e.target.checked } }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={autoFill}
                  disabled={loading || saving}
                >
                  ✨ Auto-preencher
                </button>
                <button
                  type="button"
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  onClick={save}
                  disabled={loading || saving}
                >
                  {saving && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {saving ? 'A guardar...' : t('common.save')}
                </button>
              </div>
              {saved && (
                <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg p-3 animate-pulse">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                  </svg>
                  <span className="font-medium">✓ {t('tickets.saved')}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
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
  icon
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  query: string
  setQuery: (q: string) => void
  placeholder?: string
  icon?: string
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </label>
      <input
        className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-sm"
        value={query}
        onChange={(e)=> setQuery(e.target.value)}
        placeholder="🔍 Pesquisar..."
      />
      <select
        className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer"
        value={value}
        onChange={(e)=> onChange(e.target.value)}
      >
        <option value="">{placeholder || '—'}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

