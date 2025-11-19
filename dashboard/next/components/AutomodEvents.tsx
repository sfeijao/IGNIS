"use client"

import { useEffect, useMemo, useState } from 'react'
import { useGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '../lib/i18n'

type Event = { id: string; type?: string; userId?: string; content?: string; status?: string; createdAt?: string }

export default function AutomodEvents() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [enabled, setEnabled] = useState(true)
  const pageSize = 20

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const res = await api.getAutomodEvents(gid, { resolved: false })
      setEvents(res?.events || res || [])
    } catch (e: any) { setError(e?.message || t('automod.loadFailed')) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) { setPage(0); load(guildId) } }, [guildId])

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    if (!guildId) return
    setLoading(true)
    try {
      const action = decision === 'approve' ? 'confirm' : 'release'
      await api.reviewAutomodEvent(guildId, id, action)
      await load(guildId)
    } finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const base = events
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(ev => [ev.type, ev.userId, ev.content].map(x => (x||'').toLowerCase()).join(' ').includes(q))
  }, [events, search])
  
  const paged = useMemo(() => filtered.slice(page*pageSize, (page*pageSize)+pageSize), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const totalEvents = events.length
  const pendingEvents = filtered.length

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🤖</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                {t('automod.title')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Review and manage automod events</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600/20 to-orange-600/20 rounded-lg flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalEvents}</div>
              <div className="text-sm text-gray-400">Total Events</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-600/20 to-amber-600/20 rounded-lg flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{pendingEvents}</div>
              <div className="text-sm text-gray-400">Pending Review</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
              📄
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400">{page + 1}/{totalPages}</div>
              <div className="text-sm text-gray-400">Current Page</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Pagination */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔍</span>
          <h3 className="text-lg font-semibold text-white">Search & Filter</h3>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <input
            className="flex-1 bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
            placeholder={t('common.search')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all disabled:opacity-50"
              disabled={page === 0 || !enabled}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ◀
            </button>
            <span className="text-gray-400 min-w-[80px] text-center">{page + 1} / {totalPages}</span>
            <button
              type="button"
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all disabled:opacity-50"
              disabled={page >= totalPages - 1 || !enabled}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              ▶
            </button>
            <button
              type="button"
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all ml-2"
              onClick={() => guildId && load(guildId)}
            >
              🔄 {t('common.reload')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-600/20 backdrop-blur-xl border border-red-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400">
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Events Queue */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h3 className="text-lg font-semibold text-white">{t('automod.queue')}</h3>
        </div>
        
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">Loading events...</div>
            </div>
          )}
          
          {!loading && paged.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✅</div>
              <div className="text-gray-400">{t('automod.empty')}</div>
            </div>
          )}
          
          {!loading && paged.map(ev => (
            <div key={ev.id} className="bg-gray-900/50 border border-gray-700 hover:border-red-600/50 rounded-xl p-4 transition-all duration-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                    <span className="px-2 py-1 bg-red-600/20 text-red-400 rounded-lg font-medium">{ev.type}</span>
                    <span>•</span>
                    <span className="font-mono">{ev.userId}</span>
                    <span>•</span>
                    {ev.createdAt ? (
                      <time suppressHydrationWarning dateTime={new Date(ev.createdAt).toISOString()}>
                        {new Date(ev.createdAt).toLocaleString()}
                      </time>
                    ) : '—'}
                  </div>
                  <div className="text-white break-words">{ev.content || t('automod.content.empty')}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => decide(ev.id, 'approve')}
                    disabled={!enabled}
                  >
                    ✓ {t('automod.approve')}
                  </button>
                  <button
                    type="button"
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => decide(ev.id, 'reject')}
                    disabled={!enabled}
                  >
                    ✗ {t('automod.reject')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
