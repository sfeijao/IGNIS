"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/settings', label: 'Settings' },
  { href: '/tickets', label: 'Tickets' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const iconFor = (label: string) => {
    switch (label) {
      case 'Dashboard': return <Icon name="dashboard" />
      case 'Plugins': return <Icon name="plugins" />
      case 'Settings': return <Icon name="settings" />
      case 'Tickets': return <Icon name="tickets" />
      default: return <Icon name="info" />
    }
  }

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
              className={`relative rounded-lg px-3 py-2 hover:bg-neutral-800/80 transition-colors ${active ? 'bg-neutral-800 text-white animate-glow' : ''}`}
            >
              <span className={`absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-brand-500 to-blue-500 ${active ? 'opacity-100 animate-pulseLine' : 'opacity-0'}`} />
              <span className="icon mr-2 inline-flex items-center">{iconFor(n.label)}</span>
              <span className="label">{n.label}</span>
            </Link>
          )
        })}
        <a href="/moderation-react.html" className="relative rounded-lg px-3 py-2 hover:bg-neutral-800/80 transition-colors" target="_self">
          <span className="icon mr-2 inline-flex items-center"><Icon name="shield" /></span>
          <span className="label">Moderation Center</span>
        </a>
      </nav>
    </aside>
  )
}
