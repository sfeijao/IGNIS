"use client"

import { useEffect, useState } from 'react'
import { api } from '@/lib/apiClient'

interface Props {
  guildId: string
  ticketId: string
  onClose: () => void
}

interface TicketDetails {
  success: boolean
  ticket: any
}

interface TicketLogs {
  success: boolean
  logs: Array<{ timestamp: string; action: string; actor_id?: string; actorTag?: string | null; actorAvatar?: string | null; message?: string }>
}

export default function TicketModal({ guildId, ticketId, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<TicketDetails | null>(null)
  const [logs, setLogs] = useState<TicketLogs | null>(null)
  const [offset, setOffset] = useState(0)
  const [busyMore, setBusyMore] = useState(false)
  const [tab, setTab] = useState<'overview' | 'logs' | 'transcript'>('overview')
  const limit = 200
  const [messages, setMessages] = useState<any[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: any }>>([])
  const channelTypeLabel = (t?: any) => {
    const tt = (t ?? '').toString().toLowerCase()
    if (tt === '0' || tt === 'text' || tt === 'guild_text') return 'Text'
    if (tt === '2' || tt === 'voice' || tt === 'guild_voice') return 'Voice'
    if (tt === '4' || tt === 'category' || tt === 'guild_category') return 'Category'
    if (tt === '5' || tt === 'announcement' || tt === 'guild_announcement') return 'Announcement'
    return 'Channel'
  }

  useEffect(() => {
    let aborted = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const d = await api.getTicketDetails(guildId, ticketId)
        const l = await api.getTicketLogs(guildId, ticketId, { limit, offset: 0 })
        const ch = await api.getChannels(guildId).catch(() => ({ channels: [] }))
        if (!aborted) {
          setDetails(d)
          setLogs(l)
          setOffset(l?.logs?.length || 0)
          setChannels(((ch as any).channels || ch || []).filter((c: any) => c && c.id && c.name))
          // initial transcript page
          try {
            const m = await api.getTicketMessages(guildId, ticketId, { limit: 100 })
            if (!aborted) { setMessages(m.messages || []); setNextBefore(m.nextBefore || null) }
          } catch {}
        }
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Failed to load ticket')
      } finally {
        if (!aborted) setLoading(false)
      }
    }
    run()
    return () => { aborted = true }
  }, [guildId, ticketId])

  const loadMore = async () => {
    if (busyMore) return
    try {
      setBusyMore(true)
      const next = await api.getTicketLogs(guildId, ticketId, { limit, offset })
  setLogs((prev: TicketLogs | null) => prev ? { ...prev, logs: [...prev.logs, ...next.logs] } : next)
      setOffset(offset + (next?.logs?.length || 0))
    } catch {}
    finally { setBusyMore(false) }
  }

  const loadMoreMessages = async () => {
    if (!nextBefore) return
    try {
      const m = await api.getTicketMessages(guildId, ticketId, { limit: 100, before: nextBefore })
  setMessages((prev: any[]) => [...(m.messages || []), ...prev])
      setNextBefore(m.nextBefore || null)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-5xl card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800">
          <div className="font-semibold">Ticket #{ticketId}</div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
        {loading && <div className="p-6 text-neutral-400">Carregando…</div>}
        {error && <div className="p-6 text-red-400">{error}</div>}
        {!loading && !error && details && (
          <div>
            <div className="px-5 pt-3 flex items-center gap-2 border-b border-neutral-800">
              <button type="button" className={`px-3 py-2 text-sm rounded-t ${tab==='overview' ? 'bg-neutral-800 border border-neutral-700 border-b-neutral-800' : 'text-neutral-400 hover:text-white'}`} onClick={()=> setTab('overview')}>Overview</button>
              <button type="button" className={`px-3 py-2 text-sm rounded-t ${tab==='logs' ? 'bg-neutral-800 border border-neutral-700 border-b-neutral-800' : 'text-neutral-400 hover:text-white'}`} onClick={()=> setTab('logs')}>Logs</button>
              <button type="button" className={`px-3 py-2 text-sm rounded-t ${tab==='transcript' ? 'bg-neutral-800 border border-neutral-700 border-b-neutral-800' : 'text-neutral-400 hover:text-white'}`} onClick={()=> setTab('transcript')}>Transcript</button>
              {tab==='transcript' && (
                <a className="ml-auto mr-5 text-sm text-blue-400 hover:text-blue-300 underline" href={`/api/guild/${guildId}/tickets/${ticketId}?download=transcript`} target="_blank" rel="noreferrer">Download transcript</a>
              )}
            </div>

            {tab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-neutral-800">
                <div className="p-4 space-y-2">
                  <Field label="Status" value={details.ticket.status} />
                  <Field label="Priority" value={details.ticket.priority || 'normal'} />
                  <Field label="Owner" value={`${details.ticket.ownerTag} (${details.ticket.user_id})`} />
                  {details.ticket.claimedByTag && <Field label="Claimed by" value={details.ticket.claimedByTag} />}
                  <Field label="Channel" value={(() => {
                    const ch = channels.find(c => c.id === details.ticket.channel_id)
                    if (ch) return `#${ch.name} (${channelTypeLabel(ch.type)})`
                    if (details.ticket.channelName) return `#${details.ticket.channelName}`
                    return String(details.ticket.channel_id)
                  })()} />
                  <Field label="Opened" value={details.ticket.timeAgo} />
                </div>
                <div className="p-4 md:col-span-2">
                  <div className="font-medium mb-2">Recent activity</div>
                  <div className="max-h-96 overflow-auto pr-1">
                    <Timeline items={(logs?.logs || []).slice(0, 20)} />
                  </div>
                </div>
              </div>
            )}

            {tab === 'logs' && (
              <div className="p-4">
                <div className="font-medium mb-2">Logs</div>
                <div className="max-h-96 overflow-auto pr-1">
                  <Timeline items={logs?.logs || []} />
                </div>
                <div className="mt-3">
                  <button type="button" onClick={loadMore} disabled={busyMore} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 text-sm">{busyMore ? 'Loading…' : 'Load more'}</button>
                </div>
              </div>
            )}

            {tab === 'transcript' && (
              <div className="p-4">
                <div className="font-medium mb-2">Transcript</div>
                <div className="max-h-[28rem] overflow-auto space-y-3">
                  {messages.map((m: any) => (
                    <div key={m.id} className="text-sm">
                      <span className="text-neutral-500">[{new Date(m.timestamp).toLocaleString()}]</span>{' '}
                      <span className="text-neutral-300">{m.author?.username}#{m.author?.discriminator}</span>:{' '}
                      <span className="text-neutral-200 whitespace-pre-wrap break-words">{m.content || ''}</span>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="text-neutral-400 text-sm">No recent messages captured. Try the Download transcript link for a full export.</div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button type="button" onClick={loadMoreMessages} disabled={!nextBefore} className="px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 text-sm">{nextBefore ? 'Load older messages' : 'No more messages'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }){
  return (
    <div>
      <div className="text-sm text-neutral-400">{label}</div>
      <div className="text-neutral-200">{value}</div>
    </div>
  )
}

function Timeline({ items }: { items: Array<{ timestamp: string; action: string; actorTag?: string | null; message?: string }> }){
  return (
    <ol className="relative border-l border-neutral-800 pl-4">
      {items.map((l, idx) => (
        <li key={idx} className="mb-4 ml-2">
          <div className="absolute -left-1.5 mt-1.5 w-3 h-3 bg-neutral-700 rounded-full border border-neutral-600" />
          <time className="text-xs text-neutral-500">{new Date(l.timestamp).toLocaleString()}</time>
          <div className="text-sm text-neutral-300"><span className="font-semibold">{l.action}</span>{l.actorTag ? ` by ${l.actorTag}` : ''}</div>
          {l.message && <div className="text-sm text-neutral-400 whitespace-pre-wrap break-words">{l.message}</div>}
        </li>
      ))}
    </ol>
  )
}
