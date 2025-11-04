"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '@/lib/i18n'

export default function TicketsConfigForm() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [config, setConfig] = useState<any>({})
  const [json, setJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<boolean>(false)
  const { t } = useI18n()

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
            <LabeledInput label={t('tickets.panelChannelId')} value={config.panelChannelId || ''} onChange={v => setConfig((c:any) => ({ ...c, panelChannelId: v }))} placeholder="ID" />
            <LabeledInput label={t('tickets.staffRoleId')} value={config.staffRoleId || ''} onChange={v => setConfig((c:any) => ({ ...c, staffRoleId: v }))} placeholder="ID" />
            <LabeledInput label={t('tickets.archiveCategoryId')} value={config.archiveCategoryId || ''} onChange={v => setConfig((c:any) => ({ ...c, archiveCategoryId: v }))} placeholder="ID" />
            <LabeledInput label={t('tickets.logChannelId')} value={config.logChannelId || ''} onChange={v => setConfig((c:any) => ({ ...c, logChannelId: v }))} placeholder="ID" />
            <LabeledInput label={t('tickets.transcriptWebhook')} value={config.transcriptWebhook || ''} onChange={v => setConfig((c:any) => ({ ...c, transcriptWebhook: v }))} placeholder="URL" />
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
