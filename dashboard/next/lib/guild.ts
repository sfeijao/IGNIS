const logger = require('../utils/logger');
export function getGuildId(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const param = url.searchParams.get('guildId')
  if (param) return param
  const saved = localStorage.getItem('guildId')
  return saved
}

export function setGuildId(id: string, updateUrl: boolean = true) {
  if (typeof window === 'undefined') return
  const trimmed = (id || '').trim()
  if (trimmed) {
    localStorage.setItem('guildId', trimmed)
  } else {
    localStorage.removeItem('guildId')
  }
  if (updateUrl) {
    try {
      const url = new URL(window.location.href)
      if (trimmed) url.searchParams.set('guildId', trimmed)
      else url.searchParams.delete('guildId')
      window.history.replaceState({}, '', url.toString())
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
  }
}

// Hydration-safe hook: returns null on the server and during the first client render,
// then resolves the stored guildId (from URL param or localStorage) after mount.
// This ensures SSR markup matches the first client render, preventing hydration mismatches
// caused by reading window/localStorage synchronously.
import { useEffect, useState } from 'react'

export function useGuildId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => {
    setId(getGuildId())
  }, [])
  return id
}

// Hook with loading state - use this in pages to avoid showing EmptyState during hydration
export function useGuildIdWithLoading(): { guildId: string | null; loading: boolean } {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = getGuildId()
    setGuildId(id)
    setLoading(false)
  }, [])

  return { guildId, loading }
}
