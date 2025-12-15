'use client'

import { useEffect, useRef, useState } from 'react'
const logger = require('../utils/logger');
import Stat from './Stat'
import { api } from '@/lib/apiClient'
import { useGuildId } from '@/lib/guild'
import { useI18n } from '@/lib/i18n'

export default function DashboardStats() {
  const { t } = useI18n()
  const [stats, setStats] = useState<{ label: string; value: string; color: string }[]>([
    { label: '', value: '—', color: '#10b981' },
    { label: '', value: '—', color: '#f59e0b' },
    { label: '', value: '—', color: '#ef4444' },
    { label: '', value: '—', color: '#f97316' },
    { label: '', value: '—', color: '#6366f1' },
    { label: '', value: '—', color: '#22d3ee' },
  ])
  const [lastUpdated, setLastUpdated] = useState<string>('—')
  const [isRecent, setIsRecent] = useState<boolean>(false)
  const [lastActivity, setLastActivity] = useState<string>('—')
  const [summary, setSummary] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [refreshMinutes, setRefreshMinutes] = useState<number>(1)
  const [lastTicket, setLastTicket] = useState<string>('—')

  const formatTime = (d?: Date | null) => d ? d.toLocaleString() : '—'

  const extractLastActivity = (data: any): Date | null => {
    const cands: any[] = [
      data?.lastActivity,
      data?.lastEventAt,
      data?.lastLogAt,
      data?.latest?.timestamp,
      data?.latest?.at,
      Array.isArray(data?.recent) ? data.recent[0]?.timestamp : null,
      data?.updates?.last,
    ].filter(Boolean)
    for (const t of cands) {
      const dt = new Date(t)
      if (!isNaN(dt.getTime())) return dt
    }
    return null
  }

  const extractLastTicketAt = (data: any): Date | null => {
    const cands: any[] = [
      data?.tickets?.lastUpdated,
      data?.tickets?.last_activity,
      data?.tickets?.latest?.timestamp,
      data?.lastTicketAt,
      data?.latestTicket?.timestamp,
      Array.isArray(data?.tickets?.recent) ? data.tickets.recent[0]?.timestamp : null,
    ].filter(Boolean)
    for (const t of cands) {
      const dt = new Date(t)
      if (!isNaN(dt.getTime())) return dt
    }
    return null
  }

  const guildId = useGuildId()
  const fetchStats = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const data = await api.getLogStats(guildId)
      // Assuming API returns shape { totals: { warnings, bans, kicks, tickets, logs, activeModerators } }
      if (!data) return
      const s = [
        { label: t('dash.activeModerators'), value: String(data.totals?.activeModerators ?? '—'), color: '#10b981' },
        { label: t('dash.warnings'), value: String(data.totals?.warnings ?? '—'), color: '#f59e0b' },
        { label: t('dash.bans'), value: String(data.totals?.bans ?? '—'), color: '#ef4444' },
        { label: t('dash.kicks'), value: String(data.totals?.kicks ?? '—'), color: '#f97316' },
        { label: t('dash.tickets'), value: String(data.totals?.tickets ?? '—'), color: '#6366f1' },
        { label: t('dash.modLogs'), value: String(data.totals?.logs ?? '—'), color: '#22d3ee' },
      ]
      setStats(s)
      // Avoid using Date.now() as a fallback here (causes hydration mismatch); show placeholder instead.
      const ts = data.updatedAt ? new Date(data.updatedAt) : null
      setLastUpdated(ts ? ts.toLocaleString() : '—')
      setIsRecent(ts ? Date.now() - ts.getTime() < 90_000 : false)
  const w = data.totals?.warnings ?? 0
  const b = data.totals?.bans ?? 0
  const k = data.totals?.kicks ?? 0
  const ticketsCount = data.totals?.tickets ?? 0
  setSummary(`${t('dash.quickSummary')}: ${w} ${t('dash.warnings')}, ${b} ${t('dash.bans')}, ${k} ${t('dash.kicks')}, ${ticketsCount} ${t('dash.tickets')}.`)
      const la = extractLastActivity(data)
      setLastActivity(formatTime(la))
      const lt = extractLastTicketAt(data)
      setLastTicket(formatTime(lt))
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Parse refresh param from query (?refresh=2m, ?refresh=30s, ?refresh=0)
    try {
      const ls = typeof window !== 'undefined' ? localStorage.getItem('dash-refresh-mins') : null
      const url = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
      let initial = refreshMinutes
      const fromParam = url?.get('refresh')
      const parseDur = (val: string): number => {
        const s = val.trim().toLowerCase()
        if (s === 'off' || s === '0') return 0
        if (s.endsWith('s')) return Math.max(0, parseFloat(s.slice(0, -1)) / 60)
        if (s.endsWith('m')) return Math.max(0, parseFloat(s.slice(0, -1)))
        const n = parseFloat(s)
        return isNaN(n) ? 1 : Math.max(0, n) // default minutes
      }
      if (fromParam) initial = parseDur(fromParam)
      else if (ls) initial = Math.max(0, parseFloat(ls))
      setRefreshMinutes(initial)
    } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }

    fetchStats()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId])

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (refreshMinutes > 0) {
      intervalRef.current = setInterval(fetchStats, refreshMinutes * 60 * 1000)
    }
    try { localStorage.setItem('dash-refresh-mins', String(refreshMinutes)) } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [refreshMinutes])


  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-neutral-200">{t('dash.statusSummary')}</h3>
            <p className="text-xs text-neutral-400 mt-1">{summary}</p>
            <p className="text-xs text-neutral-400 mt-1">{t('dash.lastActivity')}: {lastActivity === '—' ? '—' : (
              <time suppressHydrationWarning dateTime={(() => { try { return new Date(lastActivity).toISOString() } catch { return '' } })()}>{lastActivity}</time>
            )}</p>
            <p className="text-xs text-neutral-400 mt-1">{t('dash.lastTicket')}: {lastTicket === '—' ? '—' : (
              <time suppressHydrationWarning dateTime={(() => { try { return new Date(lastTicket).toISOString() } catch { return '' } })()}>{lastTicket}</time>
            )}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-neutral-400 flex items-center gap-2">
              {loading && (
                <span className="inline-block h-3 w-3 rounded-full border-2 border-neutral-500 border-t-transparent animate-spin" aria-label={t('dash.updating')} />
              )}
              <span suppressHydrationWarning>{loading ? `${t('dash.updating')}…` : `${t('dash.updated')}: ${lastUpdated}`}</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-400 hidden sm:flex items-center gap-1" title={t('dash.refreshFrequency')}>
                <span className="text-base">⏰</span>
                <select
                  className="text-xs rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1"
                  value={refreshMinutes}
                  onChange={(e) => setRefreshMinutes(parseFloat(e.target.value))}
                  aria-label={t('dash.refreshFrequency')}
                >
                  <option value={0}>{t('dash.off')}</option>
                  <option value={0.1667}>10s</option>
                  <option value={0.5}>30s</option>
                  <option value={1}>1m</option>
                  <option value={2}>2m</option>
                  <option value={5}>5m</option>
                </select>
              </label>
              <button
                type="button"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs"
                onClick={() => fetchStats()}
                disabled={loading}
                title={t('dash.updateNow')}
              >
                <span className="text-base">🔄</span>
                {t('dash.updateNow')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {stats && Array.isArray(stats) && stats.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} dotColor={s.color} subtle={isRecent ? t('dash.recent') : undefined} />
        ))}
      </div>
    </div>
  )
}
