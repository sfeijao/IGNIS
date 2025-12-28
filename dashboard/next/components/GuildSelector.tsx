"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { getGuildId, setGuildId } from '@/lib/guild'

type Guild = { id: string; name: string; icon?: string | null; iconUrl?: string | null; memberCount?: number; owner?: boolean | { id: string; username: string } | null; canManage?: boolean }

// Helper para obter URL do ícone do servidor
function getGuildIconUrl(guild: Guild): string | null {
  // Preferir iconUrl retornado pela API
  if (guild.iconUrl) return guild.iconUrl
  // Fallback para construir URL a partir do hash do icon
  if (!guild.icon) return null
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'webp'
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=64`
}

export default function GuildSelector() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guilds, setGuilds] = useState<Guild[]>([])
  const [query, setQuery] = useState('')
  const [current, setCurrent] = useState<string | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)

  // Carrega o guildId inicial e observa mudanças
  useEffect(() => {
    const updateCurrent = () => {
      const cur = getGuildId()
      setCurrent(cur)
    }
    
    updateCurrent()
    
    // Listener para mudanças no localStorage (entre tabs/componentes)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'guildId') {
        updateCurrent()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Listener para mudanças dentro da mesma tab (custom event)
    const handleGuildChange = () => updateCurrent()
    window.addEventListener('guildIdChanged', handleGuildChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('guildIdChanged', handleGuildChange)
    }
  }, [])

  // Carrega guilds automaticamente quando há um current selecionado (para mostrar o nome)
  useEffect(() => {
    if (guilds.length || !current) return
    const controller = new AbortController()
    ;(async () => {
      try {
        console.log('[GuildSelector] Loading guilds for current:', current)
        const res = await fetch('/api/guilds', { credentials: 'include', signal: controller.signal })
        console.log('[GuildSelector] Guilds response status:', res.status)
        if (!res.ok) {
          console.error('[GuildSelector] Failed to load guilds:', res.status, res.statusText)
          return
        }
        const data = await res.json()
        console.log('[GuildSelector] Guilds data:', data)
        setGuilds(Array.isArray(data?.guilds) ? data.guilds : [])
      } catch (e: any) {
        console.error('[GuildSelector] Error loading guilds:', e)
        // Silent fail - será carregado quando abrir o dropdown
      }
    })()
    return () => controller.abort()
  }, [current, guilds.length])

  useEffect(() => {
    if (!open || guilds.length) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        console.log('[GuildSelector] Fetching guilds on dropdown open...')
        const res = await fetch('/api/guilds', { credentials: 'include', signal: controller.signal })
        console.log('[GuildSelector] Response status:', res.status)
        if (!res.ok) throw new Error(`Failed ${res.status}`)
        const data = await res.json()
        console.log('[GuildSelector] Received data:', data)
        setGuilds(Array.isArray(data?.guilds) ? data.guilds : [])
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.error('[GuildSelector] Error:', e)
          setError((e instanceof Error ? e.message : String(e)) || 'Falha ao carregar guilds')
        }
      } finally {
        setLoading(false)
      }
    })()
    return () => controller.abort()
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

  const currentGuild = useMemo(() => {
    if (!current) return null
    return guilds.find(g => g.id === current)
  }, [current, guilds])

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
        className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 px-3 py-2 text-sm min-w-[220px]"
        onClick={() => setOpen(v => !v)}
        title={currentGuild ? `Servidor: ${currentGuild.name}` : 'Selecionar servidor'}
      >
        {currentGuild && getGuildIconUrl(currentGuild) ? (
          <img 
            src={getGuildIconUrl(currentGuild)!} 
            alt={currentGuild.name} 
            className="h-6 w-6 rounded-full object-cover"
          />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white text-xs font-bold">
            {currentGuild?.name?.[0]?.toUpperCase() || 'S'}
          </span>
        )}
        <span className="truncate text-left flex-1">
          {currentGuild ? currentGuild.name : current ? `ID: ${current}` : 'Selecionar servidor'}
        </span>
        <span className="ml-auto opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[400px] rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl z-20">
          <div className="p-3 border-b border-neutral-800">
            <input
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
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
                className={`w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-neutral-900/80 transition-colors ${current===g.id ? 'bg-purple-900/20 border-l-2 border-purple-500' : 'border-l-2 border-transparent'}`}
                onClick={() => select(g)}
              >
                {getGuildIconUrl(g) ? (
                  <img 
                    src={getGuildIconUrl(g)!} 
                    alt={g.name} 
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-neutral-700"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-sm font-bold text-white ring-2 ring-neutral-700">
                    {g.name ? g.name[0].toUpperCase() : 'S'}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-neutral-100 font-medium">{g.name || g.id}</div>
                  <div className="text-xs text-neutral-500 flex items-center gap-2">
                    <span>{g.memberCount ? `${g.memberCount} membros` : ''}</span>
                    {g.owner && <span className="text-amber-400">👑 Dono</span>}
                  </div>
                </div>
                {current === g.id && (
                  <span className="text-purple-400 text-xs">✓</span>
                )}
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
