type Props = { name: string; desc: string; badge?: string }

export default function PluginCard({ name, desc, badge = 'Beta' }: Props) {
  return (
    <article className="card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{name}</h3>
        <span className="badge">{badge}</span>
      </div>
      <p className="text-neutral-300 text-sm flex-1">{desc}</p>
      <div className="flex gap-2">
        <button className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium">Configurar</button>
        <button className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700">Ver</button>
      </div>
    </article>
  )
}
