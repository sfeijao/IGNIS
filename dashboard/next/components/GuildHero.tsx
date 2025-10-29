'use client'

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '@/lib/guild'

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

  const bgImage = useMemo(() => {
    if (!info?.bannerUrl && !info?.splashUrl) return null
    return info.bannerUrl || info.splashUrl
  }, [info])

  if (!guildId || !loaded || !info) return null

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
        <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          {info.iconUrl ? (
            <img src={info.iconUrl} alt={info.name} className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg border border-neutral-700 object-cover bg-neutral-800" />
          ) : (
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg border border-neutral-700 bg-neutral-800 flex items-center justify-center text-lg font-bold">
              {info.name?.[0] || 'G'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">{info.name || guildId}</h2>
            {info.memberCount != null && (
              <div className="text-xs text-neutral-400">{info.memberCount} membros</div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
