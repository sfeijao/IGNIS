"use client"

import { useEffect, useMemo, useState } from 'react'
import { useGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '../lib/i18n'

type Appeal = { id: string; userId?: string; caseId?: string; reason?: string; status?: string; createdAt?: string }

export default function AppealsManager() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [search, setSearch] = useState<string>('')
  const [enabled, setEnabled] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 20

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const params: Record<string,string> = {}
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const res = await api.getAppeals(gid, params)
      setAppeals(res?.appeals || res || [])
    } catch (e: any) { setError((e instanceof Error ? e.message : String(e)) || t('appeals.loadFailed')) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) { setPage(0); load(guildId) } }, [guildId, statusFilter])

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    if (!guildId) return
    setLoading(true)
    try {
      const status = decision === 'approve' ? 'accepted' : 'rejected'
      await api.decideAppeal(guildId, id, status, decisionReason[id])
      await load(guildId)
    } finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    const base = appeals
    const bySearch = search.trim() ? base.filter(a => {
      const hay = [a.userId, a.caseId, a.reason, a.status].map(x => (x||'').toLowerCase()).join(' ')
      return hay.includes(search.trim().toLowerCase())
    }) : base
    return bySearch
  }, [appeals, search])

  const paged = useMemo(() => filtered.slice(page * pageSize, (page * pageSize) + pageSize), [filtered, page])
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))

  const totalAppeals = appeals.length
  const pendingAppeals = appeals.filter(a => a.status === 'pending').length
  const acceptedAppeals = appeals.filter(a => a.status === 'accepted').length

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-indigo-600/20 to-blue-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📝</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-blue-400 bg-clip-text text-transparent">
                {t('appeals.title')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Review ban appeal submissions</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-indigo-600 peer-checked:to-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600/20 to-blue-600/20 rounded-lg flex items-center justify-center text-2xl">
              📊
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalAppeals}</div>
              <div className="text-sm text-gray-400">Total Appeals</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-600/20 to-amber-600/20 rounded-lg flex items-center justify-center text-2xl">
              ⏳
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-400">{pendingAppeals}</div>
              <div className="text-sm text-gray-400">Pending</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{acceptedAppeals}</div>
              <div className="text-sm text-gray-400">Accepted</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔍</span>
          <h3 className="text-lg font-semibold text-white">Search & Filter</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('appeals.filter.status')}</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="pending">{t('appeals.filter.pending')}</option>
              <option value="accepted">{t('appeals.filter.accepted')}</option>
              <option value="rejected">{t('appeals.filter.rejected')}</option>
              <option value="all">{t('appeals.filter.all')}</option>
            </select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('appeals.search.title')}</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder={t('appeals.search.placeholder')}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-all disabled:opacity-50"
              disabled={page === 0 || !enabled}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              ◀
            </button>
            <span className="text-gray-400 min-w-[80px] text-center flex items-center justify-center">{page + 1}/{totalPages}</span>
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
              className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all"
              onClick={() => guildId && load(guildId)}
            >
              🔄
            </button>
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-400">
          {filtered.length} {t('appeals.count')}
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

      {/* Appeals Queue */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h3 className="text-lg font-semibold text-white">{t('appeals.queue')}</h3>
        </div>

        <div className="space-y-4">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">Loading appeals...</div>
            </div>
          )}

          {!loading && paged.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <div className="text-gray-400">{t('appeals.empty')}</div>
            </div>
          )}

          {!loading && paged.map(ap => (
            <div key={ap.id} className="bg-gray-900/50 border border-gray-700 hover:border-indigo-600/50 rounded-xl p-5 transition-all duration-200">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="font-mono bg-gray-800 px-2 py-1 rounded">{ap.userId}</span>
                  <span>•</span>
                  <span>{t('appeals.case')} <span className="font-mono">{ap.caseId}</span></span>
                  <span>•</span>
                  {ap.createdAt ? (
                    <time suppressHydrationWarning dateTime={new Date(ap.createdAt).toISOString()}>
                      {new Date(ap.createdAt).toLocaleString()}
                    </time>
                  ) : '—'}
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-300 mb-1">{t('appeals.reason')}:</div>
                  <div className="text-white bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                    {ap.reason || t('appeals.reason.empty')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium text-gray-300">{t('appeals.decision.justification')}</label>
                    <input
                      className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      value={decisionReason[ap.id] || ''}
                      onChange={e => setDecisionReason(s => ({ ...s, [ap.id]: e.target.value }))}
                      placeholder={t('appeals.decision.placeholder')}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => decide(ap.id, 'approve')}
                      disabled={!enabled}
                    >
                      ✓ {t('appeals.approve')}
                    </button>
                    <button
                      type="button"
                      className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => decide(ap.id, 'deny')}
                      disabled={!enabled}
                    >
                      ✗ {t('appeals.deny')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
