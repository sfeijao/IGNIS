"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'

export default function MembersList() {
  const guildId = getGuildId()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [limit, setLimit] = useState(50)
  const [refresh, setRefresh] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [members, setMembers] = useState<Array<any>>([])

  const params = useMemo(() => ({ q, role, limit, refresh }), [q, role, limit, refresh])

  useEffect(() => {
    if (!guildId) return
    ;(async () => { try { const res = await api.getRoles(guildId); setRoles(res.roles || []) } catch {} })()
  }, [guildId])

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.getMembers(guildId, params)
        if (!aborted) setMembers(res.members || res)
      } catch { if (!aborted) setMembers([]) }
      finally { if (!aborted) setLoading(false) }
    }
    run()
    return () => { aborted = true }
  }, [guildId, params])

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">Selecione um servidor para listar membros.</div>}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-xs text-neutral-400">Pesquisar</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" placeholder="Nome ou apelido" value={q} onChange={e=> setQ(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Cargo</label>
          <select className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={role} onChange={e=> setRole(e.target.value)} title="Cargo">
            <option value="">Todos</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400">Limite</label>
          <select className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={limit} onChange={e=> setLimit(parseInt(e.target.value, 10))} title="Limite de membros">
            {[25,50,100,150,200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-neutral-300 mt-5">
            <input type="checkbox" checked={refresh} onChange={e=> setRefresh(e.target.checked)} />
            Refresh
          </label>
        </div>
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">A carregar…</div>}
          {!loading && members.map((m: any) => (
            <div key={m.id} className="p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs">{String(m.username || 'U')[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="text-neutral-200 truncate">{m.nick ? `${m.nick} (${m.username}#${m.discriminator})` : `${m.username}#${m.discriminator}`}</div>
                <div className="text-xs text-neutral-500">{m.id}</div>
              </div>
              {!m.manageable && <span className="text-xs text-neutral-500">não gerenciável</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
