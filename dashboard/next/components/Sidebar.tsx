"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/settings', label: 'Settings' },
  { href: '/tickets', label: 'Tickets' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className={`hidden md:flex w-64 sidebar flex-col border-r border-neutral-800 bg-neutral-900/40 p-4 gap-2`}>
      <div className="text-lg font-bold mb-2">
        <span className="icon">🔥</span>
        <span className="label ml-2">IGNIS</span>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => {
          const active = pathname === n.href
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-lg px-3 py-2 hover:bg-neutral-800/80 ${active ? 'bg-neutral-800 text-white' : ''}`}
            >
              <span className="icon">•</span>
              <span className="label ml-2">{n.label}</span>
            </Link>
          )
        })}
        <a href="/moderation-react.html" className="rounded-lg px-3 py-2 hover:bg-neutral-800/80" target="_self">
          <span className="icon">•</span>
          <span className="label ml-2">Moderation Center</span>
        </a>
      </nav>
    </aside>
  )
}
