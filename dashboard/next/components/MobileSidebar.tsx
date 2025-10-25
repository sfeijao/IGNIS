'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/plugins', label: 'Plugins' },
  { href: '/settings', label: 'Settings' },
  { href: '/tickets', label: 'Tickets' },
]

export default function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  return (
    <>
      <button
        className="md:hidden rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-neutral-900 border-r border-neutral-800 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold">IGNIS</div>
              <button
                className="rounded-lg border border-neutral-700 px-2 py-1 text-sm hover:bg-neutral-800"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {nav.map((n) => {
                const active = pathname === n.href
                return (
                  <Link key={n.href} href={n.href} className={`relative rounded-lg px-3 py-2 hover:bg-neutral-800 transition-colors ${active ? 'bg-neutral-800 text-white' : ''}`} onClick={() => setOpen(false)}>
                    <span className={`absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-brand-500 to-blue-500 ${active ? 'opacity-100 animate-pulseLine' : 'opacity-0'}`} />
                    <span className="mr-2 inline-flex items-center">
                      {n.label === 'Dashboard' && <Icon name="dashboard" />}
                      {n.label === 'Plugins' && <Icon name="plugins" />}
                      {n.label === 'Settings' && <Icon name="settings" />}
                      {n.label === 'Tickets' && <Icon name="tickets" />}
                    </span>
                    {n.label}
                  </Link>
                )
              })}
              <a href="/moderation-react.html" className="relative rounded-lg px-3 py-2 hover:bg-neutral-800 transition-colors" onClick={() => setOpen(false)}>
                <span className="mr-2 inline-flex items-center"><Icon name="shield" /></span>
                Moderation Center
              </a>
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
