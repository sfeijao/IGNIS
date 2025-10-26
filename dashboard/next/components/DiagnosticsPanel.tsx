"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'

export default function DiagnosticsPanel() {
  const guildId = getGuildId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    setLoading(true)
    ;(async () => {
      try { const res = await fetch(`/api/guild/${guildId}/diagnostics`, { credentials: 'include' }); const json = await res.json(); if (!aborted) setData(json) } catch {}
      finally { if (!aborted) setLoading(false) }
    })()
    return () => { aborted = true }
  }, [guildId])

  return (
    <div className="card p-5 space-y-3">
      {loading && <div className="text-neutral-400">A carregar…</div>}
      {data && (
        <pre className="text-xs bg-neutral-950 border border-neutral-800 rounded p-3 overflow-auto max-h-[480px]">{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  )
}
