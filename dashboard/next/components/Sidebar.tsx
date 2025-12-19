"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import FeatureBadge from './FeatureBadge'
import { useI18n } from '@/lib/i18n'
import { useGuildId } from '@/lib/guild'
import { useState } from 'react'

const nav = [
  { href: '/', key: 'Dashboard', icon: '🏠', flag: 'stable' },

  // Gestão de Comunidade
  {
    key: 'Comunidade',
    icon: '👥',
    flag: 'stable',
    children: [
      { href: '/members', key: 'Membros', icon: '👤' },
      { href: '/roles', key: 'Cargos', icon: '🎭' },
      { href: '/invites', key: 'Convites', icon: '🎯' },
      { href: '/guild/{gid}/welcome', key: 'Boas-vindas', icon: '👋', requiresGuild: true },
    ]
  },

  // Moderação
  {
    key: 'Moderação',
    icon: '🛡️',
    flag: 'stable',
    children: [
      { href: '/moderation', key: 'Centro de Moderação', icon: '⚔️' },
      { href: '/automod', key: 'Automod', icon: '🤖' },
      { href: '/verification', key: 'Verificação', icon: '✅' },
      { href: '/appeals', key: 'Apelações', icon: '📝' },
      { href: '/antiraid', key: 'Anti-Raid', icon: '🛡️' },
      { href: '/warns', key: 'Avisos', icon: '⚠️' },
      { href: '/staff', key: 'Monitoramento Staff', icon: '👮' },
    ]
  },

  // Tickets
  {
    key: 'Tickets',
    icon: '🎫',
    flag: 'stable',
    children: [
      { href: '/tickets', key: 'Lista de Tickets', icon: '📋' },
      { href: '/tickets-enhanced', key: 'Tickets Avançados', icon: '🎫' },
      { href: '/ticket-categories', key: 'Categorias', icon: '🏷️' },
      { href: '/tickets/panels', key: 'Painéis', icon: '🎨' },
      { href: '/tickets/config', key: 'Configurações', icon: '⚙️' },
    ]
  },

  // Conteúdo & Engagement
  {
    key: 'Conteúdo',
    icon: '🎉',
    flag: 'stable',
    children: [
      { href: '/giveaways', key: 'Sorteios', icon: '🎁' },
      { href: '/tags', key: 'Tags', icon: '🏷️' },
      { href: '/commands', key: 'Comandos', icon: '⌨️' },
      { href: '/suggestions', key: 'Sugestões', icon: '💡' },
      { href: '/autoresponder', key: 'Auto-resposta', icon: '🤖' },
      { href: '/events', key: 'Eventos', icon: '📅' },
      { href: '/announcements', key: 'Anúncios', icon: '📢' },
    ]
  },

  // Estatísticas & Logs
  {
    key: 'Análises',
    icon: '📊',
    flag: 'stable',
    children: [
      { href: '/guild/{gid}/stats', key: 'Estatísticas', icon: '📈', requiresGuild: true },
      { href: '/guild/{gid}/server-stats', key: 'Stats do Servidor', icon: '📉', requiresGuild: true },
      { href: '/guild/{gid}/time-tracking', key: 'Ponto Eletrônico', icon: '⏱️', requiresGuild: true },
      { href: '/performance', key: 'Performance', icon: '⚡' },
    ]
  },

  // Configurações
  {
    key: 'Configuração',
    icon: '⚙️',
    flag: 'stable',
    children: [
      { href: '/settings', key: 'Configurações', icon: '🔧' },
      { href: '/webhooks', key: 'Webhooks', icon: '🔗' },
      { href: '/guild/{gid}/webhooks-config', key: 'Config. Webhooks', icon: '🔌', requiresGuild: true },
      { href: '/diagnostics', key: 'Diagnóstico', icon: '🔍' },
    ]
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { t } = useI18n()
  const guildId = useGuildId()
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)



  return (
    <aside className="hidden md:flex w-64 sidebar flex-col border-r border-neutral-800 bg-neutral-900/40 backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🔥</span>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              IGNIS
            </span>
            <p className="text-xs text-gray-500">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map((n) => {
          const hasChildren = n.children && n.children.length > 0
          const isOpen = openDropdown === n.key

          // Check if any child is active
          const isChildActive = hasChildren && n.children?.some(child => {
            if (!child || !child.href) return false
            const childHref = child.requiresGuild && guildId ? child.href.replace('{gid}', guildId) : child.href
            return pathname === childHref
          }) || false

          const active = n.href ? pathname === n.href : false

          return (
            <div key={n.key || n.href}>
              {hasChildren ? (
                <>
                  <button
                    onClick={() => setOpenDropdown(isOpen ? null : n.key)}
                    className={`w-full group rounded-lg px-3 py-2 flex items-center gap-2 transition-all text-sm ${
                      isChildActive
                        ? 'bg-purple-600/10 text-purple-300 border border-purple-600/30'
                        : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{n.icon}</span>
                    <span className="flex-1 font-medium text-left">{t(n.key)}</span>
                    <svg
                      className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown children */}
                  {isOpen && (
                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-gray-700/50 pl-2">
                      {n.children?.filter(child => child && child.href).map((child) => {
                        // Skip guild-specific items if no guild selected
                        if (child.requiresGuild && !guildId) return null

                        const childHref = child.requiresGuild && guildId
                          ? child.href.replace('{gid}', guildId)
                          : child.href
                        const childActive = pathname === childHref

                        return (
                          <Link
                            key={child.href}
                            href={childHref}
                            className={`block rounded-md px-3 py-1.5 flex items-center gap-2 transition-all text-xs ${
                              childActive
                                ? 'bg-purple-600/20 text-purple-300 font-medium'
                                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                            }`}
                          >
                            <span className="text-base">{child.icon}</span>
                            <span>{t(child.key)}</span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
                  href={n.href!}
                  className={`group rounded-lg px-3 py-2 flex items-center gap-2 transition-all text-sm ${
                    active
                      ? 'bg-gradient-to-r from-purple-600/20 to-pink-600/20 border border-purple-500/50 text-white shadow-lg shadow-purple-500/10'
                      : 'hover:bg-gray-800/50 text-gray-300 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{n.icon}</span>
                  <span className="flex-1 font-medium">{t(n.key)}</span>
                  {n.flag && <FeatureBadge flag={n.flag as any} />}
                </Link>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-neutral-800">
        <div className="text-xs text-gray-500 text-center">
          <p>IGNIS v3.0</p>
          <p className="text-purple-400/60">Sistema de Gestão</p>
        </div>
      </div>
    </aside>
  )
}
