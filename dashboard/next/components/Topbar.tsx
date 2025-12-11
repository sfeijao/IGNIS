'use client'

import Link from 'next/link'
const logger = require('../utils/logger');
import ThemeToggle from './ThemeToggle'
import LanguageSwitcher from './LanguageSwitcher'
import MobileSidebar from './MobileSidebar'
import { useEffect, useState } from 'react'
import GuildSelector from './GuildSelector'
import { setGuildId, useGuildId } from '@/lib/guild'
import UserAvatar from './UserAvatar'
import { useAuth } from '../hooks/useAuth'
import { useI18n } from '../lib/i18n'

export default function Topbar() {
  const { t } = useI18n()
  const [compact, setCompact] = useState(false)
  const { user, loading } = useAuth()
  const mountedGuildId = useGuildId()

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-compact')
    const isCompact = saved === '1' || document.body.classList.contains('sidebar-compact')
    setCompact(isCompact)
  }, [])

  // Persist guildId from URL param as a quick shortcut
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const gid = url.searchParams.get('guildId')
      if (gid) setGuildId(gid, false)
    } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }
  }, [])

  const toggleCompact = () => {
    const next = !compact
    setCompact(next)
    document.body.classList.toggle('sidebar-compact', next)
    localStorage.setItem('sidebar-compact', next ? '1' : '0')
  }
  return (
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/70 backdrop-blur">
      <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MobileSidebar />
          <button type="button"
            onClick={toggleCompact}
            className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
            title={t('common.toggleCompact')}
          >
            {compact ? '⇤' : '⇥'}
          </button>
          <Link href="/" className="font-bold">{t('nav.dashboard')}</Link>
          <Link href="/moderation" className="text-sm text-neutral-300 hover:text-white">{t('nav.moderation.center')}</Link>
        </div>
        <div className="flex items-center gap-3">
          <GuildSelector />
          {mountedGuildId === null ? null : (!mountedGuildId && (
            <span className="text-xs px-2 py-1 rounded border border-amber-600/40 bg-amber-500/10 text-amber-300" title={t('common.selectGuild')}>Selecione um servidor</span>
          ))}
          <LanguageSwitcher />
          <ThemeToggle />
          {loading ? (
            <div className="hidden sm:flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-neutral-800 border border-neutral-700 animate-pulse" aria-label={t('common.loading')} />
              <span className="sr-only">{t('common.loading')}</span>
            </div>
          ) : user ? (
            <>
              <div className="hidden sm:flex items-center gap-2"><UserAvatar /></div>
              <a href="/logout" className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700" title={t('auth.logout')}>{t('auth.logout')}</a>
            </>
          ) : (
            <a href="/auth/discord" className="rounded-xl border border-brand-600 bg-brand-600/90 hover:bg-brand-600 px-3 py-2 text-sm" title={t('auth.login')}>{t('auth.login')}</a>
          )}
        </div>
      </div>
    </header>
  )
}
