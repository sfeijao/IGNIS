"use client"

import Link from 'next/link'
import DashboardStats from '@/components/DashboardStats'
import PluginCard from '@/components/PluginCard'
import { useI18n } from '@/lib/i18n'

export default function HomePage() {
  const { t } = useI18n()
  return (
    <main className="space-y-8">
      <section className="grid md:grid-cols-2 gap-6 items-center">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Bem-vindo ao Centro de Moderação
          </h1>
          <p className="text-neutral-300">
            Uma experiência moderna, rápida e responsiva para gerir o teu servidor Discord.
          </p>
          <div className="flex gap-3">
            <Link href="/moderation" className="inline-flex items-center rounded-xl px-4 py-2 bg-brand-600 hover:bg-brand-700 transition text-white font-medium">Moderação</Link>
            <Link href="/tickets" className="inline-flex items-center rounded-xl px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition border border-neutral-700">{t('nav.tickets')}</Link>
          </div>
        </div>
        <DashboardStats />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Funcionalidades</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {name:'Moderação',desc:'Automod, logs, ações e auditoria.', icon:'shield' as const, tip:'Configure regras, mod-logs e automod.', configHref: '/moderation', viewHref: '/moderation'},
            {name:'Tickets',desc:'Gestão de tickets e painéis.', icon:'tickets' as const, tip:'Crie painéis e gerencie filas.', configHref: '/tickets/config', viewHref: '/tickets'},
            {name:'Tags',desc:'Respostas rápidas e painéis.', icon:'tag' as const, tip:'Defina atalhos e coleções.', configHref: '/tags', viewHref: '/tags'},
          ].map((p) => (
            <PluginCard key={p.name} name={p.name} desc={p.desc} icon={p.icon} tip={p.tip} configHref={p.configHref} viewHref={p.viewHref} />
          ))}
        </div>
      </section>
    </main>
  )
}
