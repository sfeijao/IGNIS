'use client'

import Link from 'next/link'
import ThemeToggle from './ThemeToggle'
import MobileSidebar from './MobileSidebar'
import { useEffect, useState } from 'react'
import GuildSelector from './GuildSelector'
import UserAvatar from './UserAvatar'

export default function Topbar() {
  const [compact, setCompact] = useState(false)

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
          <div className="hidden sm:flex items-center gap-2"><UserAvatar /></div>
        </div>
      </div>
    </header>
  )
}
