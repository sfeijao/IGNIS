"use client"

import { useEffect, useState } from 'react'
const logger = require('../utils/logger');
import { useGuildId } from '@/lib/guild'
import { useToast } from './Toaster'

export default function DiagnosticsPanel() {
  const guildId = useGuildId()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (!guildId) return
    const controller = new AbortController()
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch(`/api/guild/${guildId}/diagnostics`, { credentials: 'include', signal: controller.signal })
        const json = await res.json()
        setData(json)
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          logger.debug('Caught error:', (e instanceof Error ? e.message : String(e)))
        }
      } finally {
        setLoading(false)
      }
    })()
    return () => controller.abort()
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

  const memberCount = data?.stats?.memberCount ?? 0
  const channelCount = data?.stats?.channelCount ?? 0
  const roleCount = data?.stats?.roleCount ?? 0
  const suggestionsCount = Array.isArray(data?.suggestions) ? data.suggestions.length : 0

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-amber-600/20 to-yellow-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔍</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-400 bg-clip-text text-transparent">
                Diagnósticos
              </h2>
              <p className="text-gray-400 text-sm mt-1">System health and server diagnostics</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-amber-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-amber-600 peer-checked:to-yellow-600"></div>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{loading ? '...' : memberCount}</div>
              <div className="text-sm text-gray-400">Membros</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center text-2xl">
              📺
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{loading ? '...' : channelCount}</div>
              <div className="text-sm text-gray-400">Canais</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-pink-600/20 to-rose-600/20 rounded-lg flex items-center justify-center text-2xl">
              🎭
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{loading ? '...' : roleCount}</div>
              <div className="text-sm text-gray-400">Cargos</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-amber-600/20 to-yellow-600/20 rounded-lg flex items-center justify-center text-2xl">
              💡
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{loading ? '...' : suggestionsCount}</div>
              <div className="text-sm text-gray-400">Sugestões</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚡</span>
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={copyReport}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all disabled:opacity-50"
            disabled={!data || !enabled}
          >
            📋 Copiar relatório
          </button>
          <button
            type="button"
            onClick={() => guildId && setData(null)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
            disabled={!enabled}
          >
            🗑️ Limpar
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
          >
            🔄 Recarregar página
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {data?.suggestions?.length > 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-2xl">💡</span>
            <h3 className="text-lg font-semibold text-white">Sugestões</h3>
          </div>
          <div className="space-y-3">
            {data.suggestions.map((s: any, i: number) => (
              <div key={i} className="bg-gray-900/50 border border-amber-600/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="px-2 py-1 bg-amber-600/20 text-amber-400 text-xs font-medium rounded-lg uppercase">
                    {s.type}
                  </span>
                  <div className="flex-1 text-gray-300">{s.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !data?.suggestions?.length && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-12">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <div className="text-gray-400">Sem sugestões no momento.</div>
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-12">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <div className="text-gray-400">A carregar diagnósticos...</div>
          </div>
        </div>
      )}
    </div>
  )
}
