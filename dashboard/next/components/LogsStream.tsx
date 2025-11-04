"use client"

import { useEffect, useRef, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { useI18n } from '@/lib/i18n'

type StreamEvent = { type?: string; message?: string; [k: string]: any }

export default function LogsStream() {
  const { t } = useI18n()
  const [guildId, setGuildId] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('')
  const [events, setEvents] = useState<StreamEvent[]>([])
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => { setGuildId(getGuildId()) }, [])

  const connect = () => {
    if (!guildId) return
    disconnect()
    const url = `/api/guild/${guildId}/logs/stream${filter ? `?type=${encodeURIComponent(filter)}` : ''}`
    const es = new EventSource(url, { withCredentials: true } as any)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        setEvents(prev => [...prev.slice(-500), data])
      } catch {
        setEvents(prev => [...prev.slice(-500), { message: ev.data }])
      }
    }
    esRef.current = es
  }

  const disconnect = () => {
    if (esRef.current) { esRef.current.close(); esRef.current = null }
    setConnected(false)
  }

  useEffect(() => {
    if (!guildId) return
    connect()
    return () => disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, filter])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('logs.live.title')}</h2>
        <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{connected ? t('logs.live.connected') : t('logs.live.disconnected')}</span>
        <input className="input max-w-xs" placeholder={t('logs.live.filter.placeholder')} value={filter} onChange={e => setFilter(e.target.value)} title={t('logs.type')} />
        <button className="btn btn-secondary" onClick={connect} title={t('logs.live.reconnect')}>{t('logs.live.reconnect')}</button>
        <button className="btn btn-danger" onClick={() => { setEvents([]) }} title={t('logs.clear')}>{t('logs.clear')}</button>
      </div>
      <div className="card">
        <div className="card-body text-xs font-mono max-h-[480px] overflow-auto">
          {events.map((e, i) => (
            <div key={i} className="border-b border-neutral-900/60 py-1">
              <span className="opacity-60">{e.type || 'event'} • </span>
              <span>{e.message || JSON.stringify(e)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
