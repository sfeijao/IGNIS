"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'

export default function VerificationMetrics() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const [m, l] = await Promise.all([
        api.getVerificationMetrics(gid),
        api.getVerificationLogs(gid, { limit: 100 })
      ])
      setMetrics(m?.metrics || m)
      setLogs(l?.logs || l || [])
    } catch (e: any) { setError(e?.message || 'Erro ao carregar métricas') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const purge = async () => {
    if (!guildId) return
    setLoading(true)
    try { await api.purgeVerificationLogs(guildId); toast({ type: 'success', title: 'Logs limpos' }); await load(guildId) } catch (e:any) { toast({ type:'error', title:'Falha ao limpar', description: e?.message }) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Verificação: Métricas e Logs</h2>
        <button className="btn btn-secondary" onClick={() => guildId && load(guildId)} title="Recarregar">Recarregar</button>
        <button className="btn btn-danger" onClick={purge} title="Limpar logs">Limpar logs</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">Métricas</div>
        <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-3">
          {metrics ? Object.entries(metrics).map(([k,v]) => (
            <div key={k} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-xs opacity-70">{k}</div>
              <div className="text-xl font-semibold">{String(v)}</div>
            </div>
          )) : <div className="opacity-70">Sem dados</div>}
        </div>
      </section>
      <section className="card">
        <div className="card-header">Logs recentes</div>
        <div className="card-body text-xs max-h-[360px] overflow-auto">
          {logs.length === 0 && <div className="opacity-70">Sem logs</div>}
          {logs.map((l:any, idx:number) => (
            <div key={idx} className="border-b border-neutral-900/60 py-1">
              <span className="opacity-60">{new Date(l.timestamp || Date.now()).toLocaleString()} • </span>
              <span>{l.message || JSON.stringify(l)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
