"use client"

import { useEffect, useMemo, useState } from 'react'
import { useGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

export default function VerificationMetrics() {
  const guildId = useGuildId()
  const [metrics, setMetrics] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { t } = useI18n()

  // guildId resolved post-mount by useGuildId

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const [m, l] = await Promise.all([
        api.getVerificationMetrics(gid),
        api.getVerificationLogs(gid, { limit: 100 })
      ])
      setMetrics(m?.metrics || m)
      setLogs(l?.logs || l || [])
    } catch (e: any) { setError((e instanceof Error ? e.message : String(e)) || t('verification.metrics.error')) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) load(guildId) }, [guildId])

  const purge = async () => {
    if (!guildId) return
    setLoading(true)
    try { await api.purgeVerificationLogs(guildId); toast({ type: 'success', title: t('verification.metrics.clearLogs') }); await load(guildId) } catch (e:any) { toast({ type:'error', title: t('verification.metrics.error'), description: (e instanceof Error ? e.message : String(e)) }) } finally { setLoading(false) }
  }

  const [logSearch, setLogSearch] = useState('')
  const filteredLogs = useMemo(() => {
    const q = logSearch.trim().toLowerCase()
    if (!q) return logs
    return logs && Array.isArray(logs) ? logs.filter((l:any) => (l.message ? String(l.message).toLowerCase() : JSON.stringify(l).toLowerCase()).includes(q)) : []
  }, [logs, logSearch])

  // Simple derived success rate & failure trend (if metrics provide counts)
  const successRate = useMemo(() => {
    if (!metrics) return null
    const success = metrics.successCount || metrics.verified || metrics.verificationsPassed || 0
    const failed = metrics.failCount || metrics.failed || metrics.verificationsFailed || 0
    const total = success + failed
    if (!total) return null
    return (success / total)
  }, [metrics])
  const totalAttempts = useMemo(() => {
    if (!metrics) return 0
    const success = metrics.successCount || metrics.verified || metrics.verificationsPassed || 0
    const failed = metrics.failCount || metrics.failed || metrics.verificationsFailed || 0
    return success + failed
  }, [metrics])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('verification.metrics.title')}</h2>
  <button type="button" className="btn btn-secondary" onClick={() => guildId && load(guildId)} title={t('verification.metrics.reload')}>{t('verification.metrics.reload')}</button>
  <button type="button" className="btn btn-danger" onClick={purge} title={t('verification.metrics.clearLogs')}>{t('verification.metrics.clearLogs')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">{t('verification.metrics.section')}</div>
        <div className="card-body grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading && (
            <>
              {Array.from({ length: 4 }).map((_,i) => (
                <div key={i} className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-800 animate-pulse">
                  <div className="h-3 w-20 bg-neutral-700 rounded mb-2" />
                  <div className="h-6 w-14 bg-neutral-700/70 rounded" />
                </div>
              ))}
            </>
          )}
          {!loading && metrics ? Object.entries(metrics).map(([k,v]) => (
            <div key={k} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-xs opacity-70">{k}</div>
              <div className="text-xl font-semibold">{String(v)}</div>
            </div>
          )) : (!loading && <div className="opacity-70">{t('verification.metrics.noData')}</div>)}
        </div>
        {successRate !== null && (
          <div className="mt-4 space-y-2">
            <div className="text-sm font-medium">{t('verification.metrics.successRate')} ({Math.round(successRate*100)}%)</div>
            <div className="h-3 w-full bg-neutral-800 rounded overflow-hidden">
              <div className="h-full bg-green-500/70" style={{ width: `${successRate*100}%` }} />
            </div>
            <div className="text-xs opacity-70">{t('verification.metrics.totalAttempts')}: {totalAttempts}</div>
          </div>
        )}
      </section>
      <section className="card">
        <div className="card-header flex items-center justify-between gap-2">
          <span>{t('verification.metrics.recentLogs')}</span>
          <input className="input w-48" placeholder={t('common.search')} aria-label={t('common.search')} value={logSearch} onChange={e=>setLogSearch(e.target.value)} />
        </div>
        <div className="card-body text-xs max-h-[360px] overflow-auto" role="status" aria-live="polite" aria-busy={loading}>
          {loading && <div className="opacity-70">{t('common.loading')}</div>}
          {!loading && filteredLogs.length === 0 && <div className="opacity-70">{t('verification.metrics.noLogs')}</div>}
          {!loading && filteredLogs && Array.isArray(filteredLogs) && filteredLogs.map((l:any, idx:number) => (
            <div key={idx} className="border-b border-neutral-900/60 py-1">
              <span className="opacity-60">
                {l.timestamp ? (
                  <time suppressHydrationWarning dateTime={new Date(l.timestamp).toISOString()}>{new Date(l.timestamp).toLocaleString()}</time>
                ) : '—'} •
              </span>
              <span>{l.message || JSON.stringify(l)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
