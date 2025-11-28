"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'

type TimeEntry = {
  id: string
  userId: string
  userName: string
  action: 'start' | 'stop' | 'continue'
  timestamp: string
  duration?: number
}

type UserSummary = {
  userId: string
  userName: string
  totalTime: number
  entries: number
  lastAction?: string
}

export default function TimeTrackingManager() {
  const params = useParams()
  const guildId = params?.gid as string
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [summaries, setSummaries] = useState<UserSummary[]>([])
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<'entries' | 'summary'>('summary')

  useEffect(() => {
    if (!guildId) return
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.getTimeTracking(guildId)
        setEntries(res.entries || [])
        setSummaries(res.summaries || [])
      } catch (e: any) {
        toast({ type: 'error', title: 'Erro ao carregar', description: (e instanceof Error ? e.message : String(e)) })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [guildId, toast])

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const minutes = Math.floor((ms % 3600000) / 60000)
    return `${hours}h ${minutes}m`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const filteredEntries = entries.filter(e =>
    e.userName.toLowerCase().includes(filter.toLowerCase())
  )

  const filteredSummaries = summaries.filter(s =>
    s.userName.toLowerCase().includes(filter.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-orange-600/20 to-red-600/20 border border-orange-700/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total de Registos</p>
              <p className="text-3xl font-bold text-orange-400">{entries.length}</p>
            </div>
            <span className="text-4xl">📝</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border border-blue-700/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Utilizadores Ativos</p>
              <p className="text-3xl font-bold text-blue-400">{summaries.length}</p>
            </div>
            <span className="text-4xl">👥</span>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-600/20 to-emerald-600/20 border border-green-700/30 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Tempo Total</p>
              <p className="text-3xl font-bold text-green-400">
                {formatDuration(summaries.reduce((acc, s) => acc + s.totalTime, 0))}
              </p>
            </div>
            <span className="text-4xl">⏱️</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex-1 w-full md:w-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Filtrar por utilizador..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="w-full px-4 py-3 pl-10 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setView('summary')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'summary'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              📊 Resumo
            </button>
            <button
              onClick={() => setView('entries')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                view === 'entries'
                  ? 'bg-gradient-to-r from-orange-600 to-red-600'
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              📝 Registos
            </button>
          </div>
        </div>
      </div>

      {/* Summary View */}
      {view === 'summary' && (
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-gray-700/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold">👤 Utilizador</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">⏱️ Tempo Total</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">📝 Registos</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">🔄 Última Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Nenhum utilizador encontrado
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((summary, idx) => (
                    <tr key={summary.userId} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm font-bold">
                            {summary.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{summary.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-sm font-medium">
                          {formatDuration(summary.totalTime)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400">{summary.entries}</td>
                      <td className="px-6 py-4">
                        {summary.lastAction && (
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            summary.lastAction === 'start' || summary.lastAction === 'continue'
                              ? 'bg-green-600/20 border border-green-500/30 text-green-400'
                              : 'bg-red-600/20 border border-red-500/30 text-red-400'
                          }`}>
                            {summary.lastAction === 'start' && '▶️ Iniciado'}
                            {summary.lastAction === 'continue' && '▶️ Continuado'}
                            {summary.lastAction === 'stop' && '⏸️ Parado'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Entries View */}
      {view === 'entries' && (
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-gray-700/50">
                  <th className="px-6 py-4 text-left text-sm font-semibold">👤 Utilizador</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">🔄 Ação</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">📅 Data/Hora</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold">⏱️ Duração</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      Nenhum registo encontrado
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm font-bold">
                            {entry.userName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium">{entry.userName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          entry.action === 'start' || entry.action === 'continue'
                            ? 'bg-green-600/20 border border-green-500/30 text-green-400'
                            : 'bg-red-600/20 border border-red-500/30 text-red-400'
                        }`}>
                          {entry.action === 'start' && '▶️ Start'}
                          {entry.action === 'continue' && '▶️ Continue'}
                          {entry.action === 'stop' && '⏸️ Stop'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">{formatDate(entry.timestamp)}</td>
                      <td className="px-6 py-4">
                        {entry.duration ? (
                          <span className="px-3 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-sm font-medium">
                            {formatDuration(entry.duration)}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-sm">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-orange-300 mb-1">Sobre o Time Tracking</h4>
            <p className="text-xs text-gray-400">
              Os utilizadores podem usar comandos do Discord para registar entrada (<code className="px-1 py-0.5 bg-gray-800 rounded">/bater-ponto start</code>),
              pausa (<code className="px-1 py-0.5 bg-gray-800 rounded">/bater-ponto stop</code>) e
              continuação (<code className="px-1 py-0.5 bg-gray-800 rounded">/bater-ponto continue</code>).
              Os dados são guardados automaticamente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
