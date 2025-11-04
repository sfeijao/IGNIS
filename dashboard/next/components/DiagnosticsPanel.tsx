"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { useToast } from './Toaster'

export default function DiagnosticsPanel() {
  const guildId = getGuildId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

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

  const copyReport = async () => {
    try {
      const summary = formatReport(data)
      await navigator.clipboard.writeText(summary)
      toast({ type: 'success', title: 'Relatório copiado', description: 'Pronto para colar no suporte.' })
    } catch {
      toast({ type: 'error', title: 'Falha ao copiar' })
    }
  }

  const formatReport = (d: any) => {
    if (!d) return ''
    const lines: string[] = []
    lines.push('=== Diagnóstico do Servidor ===')
    if (d.stats) {
      lines.push(`Membros: ${d.stats.memberCount}`)
      lines.push(`Canais: ${d.stats.channelCount}`)
      lines.push(`Cargos: ${d.stats.roleCount}`)
    }
    const sug = Array.isArray(d.suggestions) ? d.suggestions : []
    if (sug.length) {
      lines.push('Sugestões:')
      for (const s of sug) lines.push(`- [${s.type}] ${s.message}`)
    }
    return lines.join('\n')
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Diagnósticos</h3>
        <div className="flex items-center gap-2">
          <button onClick={copyReport} className="rounded-lg px-3 py-1.5 text-sm bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Copiar relatório</button>
          <button onClick={() => guildId && setData(null) || undefined} className="rounded-lg px-3 py-1.5 text-sm bg-neutral-800 border border-neutral-700 hover:bg-neutral-700">Limpar</button>
        </div>
      </div>
      {loading && <div className="text-neutral-400">A carregar…</div>}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4">
            <div className="text-xs text-neutral-400">Membros</div>
            <div className="text-2xl font-bold">{data.stats?.memberCount ?? '-'}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-neutral-400">Canais</div>
            <div className="text-2xl font-bold">{data.stats?.channelCount ?? '-'}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-neutral-400">Cargos</div>
            <div className="text-2xl font-bold">{data.stats?.roleCount ?? '-'}</div>
          </div>
        </div>
      )}
      {data?.suggestions?.length ? (
        <div className="card p-4">
          <div className="text-sm font-medium mb-2">Sugestões</div>
          <ul className="space-y-1 list-disc pl-5">
            {data.suggestions.map((s: any, i: number) => (
              <li key={i} className="text-sm text-neutral-200"><span className="text-neutral-400">[{s.type}]</span> {s.message}</li>
            ))}
          </ul>
        </div>
      ) : !loading && (
        <div className="text-sm text-neutral-400">Sem sugestões no momento.</div>
      )}
    </div>
  )
}
