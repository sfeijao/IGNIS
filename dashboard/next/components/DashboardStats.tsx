'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Stat from './Stat'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'

export default function DashboardStats() {
  const [stats, setStats] = useState<{ label: string; value: string; color: string }[]>([
    { label: 'Ativos', value: '—', color: '#10b981' },
    { label: 'Warnings', value: '—', color: '#f59e0b' },
    { label: 'Bans', value: '—', color: '#ef4444' },
    { label: 'Kicks', value: '—', color: '#f97316' },
    { label: 'Tickets', value: '—', color: '#6366f1' },
    { label: 'Mod logs', value: '—', color: '#22d3ee' },
  ])
  const [lastUpdated, setLastUpdated] = useState<string>('—')
  const [lastActivity, setLastActivity] = useState<string>('—')
  const [summary, setSummary] = useState<string>('Dados serão carregados ao selecionar um servidor.')
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshMinutes = 2 // Auto-refresh interval in minutes

  const formatTime = (d?: Date | null) => d ? d.toLocaleString() : '—'

  const extractLastActivity = (data: any): Date | null => {
    const cands: any[] = [
      data?.lastActivity,
      data?.lastEventAt,
      data?.lastLogAt,
      data?.latest?.timestamp,
      data?.latest?.at,
      Array.isArray(data?.recent) ? data.recent[0]?.timestamp : null,
      data?.updates?.last,
    ].filter(Boolean)
    for (const t of cands) {
      const dt = new Date(t)
      if (!isNaN(dt.getTime())) return dt
    }
    return null
  }

  const fetchStats = async () => {
    const guildId = getGuildId()
    if (!guildId) return
    setLoading(true)
    try {
      const data = await api.getLogStats(guildId)
      // Assuming API returns shape { totals: { warnings, bans, kicks, tickets, logs, activeModerators } }
      if (!data) return
      const s = [
        { label: 'Ativos', value: String(data.totals?.activeModerators ?? '—'), color: '#10b981' },
        { label: 'Warnings', value: String(data.totals?.warnings ?? '—'), color: '#f59e0b' },
        { label: 'Bans', value: String(data.totals?.bans ?? '—'), color: '#ef4444' },
        { label: 'Kicks', value: String(data.totals?.kicks ?? '—'), color: '#f97316' },
        { label: 'Tickets', value: String(data.totals?.tickets ?? '—'), color: '#6366f1' },
        { label: 'Mod logs', value: String(data.totals?.logs ?? '—'), color: '#22d3ee' },
      ]
      setStats(s)
      const ts = data.updatedAt ? new Date(data.updatedAt) : new Date()
      setLastUpdated(ts.toLocaleString())
      const w = data.totals?.warnings ?? 0
      const b = data.totals?.bans ?? 0
      const k = data.totals?.kicks ?? 0
      const t = data.totals?.tickets ?? 0
      setSummary(`Resumo rápido: ${w} warnings, ${b} bans, ${k} kicks, ${t} tickets.`)
      const la = extractLastActivity(data)
      setLastActivity(formatTime(la))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(fetchStats, refreshMinutes * 60 * 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">Status & Resumo</h3>
            <p className="text-xs text-neutral-400 mt-1">{summary}</p>
            <p className="text-xs text-neutral-400 mt-1">Última atividade: {lastActivity}</p>
          </div>
          <div className="text-xs text-neutral-400 flex items-center gap-2">
            {loading && (
              <span className="inline-block h-3 w-3 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin" aria-label="Atualizando" />
            )}
            <span>{loading ? 'Atualizando…' : 'Atualizado'}: {lastUpdated}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} dotColor={s.color} />
        ))}
      </div>
    </div>
  )
}
