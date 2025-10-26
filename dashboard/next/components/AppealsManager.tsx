"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'

type Appeal = { id: string; userId?: string; caseId?: string; reason?: string; status?: string; createdAt?: string }

export default function AppealsManager() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({})

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const res = await api.getAppeals(gid, { status: 'pending', limit: 50 })
      setAppeals(res?.appeals || res || [])
    } catch (e: any) { setError(e?.message || 'Erro ao carregar apelos') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    if (!guildId) return
    setLoading(true)
    try { await api.decideAppeal(guildId, id, decision, decisionReason[id]) ; await load(guildId) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Apelos (pendentes)</h2>
        <button className="btn btn-secondary" onClick={() => guildId && load(guildId)} title="Recarregar">Recarregar</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">Fila</div>
        <div className="card-body grid gap-3">
          {appeals.length === 0 && <div className="opacity-70">Sem apelos</div>}
          {appeals.map(ap => (
            <div key={ap.id} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-sm opacity-70">{ap.userId} • Caso {ap.caseId} • {new Date(ap.createdAt || Date.now()).toLocaleString()}</div>
              <div className="mt-1">Motivo: {ap.reason || '(sem motivo)'}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">Justificativa da decisão</span>
                  <input className="input" value={decisionReason[ap.id] || ''} onChange={e => setDecisionReason(s => ({ ...s, [ap.id]: e.target.value }))} placeholder="Opcional" title="Justificativa" />
                </label>
                <div className="flex gap-2">
                  <button className="btn btn-primary btn-xs" onClick={() => decide(ap.id, 'approve')}>Aprovar</button>
                  <button className="btn btn-danger btn-xs" onClick={() => decide(ap.id, 'deny')}>Negar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
