"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useI18n } from '../lib/i18n'

type Appeal = { id: string; userId?: string; caseId?: string; reason?: string; status?: string; createdAt?: string }

export default function AppealsManager() {
  const { t } = useI18n()
  const [guildId, setGuildId] = useState<string | null>(null)
  const [appeals, setAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [decisionReason, setDecisionReason] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [search, setSearch] = useState<string>('')
  const [showResolved, setShowResolved] = useState<boolean>(false)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const load = async (gid: string) => {
    setLoading(true); setError(null)
    try {
      const params: Record<string,string> = {}
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter
      const res = await api.getAppeals(gid, params)
      setAppeals(res?.appeals || res || [])
    } catch (e: any) { setError(e?.message || t('appeals.loadFailed')) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (guildId) { setPage(0); load(guildId) } }, [guildId, statusFilter])

  const decide = async (id: string, decision: 'approve' | 'deny') => {
    if (!guildId) return
    setLoading(true)
    try {
      // Map UI decisions to server statuses
      const status = decision === 'approve' ? 'accepted' : 'rejected'
      await api.decideAppeal(guildId, id, status, decisionReason[id])
      await load(guildId)
    } finally { setLoading(false) }
  }

  // Derived filtered list (client-side search)
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

  const skeletonCards = Array.from({ length: 4 }).map((_,i) => (
    <div key={i} className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-800 animate-pulse">
      <div className="h-3 w-32 bg-neutral-700 rounded mb-2" />
      <div className="h-3 w-48 bg-neutral-700 rounded mb-2" />
      <div className="h-8 w-full bg-neutral-700/60 rounded" />
    </div>
  ))

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{t('appeals.title')}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => guildId && load(guildId)} title={t('common.reload')}>{t('common.reload')}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-32"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            aria-label={t('appeals.filter.status')}
            title={t('appeals.filter.status')}
          >
            <option value="pending">{t('appeals.filter.pending')}</option>
            <option value="accepted">{t('appeals.filter.accepted')}</option>
            <option value="rejected">{t('appeals.filter.rejected')}</option>
            <option value="all">{t('appeals.filter.all')}</option>
          </select>
          <input
            className="input w-48"
            placeholder={t('appeals.search.placeholder')}
            aria-label={t('appeals.search.title')}
            title={t('appeals.search.title')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
          />
          <div className="flex items-center gap-2 text-xs">
            <span>{filtered.length} {t('appeals.count')}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" className="btn btn-secondary btn-xs" disabled={page===0} onClick={() => setPage(p => Math.max(0,p-1))}>&lt;</button>
                <span className="opacity-70">{page+1}/{totalPages}</span>
                <button type="button" className="btn btn-secondary btn-xs" disabled={page>=totalPages-1} onClick={() => setPage(p => Math.min(totalPages-1,p+1))}>&gt;</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <section className="card">
        <div className="card-header">{t('appeals.queue')}</div>
        <div className="card-body grid gap-3">
          {loading && <div className="grid md:grid-cols-2 gap-3">{skeletonCards}</div>}
          {!loading && paged.length === 0 && <div className="opacity-70">{t('appeals.empty')}</div>}
          {!loading && paged.map(ap => (
            <div key={ap.id} className="p-3 rounded-lg bg-neutral-800/50 border border-neutral-800">
              <div className="text-sm opacity-70">{ap.userId} • {t('appeals.case')} {ap.caseId} • {new Date(ap.createdAt || Date.now()).toLocaleString()}</div>
              <div className="mt-1">{t('appeals.reason')}: {ap.reason || t('appeals.reason.empty')}</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                <label className="flex flex-col gap-1 md:col-span-2">
                  <span className="text-sm opacity-80">{t('appeals.decision.justification')}</span>
                  <input className="input" value={decisionReason[ap.id] || ''} onChange={e => setDecisionReason(s => ({ ...s, [ap.id]: e.target.value }))} placeholder={t('appeals.decision.placeholder')} title={t('appeals.decision.title')} />
                </label>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-xs" onClick={() => decide(ap.id, 'approve')}>{t('appeals.approve')}</button>
                  <button type="button" className="btn btn-danger btn-xs" onClick={() => decide(ap.id, 'deny')}>{t('appeals.deny')}</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
