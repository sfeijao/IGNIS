"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import FeatureBadge from './FeatureBadge'

const nav = [
  { href: '/', label: 'Dashboard', flag: 'stable' },
  { href: '/plugins', label: 'Plugins', flag: 'stable' },
  { href: '/logs', label: 'Logs', flag: 'stable' },
  { href: '/logs/live', label: 'Logs ao vivo', flag: 'stable' },
  { href: '/moderation', label: 'Moderação', flag: 'stable' },
  { href: '/members', label: 'Membros', flag: 'stable' },
  { href: '/roles', label: 'Cargos', flag: 'stable' },
  { href: '/webhooks', label: 'Webhooks', flag: 'rollout' },
  { href: '/verification', label: 'Verificação', flag: 'stable' },
  { href: '/verification/metrics', label: 'Verificação: métricas', flag: 'beta' },
  { href: '/tags', label: 'Tags', flag: 'stable' },
  { href: '/tickets', label: 'Tickets', flag: 'stable' },
  { href: '/tickets/config', label: 'Tickets: config', flag: 'stable' },
  { href: '/tickets/panels', label: 'Tickets: painéis', flag: 'stable' },
  { href: '/commands', label: 'Comandos', flag: 'rollout' },
  { href: '/automod', label: 'Automod', flag: 'beta' },
  { href: '/appeals', label: 'Apelos', flag: 'beta' },
  { href: '/settings', label: 'Settings', flag: 'stable' },
  { href: '/diagnostics', label: 'Diagnósticos', flag: 'stable' },
  { href: '/performance', label: 'Performance', flag: 'stable' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const iconFor = (label: string) => {
    switch (label) {
      case 'Dashboard': return <Icon name="dashboard" />
      case 'Plugins': return <Icon name="plugins" />
      case 'Logs': return <Icon name="logs" />
      case 'Logs ao vivo': return <Icon name="live" />
      case 'Moderação': return <Icon name="shield" />
      case 'Membros': return <Icon name="members" />
      case 'Cargos': return <Icon name="roles" />
      case 'Webhooks': return <Icon name="webhooks" />
      case 'Verificação': return <Icon name="verification" />
      case 'Verificação: métricas': return <Icon name="metrics" />
      case 'Tags': return <Icon name="tag" />
      case 'Tickets': return <Icon name="tickets" />
      case 'Tickets: config': return <Icon name="tickets" />
      case 'Tickets: painéis': return <Icon name="tickets" />
      case 'Comandos': return <Icon name="commands" />
      case 'Automod': return <Icon name="automod" />
      case 'Apelos': return <Icon name="appeals" />
      case 'Settings': return <Icon name="settings" />
      case 'Diagnósticos': return <Icon name="diagnostics" />
      case 'Performance': return <Icon name="performance" />
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
              data-tip={n.label}
              title={n.label}
            >
              <span className={`absolute left-0 top-1 bottom-1 w-1 rounded-full bg-gradient-to-b from-brand-500 to-blue-500 ${active ? 'opacity-100 animate-pulseLine' : 'opacity-0'}`} />
              <span className="icon mr-2 inline-flex items-center">{iconFor(n.label)}</span>
              <span className="label flex items-center gap-2">
                {n.label}
                <FeatureBadge flag={n.flag as any} />
              </span>
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
