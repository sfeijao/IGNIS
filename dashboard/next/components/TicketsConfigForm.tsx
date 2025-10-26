"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'

export default function TicketsConfigForm() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [config, setConfig] = useState<any>({})
  const [json, setJson] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<boolean>(false)

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
        setError(e?.message || 'Erro ao carregar config')
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
        <h2 className="text-xl font-semibold">Configuração de Tickets</h2>
        <button onClick={() => guildId && setGuildId(guildId)} className="btn btn-secondary" title="Recarregar">Recarregar</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">Campos comuns</div>
          <div className="card-body grid grid-cols-1 gap-3">
            <LabeledInput label="Canal do painel" value={config.panelChannelId || ''} onChange={v => setConfig((c:any) => ({ ...c, panelChannelId: v }))} placeholder="ID do canal" />
            <LabeledInput label="Cargo da equipe" value={config.staffRoleId || ''} onChange={v => setConfig((c:any) => ({ ...c, staffRoleId: v }))} placeholder="ID do cargo" />
            <LabeledInput label="Categoria de arquivo" value={config.archiveCategoryId || ''} onChange={v => setConfig((c:any) => ({ ...c, archiveCategoryId: v }))} placeholder="ID da categoria" />
            <LabeledInput label="Canal de logs" value={config.logChannelId || ''} onChange={v => setConfig((c:any) => ({ ...c, logChannelId: v }))} placeholder="ID do canal de logs" />
            <LabeledInput label="Webhook de transcrição" value={config.transcriptWebhook || ''} onChange={v => setConfig((c:any) => ({ ...c, transcriptWebhook: v }))} placeholder="URL do webhook" />
            <div className="flex items-center gap-3">
              <label className="text-sm opacity-80">Ativar tickets</label>
              <input type="checkbox" checked={!!config.enabled} onChange={e => setConfig((c:any) => ({ ...c, enabled: e.target.checked }))} title="Ativar" />
            </div>
            <button className="btn btn-primary w-fit" onClick={save} disabled={loading}>Salvar</button>
            {saved && <span className="text-green-400">Salvo!</span>}
          </div>
        </section>
        <section className="card">
          <div className="card-header">Editor JSON (avançado)</div>
          <div className="card-body">
            <textarea className="input min-h-[280px] font-mono" value={json} onChange={e => setJson(e.target.value)} title="Editor JSON" />
            <div className="mt-3 flex gap-2">
              <button className="btn btn-secondary" onClick={() => setJson(JSON.stringify(config, null, 2))}>Reverter</button>
              <button className="btn btn-primary" onClick={save} disabled={loading}>Salvar JSON</button>
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
