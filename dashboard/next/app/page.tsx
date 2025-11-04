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
            Bem-vindo ao novo Centro de Moderação
          </h1>
          <p className="text-neutral-300">
            Uma experiência moderna, rápida e responsiva — inspirada no MEE6 — mantendo a compatibilidade com seus sistemas atuais.
          </p>
          <div className="flex gap-3">
            <Link href="/plugins" className="inline-flex items-center rounded-xl px-4 py-2 bg-brand-600 hover:bg-brand-700 transition text-white font-medium">Explorar plugins</Link>
            <Link href="/tickets" className="inline-flex items-center rounded-xl px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition border border-neutral-700">{t('nav.tickets')}</Link>
            <a href="/moderation-react.html" className="inline-flex items-center rounded-xl px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition border border-neutral-700">{t('nav.moderation.center')}</a>
          </div>
        </div>
        <DashboardStats />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('nav.plugins')}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {name:'Moderação',desc:'Automod, logs, ações e auditoria.', icon:'shield' as const, tip:'Configure regras, mod-logs e automod.'},
            {name:'Tickets',desc:'Gestão de tickets e painéis.', icon:'tickets' as const, tip:'Crie painéis e gerencie filas.'},
            {name:'Tags',desc:'Respostas rápidas e painéis.', icon:'tag' as const, tip:'Defina atalhos e coleções.'},
          ].map((p) => (
            <PluginCard key={p.name} name={p.name} desc={p.desc} icon={p.icon} tip={p.tip} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t('nav.tickets')}</h2>
        <div className="card p-5">
          <p className="text-neutral-300 text-sm">A nova interface de Tickets será conectada ao adaptador para o sistema atual. Esta é uma prévia do layout.</p>
        </div>
      </section>
    </main>
  )
}
