"use client"

import { useEffect, useMemo, useState } from 'react'
import PluginCard from '@/components/PluginCard'
import { useGuildId } from '@/lib/guild'

type Plugin = { name: string; desc: string; icon: any; tip?: string; href?: string; configHref?: string; viewHref?: string; badge?: string; gradient?: string }
type Category = { title: string; items: Plugin[] }

export default function PluginsPage() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('Todas')
  const isGuildSelected = !!useGuildId()

  const guildId = useGuildId()
  
  const categories: Category[] = [
    {
      title: 'Funcionalidades do Servidor',
      items: [
        { name: 'Boas-Vindas & Despedidas', desc: 'Configure mensagens personalizadas para novos membros e saídas.', icon: '👋', tip: 'Mensagens de boas-vindas com placeholders {user}, {server}, embeds personalizados.', configHref: guildId ? `/guild/${guildId}/welcome` : '#', viewHref: guildId ? `/guild/${guildId}/welcome` : '#', badge: 'Beta', gradient: 'from-green-600/20 to-emerald-600/20' },
        { name: 'Estatísticas do Servidor', desc: 'Configure canais de voz com estatísticas em tempo real.', icon: '📊', tip: 'Contadores automáticos: membros totais, online, bots, canais, cargos.', configHref: guildId ? `/guild/${guildId}/stats` : '#', viewHref: guildId ? `/guild/${guildId}/stats` : '#', badge: 'Beta', gradient: 'from-blue-600/20 to-cyan-600/20' },
        { name: 'Time Tracking', desc: 'Sistema de controlo de tempo de trabalho/presença dos membros.', icon: '⏱️', tip: 'Os utilizadores podem usar comandos do Discord para registar entrada, pausa e continuação.', configHref: guildId ? `/guild/${guildId}/time-tracking` : '#', viewHref: guildId ? `/guild/${guildId}/time-tracking` : '#', badge: 'Beta', gradient: 'from-orange-600/20 to-red-600/20' },
      ]
    },
    {
      title: 'Essenciais',
      items: [
        { name: 'Moderação', desc: 'Automod, logs, ações e auditoria.', icon: 'shield' as const, tip: 'Configure regras, mod-logs e automod.', configHref: '/moderation', viewHref: '/moderation', gradient: 'from-red-600/20 to-orange-600/20' },
      ]
    },
    {
      title: 'Gestão do Servidor',
      items: [
        { name: 'Tickets', desc: 'Gestão de tickets e painéis.', icon: 'tickets' as const, tip: 'Crie painéis e gerencie filas.', configHref: '/tickets', viewHref: '/tickets', gradient: 'from-blue-600/20 to-indigo-600/20' },
        { name: 'Tags', desc: 'Respostas rápidas e painéis.', icon: 'tag' as const, tip: 'Defina atalhos e coleções.', configHref: '/tags', viewHref: '/tags', gradient: 'from-yellow-600/20 to-orange-600/20' },
        { name: 'Webhooks', desc: 'Gerir webhooks e auto-setup.', icon: 'plugins' as const, tip: 'Criar e testar webhooks.', configHref: '/webhooks', viewHref: '/webhooks', gradient: 'from-teal-600/20 to-green-600/20' },
      ]
    },
    {
      title: 'Segurança',
      items: [
        { name: 'Verificação', desc: 'Configurar sistema de verificação.', icon: 'shield' as const, tip: 'Captcha e cargos.', configHref: '/verification', viewHref: '/verification', gradient: 'from-purple-600/20 to-pink-600/20' },
      ]
    }
  ]

  const flat = useMemo(() => {
    return categories.flatMap(cat => cat.items.map(item => ({ ...item, category: cat.title })))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return flat.filter(p => {
      const inCat = active === 'Todas' || p.category === active
      if (!inCat) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    })
  }, [flat, query, active])

  const allCats = useMemo(() => ['Todas', ...categories.map(c => c.title)], [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Plugins</h1>
        <div className="flex items-center gap-2">
          {allCats.map(c => (
            <button
              type="button"
              key={c}
              onClick={() => setActive(c)}
              className={`px-3 py-1.5 rounded-lg border text-sm ${active===c ? 'bg-brand-600 border-brand-500 text-white' : 'bg-neutral-900 border-neutral-700 hover:bg-neutral-800'}`}
            >{c}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="w-full sm:w-96 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm"
          placeholder="Buscar plugin…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <span className="text-xs text-neutral-400">{filtered.length} resultado(s)</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map(p => (
          <PluginCard
            key={`${p.category}:${p.name}`}
            name={p.name}
            desc={p.desc}
            icon={p.icon}
            tip={p.tip}
            configHref={p.configHref}
            viewHref={p.viewHref}
            badge={p.badge || (isGuildSelected ? 'Ativo' : 'Selecione Servidor')}
            gradient={p.gradient}
          />
        ))}
      </div>
    </div>
  )
}
