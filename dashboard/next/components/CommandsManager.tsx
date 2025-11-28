"use client"

import { useEffect, useMemo, useState } from 'react'
const logger = require('../utils/logger');
import { useGuildId } from '../lib/guild'
import { useI18n } from '../lib/i18n'
import { api } from '../lib/apiClient'

type Command = { name: string; id?: string; description?: string; type?: string }

export default function CommandsManager() {
  const { t } = useI18n()
  const guildId = useGuildId()
  const [commands, setCommands] = useState<Command[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [enabled, setEnabled] = useState(true)

  const [runName, setRunName] = useState('')
  const [runArgs, setRunArgs] = useState('')
  const [runChannelId, setRunChannelId] = useState('')
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])

  const isTextChannel = (ch: { id: string; name: string; type?: string }) => {
    const t = String(ch.type || '').toLowerCase()
    return t.includes('text') || t.includes('announcement')
  }
  const channelTypeLabel = (ch: { type?: string } | string | undefined) => {
    const t = typeof ch === 'string' ? ch : (ch?.type || '')
    switch (String(t).toLowerCase()) {
      case 'guild_text':
      case 'text': return 'Text'
      case 'guild_announcement':
      case 'announcement': return 'Announcement'
      case 'guild_voice':
      case 'voice': return 'Voice'
      case 'guild_category':
      case 'category': return 'Category'
      default: return 'Channel'
    }
  }

  const load = async (gid: string) => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.getCommands(gid)
      const list = res?.commands || res || []
      setCommands(list)
    } catch (e: any) {
      setError(e?.message || t('commands.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (guildId) {
      load(guildId);
      (async()=>{
        try {
          const ch = await api.getChannels(guildId);
          setChannels(ch.channels || ch || [])
        } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }
      })()
    }
  }, [guildId])

  const action = async (payload: Record<string, any>) => {
    if (!guildId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await api.postCommand(guildId, payload)
      setResult(JSON.stringify(res))
      await load(guildId)
    } catch (e: any) {
      setError(e?.message || t('commands.actionFailed'))
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(c => c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q))
  }, [commands, search])

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-gray-600/20 to-slate-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⌨️</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-300 to-slate-300 bg-clip-text text-transparent">
                {t('commands.title')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">Manage and execute bot commands</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-gray-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-gray-600 peer-checked:to-slate-600"></div>
          </label>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
              📦
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{commands.length}</div>
              <div className="text-sm text-gray-400">Total Commands</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-lg flex items-center justify-center text-2xl">
              🔍
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{filtered.length}</div>
              <div className="text-sm text-gray-400">Filtered Results</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
              ⚡
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{enabled ? 'Active' : 'Paused'}</div>
              <div className="text-sm text-gray-400">System Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔧</span>
          <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            onClick={() => guildId && load(guildId)}
            disabled={loading}
          >
            <span>🔄</span>
            {t('common.reload')}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            onClick={() => action({ action: 'deploy' })}
            disabled={loading || !enabled}
          >
            <span>🚀</span>
            {t('commands.redeploy')}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            onClick={() => action({ action: 'sync' })}
            disabled={loading || !enabled}
          >
            <span>🔗</span>
            {t('commands.sync')}
          </button>
          <button
            type="button"
            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all duration-200 flex items-center gap-2"
            onClick={() => action({ action: 'clear' })}
            disabled={loading || !enabled}
          >
            <span>🗑️</span>
            {t('commands.clear')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🔍</span>
          <h3 className="text-lg font-semibold text-white">{t('common.search')}</h3>
        </div>
        <input
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
          placeholder="Search commands by name or description..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Error/Result Messages */}
      {error && (
        <div className="bg-red-600/20 backdrop-blur-xl border border-red-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400">
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}
      {result && (
        <div className="bg-green-600/20 backdrop-blur-xl border border-green-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <span>✅</span>
            <span>Success</span>
          </div>
          <pre className="text-xs text-gray-300 max-h-40 overflow-auto bg-gray-900/50 p-3 rounded-lg">{result}</pre>
        </div>
      )}

      {/* Command Execution */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚡</span>
          <h3 className="text-lg font-semibold text-white">{t('commands.run.title')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('commands.form.name')}</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={runName}
              onChange={e => setRunName(e.target.value)}
              placeholder={t('commands.form.name.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('commands.form.args')}</label>
            <input
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={runArgs}
              onChange={e => setRunArgs(e.target.value)}
              placeholder={t('commands.form.args.placeholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('commands.form.channel')}</label>
            <select
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={runChannelId}
              onChange={e => setRunChannelId(e.target.value)}
            >
              <option value="">— Select Channel —</option>
              {channels.filter(isTextChannel).map(ch => (
                <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full py-3 px-6 bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-500 hover:to-slate-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => action({ action: 'run', name: runName, args: runArgs, channelId: runChannelId || undefined })}
              disabled={!runName || loading || !enabled}
            >
              {t('commands.runButton')}
            </button>
          </div>
        </div>
      </div>

      {/* Commands List */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">📋</span>
          <h3 className="text-lg font-semibold text-white">{t('commands.registered')}</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-xl bg-gray-900/50 border border-gray-700 animate-pulse h-20" />
          ))}
          {!loading && filtered.map((c) => (
            <div key={c.id || c.name} className="p-4 rounded-xl bg-gray-900/50 border border-gray-700 hover:border-gray-600 transition-all duration-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚡</span>
                <div className="font-medium text-white">/{c.name}</div>
              </div>
              <div className="text-sm text-gray-400">{c.description || t('commands.noDescription')}</div>
            </div>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">📭</div>
              <div>{t('commands.none')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
