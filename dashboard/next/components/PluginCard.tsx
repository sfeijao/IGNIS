"use client"
import Link from 'next/link'
import { Icon, IconName } from './icons'

type Props = {
  name: string
  desc: string
  badge?: string
  icon?: IconName
  tip?: string
  href?: string
  configHref?: string
  viewHref?: string
}

export default function PluginCard({ name, desc, badge, icon = 'plugins', tip, href, configHref, viewHref }: Props) {
  // Ensure links work when the Next export is served under "/next" basePath
  const finalHref = (() => {
    if (!href) return undefined
    if (href.startsWith('/next')) return href
    if (typeof window !== 'undefined') {
      const onNextBase = window.location.pathname.startsWith('/next')
      return onNextBase ? `/next${href}` : href
    }
    return href
  })()
  const withBase = (u?: string) => {
    if (!u) return undefined
    if (u.startsWith('/next')) return u
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/next')) return `/next${u}`
    return u
  }
  const finalConfig = withBase(configHref) || finalHref
  const finalView = withBase(viewHref) || finalHref
  return (
    <article className="card p-5 flex flex-col gap-3 transition-transform hover:-translate-y-0.5 hover:shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg inline-flex items-center" aria-hidden><Icon name={icon} /></span>
          <h3 className="font-semibold">{name}</h3>
        </div>
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
      <p className="text-neutral-300 text-sm flex-1">{desc}</p>
      <div className="flex gap-2">
        {finalConfig || finalView ? (
          <>
            <Link href={finalConfig || '#'} className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium transition-all hover:animate-glow" aria-label={`Configurar ${name}`}>Configurar</Link>
            <Link href={finalView || finalConfig || '#'} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors" aria-label={`Ver ${name}`}>Ver</Link>
          </>
        ) : (
          <>
            <button type="button" className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium transition-all hover:animate-glow">Configurar</button>
            <button type="button" className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors">Ver</button>
          </>
        )}
        {tip && (
          <span className="tip ml-auto text-neutral-400 text-xs inline-flex items-center" data-tip={tip} aria-label="Info">
            <Icon name="info" />
          </span>
        )}
      </div>
    </article>
  )
}
