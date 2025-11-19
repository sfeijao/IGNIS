"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import Sparkline from './Sparkline'
import { useToast } from './Toaster'

export default function PerformancePanel() {
  const guildId = useGuildId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [series, setSeries] = useState<number[]>([])
  const [enabled, setEnabled] = useState(true)
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

  const formatUptime = (s?: number) => {
    if (!s && s !== 0) return '—'
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    return `${d}d ${h}h ${m}m`
  }

  const uptimeSeconds = data?.metrics?.uptimeSeconds
  const memoryMB = data?.metrics?.memoryMB ?? '—'
  const heapUsedMB = data?.metrics?.heapUsedMB ?? '—'
  const apiPing = data?.metrics?.apiPing ?? '—'

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Performance
              </h2>
              <p className="text-gray-400 text-sm mt-1">Real-time bot performance metrics</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-600 peer-checked:to-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-xl">
                ⏱️
              </div>
              <div className="text-xs text-gray-400">Uptime</div>
            </div>
            <div className="text-2xl font-bold text-white">{loading ? '...' : formatUptime(uptimeSeconds)}</div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center text-xl">
                💾
              </div>
              <div className="text-xs text-gray-400">Memória (RSS)</div>
            </div>
            <div className="text-2xl font-bold text-purple-400">{loading ? '...' : memoryMB} {memoryMB !== '—' && 'MB'}</div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-600/20 to-yellow-600/20 rounded-lg flex items-center justify-center text-xl">
                📈
              </div>
              <div className="text-xs text-gray-400">Heap</div>
            </div>
            <div className="text-2xl font-bold text-amber-400">{loading ? '...' : heapUsedMB} {heapUsedMB !== '—' && 'MB'}</div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-xl">
                📡
              </div>
              <div className="text-xs text-gray-400">Bot WS Ping</div>
            </div>
            <div className="text-2xl font-bold text-green-400">{loading ? '...' : apiPing} {apiPing !== '—' && 'ms'}</div>
          </div>
        </div>
      </div>

      {/* Memory Chart */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📉</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">Memória (últimas leituras)</h3>
            <p className="text-sm text-gray-400">Atualiza a cada 5 segundos</p>
          </div>
          <div className="px-3 py-1 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium">
            Live
          </div>
        </div>
        {series.length > 0 ? (
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-700">
            <Sparkline data={series} height={64} className="w-full" />
          </div>
        ) : (
          <div className="bg-gray-900/50 rounded-xl p-12 border border-gray-700 text-center">
            <div className="text-gray-400">Aguardando dados...</div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-r from-blue-600/10 to-cyan-600/10 backdrop-blur-xl border border-blue-600/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <div className="font-medium text-blue-300 mb-1">Performance Monitoring</div>
            <div className="text-sm text-gray-400">
              Métricas atualizadas automaticamente a cada 5 segundos. O gráfico mostra o histórico dos últimos 100 pontos de memória.
            </div>
          </div>
        </div>
      </div>

      {loading && series.length === 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-12">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-gray-400">A carregar métricas...</div>
          </div>
        </div>
      )}
    </div>
  )
}
