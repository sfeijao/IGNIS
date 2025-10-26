"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'

type LogItem = {
  id?: string
  type?: string
  userId?: string
  moderatorId?: string
  channelId?: string
  createdAt?: string
  reason?: string
  details?: any
}

export default function LogsList() {
  const guildId = getGuildId()
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const [user, setUser] = useState('')
  const [mod, setMod] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<LogItem[]>([])
  const [count, setCount] = useState<number>(0)

  const params = useMemo(() => ({ q, type, user, moderator: mod, page, pageSize }), [q, type, user, mod, page, pageSize])

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getLogs(guildId, params)
        if (!aborted) { setRows(res.logs || res.items || []); setCount(res.total || res.count || 0) }
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Falha ao carregar logs')
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    run()
    return () => { aborted = true }
  }, [guildId, params])

  const exportUrl = guildId ? api.exportLogsUrl(guildId, params) : '#'

  return (
    <div className="space-y-3">
      {!guildId && (
        <div className="card p-4 text-sm text-neutral-400">Selecione um servidor para ver os logs.</div>
      )}
      <div className="card p-4 grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <label className="text-xs text-neutral-400">Pesquisa</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={q} onChange={e=>{ setPage(1); setQ(e.target.value) }} placeholder="ID, user, canal, razão…" />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Tipo</label>
          <select className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={type} onChange={e=>{ setPage(1); setType(e.target.value) }}>
            <option value="">Qualquer</option>
            {['warn','ban','kick','mute','unmute','timeout','note','ticket','message_delete','message_edit'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400">User ID</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={user} onChange={e=>{ setPage(1); setUser(e.target.value) }} />
        </div>
        <div>
          <label className="text-xs text-neutral-400">Mod ID</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={mod} onChange={e=>{ setPage(1); setMod(e.target.value) }} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=> window.open(exportUrl, '_blank')} className="mt-5 bg-neutral-800 hover:bg-neutral-700 text-sm px-3 py-2 rounded border border-neutral-700 disabled:opacity-50" disabled={!guildId}>Exportar</button>
          {(q || type || user || mod) && (
            <button onClick={()=>{ setQ(''); setType(''); setUser(''); setMod(''); setPage(1) }} className="mt-5 underline text-xs text-neutral-400 hover:text-neutral-200">Limpar</button>
          )}
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">Carregando…</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {!loading && !error && rows.length === 0 && (
            <div className="p-6 text-neutral-400">Sem resultados.</div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="font-mono text-xs text-neutral-500">{r.id || i+1}</div>
              <div className="px-2 py-0.5 text-xs rounded bg-neutral-800 border border-neutral-700">{r.type || '—'}</div>
              <div className="flex-1 min-w-0 text-neutral-200 truncate">{r.reason || r.details?.reason || '—'}</div>
              <div className="text-xs text-neutral-400">{r.userId || '—'} • {r.moderatorId || '—'}</div>
              <div className="text-xs text-neutral-500">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3 border-t border-neutral-800 text-sm">
          <div className="text-neutral-400">Total: {count}</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50" disabled={page<=1} onClick={()=> setPage(p=>p-1)}>Prev</button>
            <span className="text-neutral-400">{page}</span>
            <button className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700" onClick={()=> setPage(p=>p+1)}>Next</button>
            <select className="ml-2 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" value={pageSize} onChange={e=>{ setPage(1); setPageSize(parseInt(e.target.value, 10)) }}>
              {[25,50,100,200].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
