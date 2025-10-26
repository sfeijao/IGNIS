"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'

type Command = { name: string; id?: string; description?: string; type?: string }

export default function CommandsManager() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const [runName, setRunName] = useState('')
  const [runArgs, setRunArgs] = useState('')
  const [runChannelId, setRunChannelId] = useState('')

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.getCommands(gid)
      const list = res?.commands || res || []
      setCommands(list)
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar comandos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const action = async (payload: Record<string, any>) => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.postCommand(guildId, payload)
      setResult(JSON.stringify(res))
      await load(guildId)
    } catch (e: any) { setError(e?.message || 'Falha na ação') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Comandos do Servidor</h2>
        <button className="btn btn-secondary" onClick={() => guildId && load(guildId)} title="Recarregar">Recarregar</button>
        <button className="btn btn-primary" onClick={() => action({ action: 'deploy' })} title="Re-deploy">Re-deploy</button>
        <button className="btn btn-secondary" onClick={() => action({ action: 'sync' })} title="Sincronizar">Sync</button>
        <button className="btn btn-danger" onClick={() => action({ action: 'clear' })} title="Limpar comandos do servidor">Limpar</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      {result && <pre className="text-xs opacity-70 max-h-40 overflow-auto">{result}</pre>}
      <section className="card">
        <div className="card-header">Executar comando</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Nome</span>
            <input className="input" value={runName} onChange={e => setRunName(e.target.value)} placeholder="ex: ping" title="Nome do comando" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Argumentos</span>
            <input className="input" value={runArgs} onChange={e => setRunArgs(e.target.value)} placeholder="ex: user:@ignis" title="Argumentos" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm opacity-80">Canal (opcional)</span>
            <input className="input" value={runChannelId} onChange={e => setRunChannelId(e.target.value)} placeholder="ID do canal" title="Canal" />
          </label>
          <div className="flex items-end">
            <button className="btn btn-primary" onClick={() => action({ action: 'run', name: runName, args: runArgs, channelId: runChannelId || undefined })} disabled={!runName}>Executar</button>
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-header">Comandos registrados</div>
        <div className="card-body grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {commands.map((c) => (
            <div key={c.id || c.name} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="font-medium">/{c.name}</div>
              <div className="text-xs opacity-70">{c.description || 'Sem descrição'}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
