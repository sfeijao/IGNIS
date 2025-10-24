'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const guildId = getGuildId()
    if (!guildId) return
    api.getLogStats(guildId).then((data) => {
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
    }).catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((s) => (
        <Stat key={s.label} label={s.label} value={s.value} dotColor={s.color} />
      ))}
    </div>
  )
}
