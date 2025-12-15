"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'

export default function ModerationSummary() {
  const guildId = useGuildId()
  const [stats, setStats] = useState<any>(null)
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!guildId) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const s = await fetch(`/api/guild/${guildId}/mod/stats`, { credentials: 'include', signal: controller.signal })
        .then(r => r.json())
        .catch(() => null)
      const c = await fetch(`/api/guild/${guildId}/mod/cases?limit=20`, { credentials: 'include', signal: controller.signal })
        .then(r => r.json())
        .catch(() => null)
      setStats(s)
      setCases(c?.cases || c || [])
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError((e instanceof Error ? e.message : String(e)) || 'Failed to load moderation data')
      }
    } finally { setLoading(false) }
    return controller
  }

  useEffect(() => {
    const controller = load()
    return () => { controller.then(c => c?.abort()).catch(() => {}) }
  }, [guildId])

  const totalCases = cases.length
  const statEntries = Object.entries(stats?.totals || {})

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📊</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Moderation Summary
              </h2>
              <p className="text-gray-400 text-sm mt-1">Overview of recent moderation actions</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-red-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-red-600 peer-checked:to-orange-600"></div>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && statEntries.length > 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">📈</span>
            <h3 className="text-lg font-semibold text-white">Statistics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statEntries && Array.isArray(statEntries) && statEntries.map(([k, v]) => (
              <div key={k} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">{k}</div>
                <div className="text-2xl font-bold text-white">{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Cases */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-semibold text-white">Recent Cases ({totalCases})</h3>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all"
            disabled={!enabled}
          >
            🔄 Refresh
          </button>
        </div>

        <div className="space-y-2">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">A carregar casos...</div>
            </div>
          )}

          {!loading && cases.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-gray-400">Sem casos recentes.</div>
            </div>
          )}

          {!loading && cases.map((c, i) => (
            <div key={c.id || i} className="bg-gray-900/50 border border-gray-700 hover:border-red-600/50 rounded-xl p-4 transition-all duration-200">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-lg font-mono text-xs text-gray-400">
                  #{c.id || i + 1}
                </div>
                <div className="px-3 py-1 bg-red-600/20 text-red-400 rounded-lg text-xs font-medium uppercase">
                  {c.type || 'case'}
                </div>
                <div className="flex-1 min-w-0 text-white truncate">
                  {c.reason || '—'}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="font-mono">{c.userId || '—'}</span>
                  <span>•</span>
                  <span className="font-mono">{c.moderatorId || '—'}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {c.createdAt ? (
                    <time suppressHydrationWarning dateTime={new Date(c.createdAt).toISOString()}>
                      {new Date(c.createdAt).toLocaleString()}
                    </time>
                  ) : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
