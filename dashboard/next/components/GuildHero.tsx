'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { getGuildId } from '@/lib/guild'
import Skeleton from './Skeleton'

interface GuildInfo {
  id: string
  name: string
  description?: string | null
  iconUrl?: string | null
  bannerUrl?: string | null
  splashUrl?: string | null
  memberCount?: number
}

export default function GuildHero() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [info, setInfo] = useState<GuildInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [stats, setStats] = useState<{ onlineCount?: number; channelCount?: number; roleCount?: number } | null>(null)

  useEffect(() => {
    const id = getGuildId()
    setGuildId(id)
  }, [])

  useEffect(() => {
    let aborted = false
    if (!guildId) { setInfo(null); setLoaded(true); return }
    ;(async () => {
      try {
        const r = await fetch(`/api/guild/${guildId}/info`, { credentials: 'include' })
        if (!r.ok) { setLoaded(true); return }
        const d = await r.json()
        if (!aborted && d && d.success) {
          setInfo(d.guild)
          setLoaded(true)
        }
      } catch {
        if (!aborted) setLoaded(true)
      }
    })()
    return () => { aborted = true }
  }, [guildId])

  // Live stats fetch + refresh
  useEffect(() => {
    let aborted = false
    let timer: any
    const fetchStats = async () => {
      if (!guildId) { setStats(null); return }
      try {
        const r = await fetch(`/api/guild/${guildId}/stats`, { credentials: 'include' })
        if (!r.ok) return
        const d = await r.json()
        if (!aborted && d && d.success && d.stats) setStats({ onlineCount: d.stats.onlineCount, channelCount: d.stats.channelCount, roleCount: d.stats.roleCount })
      } catch {}
    }
    fetchStats()
    timer = setInterval(fetchStats, 20000)
    return () => { aborted = true; if (timer) clearInterval(timer) }
  }, [guildId])

  const bgImage = useMemo(() => {
    if (!info?.bannerUrl && !info?.splashUrl) return null
    return info.bannerUrl || info.splashUrl
  }, [info])

  if (!loaded) {
    return (
      <section className="relative overflow-hidden border-b border-neutral-800">
        <div className="relative w-full">
          <Skeleton className="h-40 sm:h-48 md:h-56 w-full" />
        </div>
        <div className="absolute inset-0 flex items-end">
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex w-full flex-col gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (!guildId || !info) return null

  return (
    <section className="relative overflow-hidden border-b border-neutral-800">
      <div className="relative h-40 sm:h-48 md:h-56 w-full bg-neutral-900">
        {bgImage && (
          <>
            <img src={bgImage} alt="Guild banner" className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-black/80" />
          </>
        )}
      </div>
      <div className="absolute inset-0 flex items-end">
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex w-full flex-col gap-3">
          <div className="flex items-center gap-3">
          {info.iconUrl ? (
            <img src={info.iconUrl} alt={info.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg border border-neutral-700 object-cover bg-neutral-800" />
          ) : (
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-lg font-bold">
              {info.name?.[0] || 'G'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">{info.name || guildId}</h2>
            <div className="text-xs text-neutral-400 flex items-center gap-3">
              {info.memberCount != null && <span>{info.memberCount} membros</span>}
              {stats?.onlineCount != null && <span>• {stats.onlineCount} online</span>}
              {stats?.channelCount != null && <span>• {stats.channelCount} canais</span>}
              {stats?.roleCount != null && <span>• {stats.roleCount} cargos</span>}
            </div>
          </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-700 hover:bg-neutral-800 text-sm">Visão geral</Link>
            <Link href="/plugins" className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-700 hover:bg-neutral-800 text-sm">Plugins</Link>
            <Link href="/tickets" className="px-3 py-1.5 rounded-lg bg-neutral-900/80 border border-neutral-700 hover:bg-neutral-800 text-sm">Tickets</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
