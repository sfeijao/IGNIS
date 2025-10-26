import PluginCard from '@/components/PluginCard'

export default function PluginsPage() {
  const plugins = [
    { name: 'Moderação', desc: 'Automod, logs, ações e auditoria.', icon: 'shield' as const, tip: 'Configure regras, mod-logs e automod.', href: '/moderation' },
    { name: 'Logs', desc: 'Registos de moderação com filtros e export.', icon: 'info' as const, tip: 'Filtrar e exportar logs.', href: '/logs' },
    { name: 'Tickets', desc: 'Gestão de tickets e painéis.', icon: 'tickets' as const, tip: 'Crie painéis e gerencie filas.', href: '/tickets' },
    { name: 'Tags', desc: 'Respostas rápidas e painéis.', icon: 'tag' as const, tip: 'Defina atalhos e coleções.', href: '/tags' },
    { name: 'Webhooks', desc: 'Gerir webhooks e auto-setup.', icon: 'plugins' as const, tip: 'Criar e testar webhooks.', href: '/webhooks' },
    { name: 'Verificação', desc: 'Configurar sistema de verificação.', icon: 'shield' as const, tip: 'Captcha e cargos.', href: '/verification' },
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plugins</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {plugins.map((p) => (
          <PluginCard key={p.name} name={p.name} desc={p.desc} icon={p.icon} tip={p.tip} href={p.href} />
        ))}
      </div>
    </div>
  )
}
