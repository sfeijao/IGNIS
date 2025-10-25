import PluginCard from '@/components/PluginCard'

export default function PluginsPage() {
  const plugins = [
    { name: 'Moderação', desc: 'Automod, logs, ações e auditoria.', icon: 'shield' as const, tip: 'Configure regras, mod-logs e automod.' },
    { name: 'Tickets', desc: 'Gestão de tickets e painéis.', icon: 'tickets' as const, tip: 'Crie painéis e gerencie filas.' },
    { name: 'Tags', desc: 'Respostas rápidas e painéis.', icon: 'tag' as const, tip: 'Defina atalhos e coleções.' },
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plugins</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {plugins.map((p) => (
          <PluginCard key={p.name} name={p.name} desc={p.desc} icon={p.icon} tip={p.tip} />
        ))}
      </div>
    </div>
  )
}
