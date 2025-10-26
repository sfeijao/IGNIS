"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'

export default function ModerationSummary() {
  const guildId = getGuildId()
  const [stats, setStats] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const s = await fetch(`/api/guild/${guildId}/mod/stats`, { credentials: 'include' }).then(r=>r.json()).catch(()=> null)
      const c = await fetch(`/api/guild/${guildId}/mod/cases?limit=20`, { credentials: 'include' }).then(r=>r.json()).catch(()=> null)
      setStats(s)
      setCases(c?.cases || c || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [guildId])

  return (
    <div className="space-y-3">
      <div className="card p-4">
        {loading && <div className="text-neutral-400">A carregar…</div>}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats.totals || {}).map(([k,v]) => (
              <div key={k} className="p-3 rounded border border-neutral-800 bg-neutral-900">
                <div className="text-xs text-neutral-400">{k}</div>
                <div className="text-xl font-semibold">{String(v)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {cases.map((c, i) => (
            <div key={c.id || i} className="p-4 flex items-center gap-3">
              <div className="font-mono text-xs text-neutral-500">{c.id || i+1}</div>
              <div className="px-2 py-0.5 text-xs rounded bg-neutral-800 border border-neutral-700">{c.type || 'case'}</div>
              <div className="flex-1 min-w-0 text-neutral-200 truncate">{c.reason || '—'}</div>
              <div className="text-xs text-neutral-500">{c.userId || '—'} • {c.moderatorId || '—'}</div>
              <div className="text-xs text-neutral-500">{c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</div>
            </div>
          ))}
          {!loading && cases.length === 0 && <div className="p-6 text-neutral-400">Sem casos recentes.</div>}
        </div>
      </div>
    </div>
  )
}
