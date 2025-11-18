"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import FeatureBadge from './FeatureBadge'
import { useI18n } from '@/lib/i18n'
import { useGuildId } from '@/lib/guild'

const nav = [
  { href: '/', key: 'nav.dashboard', flag: 'stable' },
  { href: '/plugins', key: 'nav.plugins', flag: 'stable' },
  { href: '/giveaways', key: 'nav.giveaways', flag: 'stable' },
  { href: '/moderation', key: 'nav.moderation', flag: 'stable' },
  { href: '/moderation/center', key: 'nav.moderation.center', flag: 'stable' },
  { href: '/members', key: 'nav.members', flag: 'stable' },
  { href: '/roles', key: 'nav.roles', flag: 'stable' },
  { href: '/webhooks', key: 'nav.webhooks', flag: 'stable' },
  { href: '/verification', key: 'nav.verification', flag: 'stable' },
  { href: '/verification/metrics', key: 'nav.verification.metrics', flag: 'stable' },
  { href: '/tags', key: 'nav.tags', flag: 'stable' },
  { href: '/tickets', key: 'nav.tickets', flag: 'stable' },
  { href: '/tickets/config', key: 'nav.tickets.config', flag: 'stable' },
  { href: '/tickets/panels', key: 'nav.tickets.panels', flag: 'stable' },
  { href: '/commands', key: 'nav.commands', flag: 'stable' },
  { href: '/automod', key: 'nav.automod', flag: 'stable' },
  { href: '/appeals', key: 'nav.appeals', flag: 'stable' },
  { href: '/settings', key: 'nav.settings', flag: 'stable' },
  { href: '/diagnostics', key: 'nav.diagnostics', flag: 'stable' },
  { href: '/performance', key: 'nav.performance', flag: 'stable' },
]

// Guild-specific pages (require guild selection)
const guildNav = [
  { href: '/guild/{gid}/welcome', key: 'nav.welcome', icon: '👋', flag: 'new' },
  { href: '/guild/{gid}/stats', key: 'nav.stats', icon: '📊', flag: 'new' },
  { href: '/guild/{gid}/time-tracking', key: 'nav.timeTracking', icon: '⏱️', flag: 'new' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const guildId = useGuildId()

  const iconFor = (key: string) => {
    switch (key) {
      case 'nav.dashboard': return <Icon name="dashboard" />
      case 'nav.plugins': return <Icon name="plugins" />
  case 'nav.giveaways': return <span style={{fontSize:'1.05rem'}}>🎉</span>

      case 'nav.moderation': return <Icon name="shield" />
      case 'nav.members': return <Icon name="members" />
      case 'nav.roles': return <Icon name="roles" />
      case 'nav.webhooks': return <Icon name="webhooks" />
      case 'nav.verification': return <Icon name="verification" />
      case 'nav.verification.metrics': return <Icon name="metrics" />
      case 'nav.tags': return <Icon name="tag" />
      case 'nav.tickets': return <Icon name="tickets" />
      case 'nav.tickets.config': return <Icon name="tickets" />
      case 'nav.tickets.panels': return <Icon name="tickets" />
      case 'nav.commands': return <Icon name="commands" />
      case 'nav.automod': return <Icon name="automod" />
      case 'nav.appeals': return <Icon name="appeals" />
      case 'nav.settings': return <Icon name="settings" />
      case 'nav.diagnostics': return <Icon name="diagnostics" />
      case 'nav.performance': return <Icon name="performance" />
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
              className={`relative rounded-lg px-3 py-2 hover:bg-neutral-800/80 transition-colors tip ${active ? 'bg-neutral-800 text-white animate-glow' : ''}`}
              data-tip={t(n.key)}
              title={t(n.key)}
            >
              <span className={`absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-brand-500 to-blue-500 ${active ? 'opacity-100 animate-pulseLine' : 'opacity-0'}`} />
              <span className="icon mr-2 inline-flex items-center">{iconFor(n.key)}</span>
              <span className="label flex items-center gap-2">
                {t(n.key)}
                <FeatureBadge flag={n.flag as any} />
              </span>
            </Link>
          )
        })}

        {/* Guild-specific features */}
        {guildId && (
          <>
            <div className="mt-4 mb-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {t('nav.guildFeatures')}
            </div>
            {guildNav.map((n) => {
              const href = n.href.replace('{gid}', guildId)
              const active = pathname === href
              return (
                <Link
                  key={n.href}
                  href={href}
                  className={`relative rounded-lg px-3 py-2 hover:bg-neutral-800/80 transition-colors tip ${active ? 'bg-neutral-800 text-white animate-glow' : ''}`}
                  data-tip={t(n.key)}
                  title={t(n.key)}
                >
                  <span className={`absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-purple-500 to-pink-500 ${active ? 'opacity-100 animate-pulseLine' : 'opacity-0'}`} />
                  <span className="icon mr-2 inline-flex items-center text-lg">{n.icon}</span>
                  <span className="label flex items-center gap-2">
                    {t(n.key)}
                    <FeatureBadge flag={n.flag as any} />
                  </span>
                </Link>
              )
            })}
          </>
        )}

        {/* Legacy moderation center link removed; integrated into /moderation */}
      </nav>
    </aside>
  )
}

