"use client"

import { useEffect, useMemo, useState } from 'react'
import PluginCard from '@/components/PluginCard'
import { useGuildIdWithLoading } from '@/lib/guild'

type Plugin = { name: string; desc: string; icon: any; tip?: string; href?: string; configHref?: string; viewHref?: string; badge?: string; gradient?: string }
type Category = { title: string; items: Plugin[]; icon?: string }

export default function PluginsPage() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<string>('Todas')
  const { guildId, loading } = useGuildIdWithLoading()
  const isGuildSelected = !!guildId

  const categories: Category[] = [
    {
      title: 'Funcionalidades do Servidor',
      icon: '⚙️',
      items: [
        { name: 'Boas-Vindas & Despedidas', desc: 'Configure mensagens personalizadas para novos membros e saídas.', icon: '👋', tip: 'Mensagens de boas-vindas com placeholders {user}, {server}, embeds personalizados.', configHref: guildId ? `/guild/${guildId}/welcome` : '#', viewHref: guildId ? `/guild/${guildId}/welcome` : '#', badge: 'Beta', gradient: 'from-green-600/20 to-emerald-600/20' },
        { name: 'Estatísticas do Servidor', desc: 'Configure canais de voz com estatísticas em tempo real.', icon: '📊', tip: 'Contadores automáticos: membros totais, online, bots, canais, cargos.', configHref: guildId ? `/guild/${guildId}/stats` : '#', viewHref: guildId ? `/guild/${guildId}/stats` : '#', badge: 'Beta', gradient: 'from-blue-600/20 to-cyan-600/20' },
        { name: 'Time Tracking', desc: 'Sistema de controlo de tempo de trabalho/presença dos membros.', icon: '⏱️', tip: 'Os utilizadores podem usar comandos do Discord para registar entrada, pausa e continuação.', configHref: guildId ? `/guild/${guildId}/time-tracking` : '#', viewHref: guildId ? `/guild/${guildId}/time-tracking` : '#', badge: 'Beta', gradient: 'from-orange-600/20 to-red-600/20' },
      ]
    },
    {
      title: 'Essenciais',
      icon: '🛡️',
      items: [
        { name: 'Moderação', desc: 'Automod, logs, ações e auditoria completa.', icon: '🛡️', tip: 'Configure regras, mod-logs e automod para manter seu servidor seguro.', configHref: '/moderation', viewHref: '/moderation', gradient: 'from-red-600/20 to-orange-600/20' },
        { name: 'Verificação', desc: 'Sistema de verificação com captcha e cargos.', icon: '✅', tip: 'Proteja seu servidor contra raids com sistema de verificação.', configHref: '/verification', viewHref: '/verification', gradient: 'from-purple-600/20 to-pink-600/20' },
      ]
    },
    {
      title: 'Gestão do Servidor',
      icon: '📋',
      items: [
        { name: 'Tickets', desc: 'Sistema completo de tickets com painéis e categorias.', icon: '🎫', tip: 'Crie painéis de tickets, gerencie filas e categorias.', configHref: '/tickets/config', viewHref: '/tickets', gradient: 'from-blue-600/20 to-indigo-600/20' },
        { name: 'Tags', desc: 'Respostas rápidas e painéis de tags personalizadas.', icon: '🏷️', tip: 'Defina atalhos de texto e coleções organizadas.', configHref: '/tags', viewHref: '/tags', gradient: 'from-yellow-600/20 to-orange-600/20' },
        { name: 'Webhooks', desc: 'Gestão avançada de webhooks com auto-setup.', icon: '🔗', tip: 'Criar, testar e gerenciar webhooks facilmente.', configHref: '/webhooks', viewHref: '/webhooks', gradient: 'from-teal-600/20 to-green-600/20' },
        { name: 'Membros', desc: 'Gestão de membros e permissões do servidor.', icon: '👥', tip: 'Visualize, pesquise e gerencie membros.', configHref: '/members', viewHref: '/members', gradient: 'from-cyan-600/20 to-blue-600/20' },
        { name: 'Cargos', desc: 'Gerenciamento completo de cargos e permissões.', icon: '🎭', tip: 'Edite cargos, cores e permissões detalhadas.', configHref: '/roles', viewHref: '/roles', gradient: 'from-pink-600/20 to-rose-600/20' },
      ]
    },
    {
      title: 'Entretenimento',
      icon: '🎮',
      items: [
        { name: 'Giveaways', desc: 'Sistema completo de sorteios e giveaways.', icon: '🎉', tip: 'Crie sorteios com requisitos, timer e winners automáticos.', configHref: '/giveaways', viewHref: '/giveaways', gradient: 'from-violet-600/20 to-purple-600/20' },
      ]
    },
    {
      title: 'Ferramentas',
      icon: '🔧',
      items: [
        { name: 'Comandos', desc: 'Lista e gestão de todos os comandos do bot.', icon: '⌨️', tip: 'Visualize comandos disponíveis e suas permissões.', configHref: '/commands', viewHref: '/commands', gradient: 'from-gray-600/20 to-slate-600/20' },
        { name: 'Automod', desc: 'Moderação automática com filtros avançados.', icon: '🤖', tip: 'Configure filtros de spam, palavras proibidas e mais.', configHref: '/automod', viewHref: '/automod', gradient: 'from-red-600/20 to-orange-600/20' },
        { name: 'Apelos', desc: 'Sistema de appeals para punições.', icon: '📝', tip: 'Permita que usuários apelem bans e mutes.', configHref: '/appeals', viewHref: '/appeals', gradient: 'from-indigo-600/20 to-blue-600/20' },
        { name: 'Diagnósticos', desc: 'Ferramentas de diagnóstico e debug.', icon: '🔍', tip: 'Verifique status do bot e conexões.', configHref: '/diagnostics', viewHref: '/diagnostics', gradient: 'from-amber-600/20 to-yellow-600/20' },
        { name: 'Performance', desc: 'Métricas e performance do bot.', icon: '📈', tip: 'Monitore uso de CPU, memória e latência.', configHref: '/performance', viewHref: '/performance', gradient: 'from-green-600/20 to-emerald-600/20' },
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Plugins & Sistemas
          </h1>
          <p className="text-sm text-gray-400 mt-1">Configure e gerencie todas as funcionalidades do IGNIS</p>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {allCats.map(c => (
          <button
            type="button"
            key={c}
            onClick={() => setActive(c)}
            className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all whitespace-nowrap ${
              active === c
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 border-purple-500 text-white shadow-lg shadow-purple-500/50'
                : 'bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 pl-10 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            placeholder="🔍 Buscar sistema ou funcionalidade..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
        </div>
        <div className="px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-gray-400">
          <span className="font-semibold text-purple-400">{filtered.length}</span> {filtered.length === 1 ? 'sistema' : 'sistemas'}
        </div>
      </div>

      {/* Plugins Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhum sistema encontrado</h3>
          <p className="text-gray-500">Tente ajustar sua pesquisa ou filtros</p>
        </div>
      )}
    </div>
  )
}
