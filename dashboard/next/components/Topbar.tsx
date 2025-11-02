'use client'

import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import MobileSidebar from './MobileSidebar'
import { useEffect, useState } from 'react'
import GuildSelector from './GuildSelector'
import UserAvatar from './UserAvatar'
import { useAuth } from '../hooks/useAuth'

export default function Topbar() {
  const [compact, setCompact] = useState(false)
  const { user, loading } = useAuth()

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-compact')
    const isCompact = saved === '1' || document.body.classList.contains('sidebar-compact')
    setCompact(isCompact)
  }, [])

  const toggleCompact = () => {
    const next = !compact
    setCompact(next)
    document.body.classList.toggle('sidebar-compact', next)
    localStorage.setItem('sidebar-compact', next ? '1' : '0')
  }
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/70 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <button
            onClick={toggleCompact}
            className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
            title="Alternar modo compacto"
          >
            {compact ? '⇤' : '⇥'}
          </button>
          <Link href="/" className="font-bold">Dashboard</Link>
          <a href="/moderation-react.html" className="text-sm text-neutral-300 hover:text-white">Moderation Center</a>
        </div>
        <div className="flex items-center gap-3">
          <GuildSelector />
          <ThemeToggle />
          {loading ? (
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-neutral-800 border border-neutral-700 animate-pulse" aria-label="A carregar" />
              <span className="sr-only">A carregar…</span>
            </div>
          ) : user ? (
            <>
              <div className="hidden sm:flex items-center gap-2"><UserAvatar /></div>
              <a href="/logout" className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700" title="Terminar sessão">Logout</a>
            </>
          ) : (
            <a href="/auth/discord" className="rounded-xl border border-brand-600 bg-brand-600/90 hover:bg-brand-600 px-3 py-2 text-sm" title="Iniciar sessão">Entrar</a>
          )}
        </div>
      </div>
    </header>
  )
}
