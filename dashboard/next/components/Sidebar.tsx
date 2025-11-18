"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import FeatureBadge from './FeatureBadge'
import { useI18n } from '@/lib/i18n'
import { useGuildId } from '@/lib/guild'
import { useState } from 'react'

const nav = [
  { href: '/', key: 'nav.dashboard', icon: '📊', flag: 'stable' },
  { href: '/plugins', key: 'nav.plugins', icon: '🔌', flag: 'stable' },
  { href: '/giveaways', key: 'nav.giveaways', icon: '🎉', flag: 'stable' },
  { href: '/moderation', key: 'nav.moderation', icon: '🛡️', flag: 'stable' },
  { 
    href: '/tickets', 
    key: 'nav.tickets', 
    icon: '🎫', 
    flag: 'stable',
    children: [
      { href: '/tickets/config', key: 'nav.tickets.config', icon: '⚙️' },
      { href: '/tickets/panels', key: 'nav.tickets.panels', icon: '📋' },
    ]
  },
  { href: '/tags', key: 'nav.tags', icon: '🏷️', flag: 'beta' },
  { href: '/webhooks', key: 'nav.webhooks', icon: '🔗', flag: 'beta' },
  { href: '/verification', key: 'nav.verification', icon: '✅', flag: 'stable' },
  { href: '/members', key: 'nav.members', icon: '👥', flag: 'stable' },
  { href: '/roles', key: 'nav.roles', icon: '🎭', flag: 'stable' },
  { href: '/commands', key: 'nav.commands', icon: '⌨️', flag: 'stable' },
  { href: '/automod', key: 'nav.automod', icon: '🤖', flag: 'stable' },
  { href: '/appeals', key: 'nav.appeals', icon: '📝', flag: 'stable' },
  { href: '/settings', key: 'nav.settings', icon: '⚙️', flag: 'stable' },
  { href: '/diagnostics', key: 'nav.diagnostics', icon: '🔍', flag: 'stable' },
  { href: '/performance', key: 'nav.performance', icon: '📈', flag: 'stable' },
]

// Guild-specific pages (require guild selection)
const guildNav = [
  { href: '/guild/{gid}/welcome', key: 'nav.welcome', icon: '👋', flag: 'beta' },
  { href: '/guild/{gid}/stats', key: 'nav.stats', icon: '📊', flag: 'beta' },
  { href: '/guild/{gid}/time-tracking', key: 'nav.timeTracking', icon: '⏱️', flag: 'beta' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const guildId = useGuildId()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)



  return (
    <aside className={`hidden md:flex w-64 sidebar flex-col border-r border-neutral-800 bg-neutral-900/40 p-4 gap-2`}>
      <div className="text-lg font-bold mb-2">
        <span className="icon">🔥</span>
        <span className="label ml-2">IGNIS</span>
      </div>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => {
          const active = pathname === n.href
          const hasChildren = n.children && n.children.length > 0
          const isOpen = openDropdown === n.key
          const isChildActive = n.children?.some(child => pathname === child.href)
          
          return (
            <div key={n.href}>
              {hasChildren ? (
                <button
                  onClick={() => setOpenDropdown(isOpen ? null : n.key)}
                  className={`w-full group relative rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all ${
                    active || isChildActive
                      ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 text-white shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50'
                  }`}
                >
                  <span className="text-2xl">{n.icon}</span>
                  <span className="flex-1 font-medium text-sm text-left">{t(n.key)}</span>
                  <span className={`text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  <FeatureBadge flag={n.flag as any} />
                </button>
              ) : (
                <Link
                  href={n.href}
                  className={`group relative rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all ${
                    active 
                      ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 text-white shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50'
                  }`}
                >
                  <span className="text-2xl">{n.icon}</span>
                  <span className="flex-1 font-medium text-sm">{t(n.key)}</span>
                  <FeatureBadge flag={n.flag as any} />
                </Link>
              )}
              
              {/* Dropdown children */}
              {hasChildren && isOpen && (
                <div className="ml-6 mt-1 space-y-1">
                  {n.children?.map((child) => {
                    const childActive = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block rounded-lg px-3 py-2 flex items-center gap-2 transition-all text-sm ${
                          childActive
                            ? 'bg-purple-600/10 text-purple-300 border-l-2 border-purple-500'
                            : 'hover:bg-gray-800/30 text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <span className="text-lg">{child.icon}</span>
                        <span>{t(child.key)}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Guild-specific features */}
        {guildId && (
          <>
            <div className="mt-6 mb-3 px-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {t('nav.guildFeatures')}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            </div>
            {guildNav.map((n) => {
              const href = n.href.replace('{gid}', guildId)
              const active = pathname === href
              return (
                <Link
                  key={n.href}
                  href={href}
                  className={`group relative rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all ${
                    active 
                      ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 text-white shadow-lg shadow-purple-500/20' 
                      : 'hover:bg-gray-800/50 border border-transparent hover:border-gray-700/50'
                  }`}
                >
                  <span className="text-2xl">{n.icon}</span>
                  <span className="flex-1 font-medium text-sm">{t(n.key)}</span>
                  <FeatureBadge flag={n.flag as any} />
                </Link>
              )
            })}
          </>
        )}
      </nav>
    </aside>
  )
}

