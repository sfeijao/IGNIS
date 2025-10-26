"use client"

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'

type Role = { id: string; name: string; color?: string; position?: number; managed?: boolean; mentionable?: boolean }

export default function RolesManager() {
  const guildId = getGuildId()
  const [roles, setRoles] = useState<Role[]>([])
  const [name, setName] = useState('novo-cargo')
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getRoles(guildId)
      setRoles(res.roles || [])
    } catch (e: any) { setError(e?.message || 'Falha ao carregar cargos') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  const create = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, color, hoist: false, mentionable: false })
      })
      await load()
    } finally { setLoading(false) }
  }

  const remove = async (id: string) => {
    if (!guildId) return
    if (!confirm('Remover cargo?')) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/roles/${id}`, { method: 'DELETE', credentials: 'include' })
      await load()
    } finally { setLoading(false) }
  }

  const move = async (id: string, direction: 'up'|'down') => {
    if (!guildId) return
    setLoading(true)
    try {
      await fetch(`/api/guild/${guildId}/roles/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ direction, delta: 1 })
      })
      await load()
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">Selecione um servidor para gerir cargos.</div>}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-400">Nome</label>
          <input className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={name} onChange={e=> setName(e.target.value)} placeholder="Nome do cargo" title="Nome do cargo" />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Cor (#RRGGBB)</label>
          <input className="mt-1 w-40 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={color} onChange={e=> setColor(e.target.value)} placeholder="#ffffff" title="Cor em hexadecimal" />
        </div>
        <button onClick={create} className="mt-5 px-3 py-2 rounded bg-brand-600 hover:bg-brand-700 disabled:opacity-50" disabled={!guildId || loading}>Criar</button>
        <button onClick={load} className="mt-5 px-3 py-2 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={!guildId || loading}>Atualizar</button>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">A carregar…</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {roles.map(r => (
            <div key={r.id} className="p-4 flex items-center gap-3">
              <div className="h-4 w-4 rounded" style={{ background: r.color || '#888' }} />
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{r.name}</div>
                <div className="text-xs text-neutral-500">{r.id}</div>
              </div>
              <button onClick={()=> move(r.id, 'up')} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Up</button>
              <button onClick={()=> move(r.id, 'down')} className="px-2 py-1 text-xs rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Down</button>
              {!r.managed && <button onClick={()=> remove(r.id)} className="px-2 py-1 text-xs rounded bg-rose-600 hover:bg-rose-500">Remover</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
