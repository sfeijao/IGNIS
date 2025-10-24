"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'
import TicketModal from '@/components/TicketModal'

interface TicketItem {
  id: string
  status: string
  priority?: string
  user_id: string
  assigned_to?: string | null
  channel_id: string
  category?: string
  subject?: string
  created_at: string
  // enriched fields from server
  channelExists?: boolean
  channelName?: string
  ownerTag?: string
  ownerAvatar?: string | null
  claimedByTag?: string | null
  claimedByAvatar?: string | null
  timeAgo?: string
}

interface TicketsResponse {
  success: boolean
  tickets: TicketItem[]
  stats: { total: number; open: number; claimed: number; closed: number; pending: number }
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

const statuses = ['', 'open', 'claimed', 'closed', 'pending']
const priorities = ['', 'low', 'normal', 'high', 'urgent']

export default function TicketsList() {
  const guildId = getGuildId()
  const [status, setStatus] = useState<string>('')
  const [priority, setPriority] = useState<string>('')
  const [q, setQ] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TicketsResponse | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [viewId, setViewId] = useState<string | null>(null)
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])
  const [staffRole, setStaffRole] = useState<string>('')
  const [assignees, setAssignees] = useState<Array<{ id: string; username: string; discriminator: string; nick?: string | null }>>([])
  const [assignee, setAssignee] = useState<string>('')
  const [staffOnly, setStaffOnly] = useState<boolean>(false)
  const [deepRoleFetch, setDeepRoleFetch] = useState<boolean>(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const roleName = useMemo(() => {
    const r = roles.find(rr => rr.id === staffRole)
    return r ? r.name : ''
  }, [roles, staffRole])

  const params = useMemo(() => ({ status, priority, q, page, pageSize, staffOnly, role: staffOnly ? staffRole : '', deepRoleFetch }), [status, priority, q, page, pageSize, staffOnly, staffRole, deepRoleFetch])

  // Initialize state from URL on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const usp = new URLSearchParams(window.location.search)
    const uStatus = usp.get('status') || ''
    const uPriority = usp.get('priority') || ''
    const uQ = usp.get('q') || ''
    const uPage = parseInt(usp.get('page') || '1', 10)
    const uPageSize = parseInt(usp.get('pageSize') || '20', 10)
    const uStaffOnly = (usp.get('staffOnly') || '').toLowerCase() === 'true'
    const uRole = usp.get('role') || ''
    const uDeep = (usp.get('deepRoleFetch') || '').toLowerCase() === 'true'
    if (uStatus) setStatus(uStatus)
    if (uPriority) setPriority(uPriority)
    if (uQ) setQ(uQ)
    if (!Number.isNaN(uPage) && uPage > 0) setPage(uPage)
    if (!Number.isNaN(uPageSize) && [10,20,50,100].includes(uPageSize)) setPageSize(uPageSize)
    setStaffOnly(uStaffOnly)
    if (uRole) setStaffRole(uRole)
    setDeepRoleFetch(uDeep)
    // current user
    ;(async () => { try { const me = await api.getCurrentUser(); setCurrentUserId(me?.user?.id || null) } catch {} })()
  }, [])

  // Persist state to URL for shareable views
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    status ? url.searchParams.set('status', status) : url.searchParams.delete('status')
    priority ? url.searchParams.set('priority', priority) : url.searchParams.delete('priority')
    q ? url.searchParams.set('q', q) : url.searchParams.delete('q')
    url.searchParams.set('page', String(page))
    url.searchParams.set('pageSize', String(pageSize))
    staffOnly ? url.searchParams.set('staffOnly', 'true') : url.searchParams.delete('staffOnly')
    staffOnly && staffRole ? url.searchParams.set('role', staffRole) : url.searchParams.delete('role')
    deepRoleFetch ? url.searchParams.set('deepRoleFetch', 'true') : url.searchParams.delete('deepRoleFetch')
    window.history.replaceState({}, '', url.toString())
  }, [status, priority, q, page, pageSize, staffOnly, staffRole, deepRoleFetch])

  // Load staff roles for assignment dropdown
  useEffect(() => {
    if (!guildId) return
    let aborted = false
    ;(async () => {
      try {
        const res = await api.getRoles(guildId)
        if (!aborted) setRoles((res.roles || []).map((r: any) => ({ id: String(r.id), name: String(r.name) })))
      } catch {}
    })()
    return () => { aborted = true }
  }, [guildId])

  // Load members for selected role
  useEffect(() => {
    if (!guildId || !staffRole) { setAssignees([]); setAssignee(''); return }
    let aborted = false
    ;(async () => {
      try {
        const res = await api.getMembers(guildId, { role: staffRole, limit: 200 })
        if (!aborted) setAssignees((res || []).map((m: any) => ({ id: String(m.id), username: String(m.username), discriminator: String(m.discriminator), nick: m.nick || null })))
      } catch { if (!aborted) setAssignees([]) }
    })()
    return () => { aborted = true }
  }, [guildId, staffRole])
  
  // Load tickets whenever filters/pagination change
  useEffect(() => {
    if (!guildId) return
    let aborted = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await api.getTickets(guildId, params)
        if (!aborted) setData(res)
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Failed to load tickets')
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    run()
    return () => { aborted = true }
  }, [guildId, params])

  const onExport = () => {
    if (!guildId) return
    const url = api.exportTicketsUrl(guildId, params)
    window.open(url, '_blank')
  }

  const doAction = async (ticketId: string, action: string) => {
    if (!guildId) return
    try {
      await api.ticketAction(guildId, ticketId, action)
      // refresh current page
      const res = await api.getTickets(guildId, params)
      setData(res)
    } catch (e: any) {
      alert(e?.message || 'Failed to perform action')
    }
  }

  const toggleAll = (checked: boolean) => {
    const map: Record<string, boolean> = {}
    for (const t of data?.tickets || []) map[t.id] = checked
    setSelected(map)
  }

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected])

  const bulkClose = async () => {
    if (!guildId || selectedIds.length === 0) return
    const confirmClose = confirm(`Close ${selectedIds.length} tickets?`)
    if (!confirmClose) return
    for (const id of selectedIds) {
      try { await api.ticketAction(guildId, id, 'close') } catch {}
    }
    const res = await api.getTickets(guildId, params)
    setData(res)
    setSelected({})
  }

  const bulkAssign = async () => {
    if (!guildId || selectedIds.length === 0) return
    const userId = assignee || ''
    if (!userId) { alert('Select a staff role and assignee.'); return }
    for (const id of selectedIds) {
      try { await api.ticketAction(guildId, id, 'assign', { userId }) } catch {}
    }
    const res = await api.getTickets(guildId, params)
    setData(res)
    setSelected({})
  }

  const bulkNote = async () => {
    if (!guildId || selectedIds.length === 0) return
    const content = prompt('Add note to selected tickets:')
    if (!content) return
    for (const id of selectedIds) {
      try { await api.ticketAction(guildId, id, 'addNote', { content }) } catch {}
    }
    const res = await api.getTickets(guildId, params)
    setData(res)
    setSelected({})
  }

  return (
    <div className="space-y-4">
      {!guildId && (
        <div className="card p-4 text-sm text-neutral-400">
          Selecione um servidor: adicione <span className="text-neutral-200">?guildId=SEU_GUILD_ID</span> à URL ou salve via localStorage.
        </div>
      )}
  <div className="card p-4 grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
        <div>
          <label className="text-xs text-neutral-400">Status</label>
    <select className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" aria-label="Filter by status" title="Filter by status"
                    value={status} onChange={(e: ChangeEvent<HTMLSelectElement>)=>{ setPage(1); setStatus(e.target.value) }}>
            {statuses.map(s => <option key={s} value={s}>{s || 'Any'}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-neutral-400">Priority</label>
    <select className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1" aria-label="Filter by priority" title="Filter by priority"
                    value={priority} onChange={(e: ChangeEvent<HTMLSelectElement>)=>{ setPage(1); setPriority(e.target.value) }}>
            {priorities.map(p => <option key={p} value={p}>{p || 'Any'}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-neutral-400">Search</label>
          <input className="mt-1 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
                 placeholder="ID, subject, user, channel..."
                 value={q} onChange={e=>{ setPage(1); setQ(e.target.value) }} />
        </div>
        <div className="flex gap-2 md:col-span-3">
          <button onClick={onExport} className="mt-5 bg-neutral-800 hover:bg-neutral-700 text-sm px-3 py-2 rounded border border-neutral-700">Export</button>
          <div className="ml-auto flex items-end gap-2">
            <div>
              <label className="text-xs text-neutral-400">Staff role</label>
              <select className="mt-1 w-40 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" aria-label="Staff role" title="Staff role" value={staffRole} onChange={(e: ChangeEvent<HTMLSelectElement>)=>{ setStaffRole(e.target.value); setAssignee('') }}>
                <option value="">Select role</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-400">Assignee</label>
              <select className="mt-1 w-48 bg-neutral-900 border border-neutral-700 rounded px-2 py-1" aria-label="Assignee" title="Assignee" value={assignee} onChange={(e: ChangeEvent<HTMLSelectElement>)=> setAssignee(e.target.value)}>
                <option value="">Select member</option>
                {assignees.map(m => <option key={m.id} value={m.id}>{m.nick ? `${m.nick} (${m.username}#${m.discriminator})` : `${m.username}#${m.discriminator}`}</option>)}
              </select>
            </div>
            <div className="mt-5 flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input type="checkbox" checked={staffOnly} onChange={e=>{ setStaffOnly(e.target.checked); setPage(1) }} /> Staff only
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-300">
                <input type="checkbox" checked={deepRoleFetch} onChange={e=> setDeepRoleFetch(e.target.checked)} /> Deep fetch
              </label>
            </div>
          </div>
        </div>
      </div>

      {(staffOnly || (!!staffRole) || deepRoleFetch || !!status || !!priority || !!q) && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-400 mr-1">Filters applied:</span>
          {!!status && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Status: {status}</span>
          )}
          {!!priority && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Priority: {priority}</span>
          )}
          {!!q && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Search: “{q}”</span>
          )}
          {staffOnly && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Staff only</span>
          )}
          {!!staffRole && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Role: {roleName || staffRole}</span>
          )}
          {deepRoleFetch && (
            <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-200">Deep fetch</span>
          )}
          <button
            type="button"
            className="ml-1 underline text-neutral-400 hover:text-neutral-200"
            onClick={() => { setStatus(''); setPriority(''); setQ(''); setStaffOnly(false); setStaffRole(''); setDeepRoleFetch(false); setPage(1) }}
            aria-label="Clear filters"
            title="Clear filters"
          >Clear</button>
        </div>
      )}

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatBox label="Total" value={data.stats.total} colorClass="bg-neutral-400" />
          <StatBox label="Open" value={data.stats.open} colorClass="bg-emerald-500" />
          <StatBox label="Claimed" value={data.stats.claimed} colorClass="bg-amber-500" />
          <StatBox label="Closed" value={data.stats.closed} colorClass="bg-rose-500" />
          <StatBox label="Pending" value={data.stats.pending} colorClass="bg-blue-500" />
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-neutral-800">
          {loading && <div className="p-6 text-neutral-400">Loading…</div>}
          {error && <div className="p-6 text-red-400">{error}</div>}
          {!loading && !error && data?.tickets?.length === 0 && (
            <div className="p-6 text-neutral-400">No tickets found.</div>
          )}
          {data?.tickets?.map(t => (
            <div key={t.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" aria-label={`Select ticket ${t.id}`} checked={!!selected[t.id]} onChange={e => setSelected(prev => ({ ...prev, [t.id]: e.target.checked }))} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-neutral-300 font-mono">#{t.id}</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-neutral-800 border border-neutral-700">{t.status}</span>
                  {t.priority && <span className="px-2 py-0.5 text-xs rounded bg-neutral-800 border border-neutral-700">{t.priority}</span>}
                  {t.timeAgo && <span className="text-xs text-neutral-500">{t.timeAgo}</span>}
                </div>
                <div className="mt-1 text-neutral-200 truncate">{t.subject || t.category || 'Ticket'}</div>
                <div className="mt-1 text-xs text-neutral-400 truncate">{t.ownerTag} • {t.channelName}</div>
                {t.claimedByTag && <div className="mt-1 text-xs text-neutral-400">Claimed by {t.claimedByTag}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={()=> setViewId(t.id)} className="bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded text-sm border border-neutral-700">View</button>
                {t.status === 'open' && (
                  <>
                    <button onClick={()=>doAction(t.id, 'claim')} className="bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded text-sm">Claim</button>
                    <button onClick={()=>doAction(t.id, 'claim')} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm">Assign to me</button>
                  </>
                )}
                {t.status === 'claimed' && (
                  <>
                    <button onClick={()=>doAction(t.id, 'release')} className="bg-neutral-700 hover:bg-neutral-600 px-3 py-1.5 rounded text-sm">Release</button>
                    <button onClick={()=>doAction(t.id, 'close')} className="bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded text-sm">Close</button>
                    {currentUserId && <button onClick={()=> api.ticketAction(guildId!, t.id, 'assign', { userId: currentUserId }).then(()=> api.getTickets(guildId!, params).then(setData))} className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-sm">Assign to me</button>}
                  </>
                )}
                {t.status === 'open' && (
                  <button onClick={()=>doAction(t.id, 'close')} className="bg-rose-600 hover:bg-rose-500 px-3 py-1.5 rounded text-sm">Close</button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between p-3 border-t border-neutral-800 text-sm">
          <div className="text-neutral-400">Page {data?.pagination.page || page} / {data?.pagination.totalPages || 1}</div>
          <div className="flex items-center gap-2">
            <input type="checkbox" aria-label="Select all on page" onChange={e => toggleAll(e.target.checked)} />
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">{selectedIds.length} selected</span>
                <button onClick={bulkClose} className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500">Close</button>
                <button onClick={bulkAssign} className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600">Assign</button>
                <button onClick={bulkNote} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500">Add note</button>
              </div>
            )}
            <button
              className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50"
              disabled={(data?.pagination.page || page) <= 1}
              onClick={()=> setPage((data?.pagination.page || page) - 1)}
            >Prev</button>
            <button
              className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50"
              disabled={(data?.pagination.page || page) >= (data?.pagination.totalPages || 1)}
              onClick={()=> setPage((data?.pagination.page || page) + 1)}
            >Next</button>
            <select
              className="ml-2 bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
              aria-label="Items per page" title="Items per page"
              value={pageSize}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>{ setPage(1); setPageSize(parseInt(e.target.value, 10)) }}
            >
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
          </div>
        </div>
      </div>

      {guildId && viewId && (
        <TicketModal guildId={guildId} ticketId={viewId} onClose={()=> setViewId(null)} />
      )}
    </div>
  )
}

function StatBox({ label, value, colorClass }: { label: string; value: number; colorClass: string }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${colorClass}`} />
        {value}
      </div>
    </div>
  )
}
