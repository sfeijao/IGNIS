const logger = require('../utils/logger');
"use client"

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/apiClient'
import { useGuildId } from '@/lib/guild'
import MemberModal from './MemberModal'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

export default function MembersList() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('all') // all, online, offline
  const [sortBy, setSortBy] = useState('recent') // recent, oldest, name
  const [limit, setLimit] = useState(50)
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [members, setMembers] = useState<Array<any>>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [enabled, setEnabled] = useState(true)
  const { toast } = useToast()

  const params = useMemo(() => ({ q, role, limit }), [q, role, limit])

  useEffect(() => {
    if (!guildId) return
    ;(async () => { try { const res = await api.getRoles(guildId); setRoles(res.roles || []) } catch (e) { logger.debug('Caught error:', e?.message || e); } })()
  }, [guildId])

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    const run = async () => {
      setLoading(true)
      try {
        const res = await api.getMembers(guildId, params)
        if (!aborted) setMembers(res.members || res)
      } catch { if (!aborted) setMembers([]) }
      finally { if (!aborted) setLoading(false) }
    }
    run()
    return () => { aborted = true }
  }, [guildId, params])

  const filteredMembers = useMemo(() => {
    let filtered = [...members]

    // Filter by status (online/offline) if we have presence data
    if (status !== 'all') {
      filtered = filtered.filter(m => {
        // This would require presence data from backend
        // For now, we'll keep all members as this requires Discord PRESENCE intent
        return true
      })
    }

    // Sort members
    if (sortBy === 'name') {
      filtered.sort((a, b) => (a.username || '').localeCompare(b.username || ''))
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0))
    }

    return filtered
  }, [members, status, sortBy])

  const totalMembers = filteredMembers.length
  const manageable = filteredMembers.filter(m => m.manageable).length
  const hasRoleFilter = !!role

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">👥</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                {t('nav.members')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">View and manage server members</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-cyan-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-cyan-600 peer-checked:to-blue-600"></div>
          </label>
        </div>
      </div>

      {!guildId && (
        <div className="bg-yellow-600/20 backdrop-blur-xl border border-yellow-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-400">
            <span>⚠️</span>
            <span>{t('members.selectGuild')}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-600/20 to-blue-600/20 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalMembers}</div>
              <div className="text-sm text-gray-400">Total Members</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{manageable}</div>
              <div className="text-sm text-gray-400">Manageable</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center text-2xl">
              🔍
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{hasRoleFilter ? '🎯' : '—'}</div>
              <div className="text-sm text-gray-400">Filter Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🔍</span>
          <h3 className="text-lg font-semibold text-white">{t('members.search')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-300">Search by Name</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              placeholder="Nome ou apelido"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('members.role')}</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option value="">Todos</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Status</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">🌐 All</option>
              <option value="online">🟢 Online</option>
              <option value="offline">⚫ Offline</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Sort By</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="recent">📅 Most Recent</option>
              <option value="oldest">⏰ Oldest</option>
              <option value="name">🔤 Name (A-Z)</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('members.limit')}</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
              value={limit}
              onChange={e => setLimit(parseInt(e.target.value, 10))}
            >
              {[25, 50, 100, 150, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h3 className="text-lg font-semibold text-white">Member List</h3>
        </div>
        <div className="space-y-3">
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-12 h-12 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">{t('logs.loading')}</div>
            </div>
          )}
          {!loading && filteredMembers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👻</div>
              <div className="text-gray-400">No members found</div>
            </div>
          )}
          {!loading && filteredMembers.map((m: any) => (
            <div key={m.id} className="bg-gray-900/50 border border-gray-700 hover:border-cyan-600/50 rounded-xl p-4 transition-all duration-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-gray-700 flex items-center justify-center text-xl font-semibold text-cyan-400">
                  {String(m.username || 'U')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">
                    {m.nick ? (
                      <>
                        {m.nick} <span className="text-gray-400 text-sm">({m.username}#{m.discriminator})</span>
                      </>
                    ) : (
                      `${m.username}#${m.discriminator}`
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{m.id}</div>
                </div>
                {!m.manageable ? (
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span>🔒</span>
                    <span>{t('members.notManageable')}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setSelected(m)}
                    disabled={!enabled}
                  >
                    {t('members.manage')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && guildId && (
        <MemberModal
          guildId={guildId}
          member={selected}
          onClose={() => setSelected(null)}
          onChanged={() => {
            toast({ type: 'success', title: 'Alterações guardadas' })
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}
