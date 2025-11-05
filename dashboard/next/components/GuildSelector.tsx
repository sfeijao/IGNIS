"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { getGuildId, setGuildId } from '@/lib/guild'

type Guild = { id: string; name: string; icon?: string | null; memberCount?: number }

export default function GuildSelector() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const cur = getGuildId()
    setCurrent(cur)
  }, [])

  useEffect(() => {
    if (!open || guilds.length) return
    let aborted = false
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const res = await fetch('/api/guilds', { credentials: 'include' })
        if (!res.ok) throw new Error(`Failed ${res.status}`)
        const data = await res.json()
        if (!aborted) setGuilds(Array.isArray(data?.guilds) ? data.guilds : [])
      } catch (e: any) {
        if (!aborted) setError(e?.message || 'Falha ao carregar guilds')
      } finally {
        if (!aborted) setLoading(false)
      }
    })()
    return () => { aborted = true }
  }, [open, guilds.length])

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!popRef.current) return
      if (!popRef.current.contains(ev.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return guilds
    return guilds.filter(g => g.name?.toLowerCase().includes(q) || g.id.includes(q))
  }, [guilds, query])

  const select = (g: Guild) => {
    setGuildId(g.id, true)
    setCurrent(g.id)
    setOpen(false)
  }
  const clear = () => {
    setGuildId('', true)
    setCurrent(null)
  }

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-1.5 text-sm min-w-[200px]"
        onClick={() => setOpen(v => !v)}
        title={current ? `Servidor: ${current}` : 'Selecionar servidor'}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-neutral-800 border border-neutral-700">
          {/* Placeholder icon. We could draw the selected guild initial here. */}
          <span className="text-[10px]">G</span>
        </span>
        <span className="truncate text-left">
          {current ? `Guild: ${current}` : 'Selecionar servidor'}
        </span>
        <span className="ml-auto opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl z-20">
          <div className="p-2 border-b border-neutral-800">
            <input
              className="w-full bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-sm"
              placeholder="Procurar servidor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-80 overflow-auto">
            {loading && <div className="p-3 text-sm text-neutral-400">Carregando…</div>}
            {error && <div className="p-3 text-sm text-red-400">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="p-3 text-sm text-neutral-400">Nenhum servidor</div>
            )}
            {filtered.map(g => (
              <button
                type="button"
                key={g.id}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-neutral-900 ${current===g.id ? 'bg-neutral-900' : ''}`}
                onClick={() => select(g)}
              >
                <div className="h-8 w-8 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold">
                  {g.name ? g.name[0].toUpperCase() : 'G'}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-neutral-200 text-sm">{g.name || g.id}</div>
                  <div className="text-[11px] text-neutral-400">{g.id}{g.memberCount ? ` • ${g.memberCount} membros` : ''}</div>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-neutral-800 flex items-center gap-2">
            <button type="button" className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs" onClick={clear}>Limpar</button>
            {current && <span className="text-xs text-neutral-500 truncate">Atual: {current}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
