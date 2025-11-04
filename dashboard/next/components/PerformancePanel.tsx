"use client"

import { useEffect, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import Sparkline from './Sparkline'
import { useToast } from './Toaster'

export default function PerformancePanel() {
  const guildId = getGuildId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [series, setSeries] = useState<number[]>([])
  const { toast } = useToast()

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    let interval: any
    const load = async () => {
      try {
        const res = await fetch(`/api/guild/${guildId}/performance`, { credentials: 'include' })
        if (!res.ok) throw new Error('Falha ao obter performance')
        const json = await res.json()
        if (!aborted) {
          setData(json)
          const mem = Number(json?.metrics?.memoryMB || 0)
          setSeries(prev => [...prev.slice(-99), mem])
        }
      } catch (e: any) {
        if (!aborted) toast({ type: 'error', title: 'Erro de performance', description: e?.message })
      }
    }
    setLoading(true)
    load().finally(() => setLoading(false))
    interval = window.setInterval(load, 5000)
    return () => { aborted = true; window.clearInterval(interval) }
  }, [guildId, toast])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-neutral-400">Uptime</div>
          <div className="text-2xl font-bold">{formatUptime(data?.metrics?.uptimeSeconds)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-neutral-400">Memória (RSS)</div>
          <div className="text-2xl font-bold">{data?.metrics?.memoryMB ?? '-'} MB</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-neutral-400">Heap</div>
          <div className="text-2xl font-bold">{data?.metrics?.heapUsedMB ?? '-'} MB</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-neutral-400">Bot WS Ping</div>
          <div className="text-2xl font-bold">{data?.metrics?.apiPing ?? '-'} ms</div>
        </div>
      </div>
      <div className="card p-4">
        <div className="text-sm mb-2">Memória (últimas leituras)</div>
        <Sparkline data={series} height={48} className="w-full" />
      </div>
    </div>
  )
}

function formatUptime(s?: number) {
  if (!s && s !== 0) return '-'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${d}d ${h}h ${m}m`
}
