"use client"
import Link from 'next/link'
import { Icon, IconName } from './icons'

type Props = {
  name: string
  desc: string
  badge?: string
  icon?: IconName | string
  tip?: string
  href?: string
  configHref?: string
  viewHref?: string
  gradient?: string
}

export default function PluginCard({ name, desc, badge, icon = 'plugins', tip, href, configHref, viewHref, gradient }: Props) {
  // With Next.js basePath configured, pass clean hrefs (without manual "/next" prefix)
  const finalConfig = configHref || href
  const finalView = viewHref || href
  
  // Determine gradient based on category or use default
  const gradientClass = gradient || 'from-purple-600/20 to-pink-600/20'
  
  return (
    <article className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-purple-500/20">
      <div className={`bg-gradient-to-r ${gradientClass} border-b border-gray-700/50 px-5 py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {typeof icon === 'string' && icon.length <= 2 ? (
            <span className="text-2xl" aria-hidden>{icon}</span>
          ) : (
            <span className="text-xl inline-flex items-center" aria-hidden><Icon name={icon as IconName} /></span>
          )}
          <h3 className="font-bold text-lg">{name}</h3>
        </div>
        {badge && (
          <span className="px-3 py-1 bg-purple-600/30 border border-purple-500/50 rounded-full text-xs font-semibold text-purple-300">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5 space-y-4">
        <p className="text-gray-300 text-sm leading-relaxed min-h-[40px]">{desc}</p>
        <div className="flex gap-2 pt-2">
          {finalConfig || finalView ? (
            <>
              <Link 
                href={finalConfig || '#'} 
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-center text-sm"
                aria-label={`Configurar ${name}`}
              >
                ⚙️ Configurar
              </Link>
              <Link 
                href={finalView || finalConfig || '#'} 
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 transition-all duration-200 text-center text-sm"
                aria-label={`Ver ${name}`}
              >
                👁️ Ver
              </Link>
            </>
          ) : (
            <>
              <button type="button" className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-medium transition-all duration-200 transform hover:scale-[1.02] text-sm">⚙️ Configurar</button>
              <button type="button" className="flex-1 px-4 py-2.5 rounded-lg bg-gray-700/50 hover:bg-gray-700 border border-gray-600/50 transition-all duration-200 text-sm">👁️ Ver</button>
            </>
          )}
        </div>
        {tip && (
          <div className="pt-3 border-t border-gray-700/30">
            <p className="text-xs text-gray-400 leading-relaxed">
              💡 {tip}
            </p>
          </div>
        )}
      </div>
    </article>
  )
}
