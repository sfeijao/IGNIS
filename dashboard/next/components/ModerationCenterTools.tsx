"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

export default function ModerationCenterTools() {
  const guildId = useGuildId()
  const { toast } = useToast()
  const { t } = useI18n()
  const [userIdsRaw, setUserIdsRaw] = useState('')
  const [action, setAction] = useState<'timeout'|'kick'|'ban'>('timeout')
  const [duration, setDuration] = useState(600)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Array<{ userId: string; ok: boolean; error?: string }>>([])
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])
  const [contextChannelId, setContextChannelId] = useState<string>('')
  const [enabled, setEnabled] = useState(true)

  const isTextChannel = (ch: { id: string; name: string; type?: string } | null | undefined) => {
    if (!ch) return false
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

  useEffect(() => {
    if (!guildId) return
    ;(async () => {
      try {
        const response = await api.getChannels(guildId)
        const list = response.channels || response || []
        setChannels(Array.isArray(list) ? list : [])
      } catch (err) {
        setChannels([])
      }
    })()
  }, [guildId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('moderationContextChannelId')
    if (saved) setContextChannelId(saved)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (contextChannelId) localStorage.setItem('moderationContextChannelId', contextChannelId)
    else localStorage.removeItem('moderationContextChannelId')
  }, [contextChannelId])

  const parseUserIds = () => Array.from(new Set(userIdsRaw.split(/[\,\n\s]+/).map(s => s.trim()).filter(Boolean)))

  const run = async () => {
    if (!guildId) return toast({ type: 'error', title: 'Guild missing' })
    const ids = parseUserIds()
    if (ids.length === 0) return toast({ type: 'error', title: t('mod.bulk.noUsers') })

    setBusy(true)
    setResults([])
    const r: Array<{ userId: string; ok: boolean; error?: string }> = []
    try {
      for (const userId of ids) {
        try {
          if (action === 'timeout') {
            await api.timeoutMember(guildId, userId, Number(duration) || 0, reason || undefined)
          } else if (action === 'kick') {
            await api.kickMember(guildId, userId, reason || undefined)
          } else if (action === 'ban') {
            await api.banMember(guildId, userId, { reason: reason || undefined, deleteMessageSeconds: Number(duration) || 0 })
          }
          r.push({ userId, ok: true })
        } catch (e: any) {
          r.push({ userId, ok: false, error: (e instanceof Error ? e.message : String(e)) || 'error' })
        }
      }
      setResults(r)
      const ok = r.filter(x => x.ok).length
      const fail = r.length - ok
      toast({ type: fail ? 'info' : 'success', title: t('mod.bulk.done'), description: `${ok}/${r.length}` })
    } finally {
      setBusy(false)
    }
  }

  const successCount = results.filter(r => r.ok).length
  const failCount = results.length - successCount
  const userCount = parseUserIds().length

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🛡️</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                {t('nav.moderation')}
              </h2>
              <p className="text-gray-400 text-sm mt-1">{t('mod.bulk.title')}</p>
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
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600/20 to-cyan-600/20 rounded-lg flex items-center justify-center text-2xl">
              👥
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{userCount}</div>
              <div className="text-sm text-gray-400">Users Queued</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-600/20 to-emerald-600/20 rounded-lg flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <div className="text-2xl font-bold text-green-400">{successCount}</div>
              <div className="text-sm text-gray-400">Successful</div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-600/20 to-rose-600/20 rounded-lg flex items-center justify-center text-2xl">
              ❌
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{failCount}</div>
              <div className="text-sm text-gray-400">Failed</div>
            </div>
          </div>
        </div>
      </div>

      {/* Context Channel */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📺</span>
          <h3 className="text-lg font-semibold text-white">{t('mod.context.channel')}</h3>
        </div>
        <select
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
          value={contextChannelId}
          onChange={e => setContextChannelId(e.target.value)}
        >
          <option value="">— Select Channel —</option>
          {Array.isArray(channels) && channels.filter(isTextChannel).map((ch) => (
            <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
          ))}
        </select>
        <p className="text-sm text-gray-400 mt-2">💡 {t('mod.context.hint')}</p>
      </div>

      {/* Bulk Actions Form */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚡</span>
          <h3 className="text-lg font-semibold text-white">Bulk Moderation</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User IDs Input */}
          <div className="lg:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-300">{t('mod.bulk.userIds')}</label>
            <textarea
              className="w-full min-h-[140px] bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-none"
              placeholder="123456789, 987654321, ..."
              value={userIdsRaw}
              onChange={e => setUserIdsRaw(e.target.value)}
            />
            <p className="text-xs text-gray-400">💡 {t('mod.bulk.hint')}</p>
          </div>

          {/* Action Settings */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">{t('mod.bulk.action')}</label>
              <select
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                value={action}
                onChange={e => setAction(e.target.value as any)}
              >
                <option value="timeout">⏱️ {t('mod.action.timeout')}</option>
                <option value="kick">👢 {t('mod.action.kick')}</option>
                <option value="ban">🔨 {t('mod.action.ban')}</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">
                {action === 'timeout' ? t('mod.bulk.durationSeconds') : action === 'ban' ? t('mod.bulk.deleteMsgSeconds') : t('mod.bulk.durationSeconds')}
              </label>
              <input
                type="number"
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                value={duration}
                onChange={e => setDuration(parseInt(e.target.value, 10) || 0)}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">{t('mod.reason')}</label>
              <input
                className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                placeholder={t('mod.reason.placeholder')}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 mt-6">
          <button
            type="button"
            className="flex-1 py-3 px-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            onClick={run}
            disabled={busy || !enabled}
          >
            {busy ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('common.working')}
              </>
            ) : (
              <>
                <span>⚡</span>
                {t('mod.bulk.run')}
              </>
            )}
          </button>
          <button
            type="button"
            className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => { setUserIdsRaw(''); setResults([]) }}
            disabled={busy}
          >
            🗑️ {t('common.clear')}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📊</span>
            <h3 className="text-lg font-semibold text-white">{t('mod.bulk.results')}</h3>
          </div>
          <div className="max-h-64 overflow-auto bg-gray-900/50 border border-gray-700 rounded-xl">
            {results.map((r, i) => (
              <div
                key={i}
                className={`px-4 py-3 border-b border-gray-800 last:border-0 flex items-center justify-between ${
                  r.ok ? 'text-green-400' : 'text-red-400'
                }`}
              >
                <span className="font-mono text-sm">{r.userId}</span>
                <span className="text-xs">{r.ok ? '✅ Success' : `❌ ${r.error || 'Error'}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
