const logger = require('../utils/logger');
export function getGuildId(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  const param = url.searchParams.get('guildId')
  if (param) {
    console.log('[getGuildId] Found in URL params:', param)
    return param
  }
  const saved = localStorage.getItem('guildId')
  console.log('[getGuildId] Found in localStorage:', saved)
  return saved
}

export function setGuildId(id: string, updateUrl: boolean = true) {
  if (typeof window === 'undefined') return
  const trimmed = (id || '').trim()
  console.log('[setGuildId] Setting guildId:', trimmed)
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
      console.log('[setGuildId] URL updated:', url.toString())
    } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }
  }
  // Dispara evento customizado para notificar outros componentes
  try {
    window.dispatchEvent(new Event('guildIdChanged'))
    console.log('[setGuildId] Event dispatched: guildIdChanged')
  } catch (e) { logger.debug('Caught error:', (e instanceof Error ? e.message : String(e))); }
}

// Hydration-safe hook: returns null on the server and during the first client render,
// then resolves the stored guildId (from URL param or localStorage) after mount.
// This ensures SSR markup matches the first client render, preventing hydration mismatches
// caused by reading window/localStorage synchronously.
import { useEffect, useState } from 'react'

export function useGuildId(): string | null {
  const [id, setId] = useState<string | null>(null)
  
  useEffect(() => {
    const updateId = () => setId(getGuildId())
    
    updateId()
    
    // Listener para mudanças no guildId
    window.addEventListener('guildIdChanged', updateId)
    
    return () => {
      window.removeEventListener('guildIdChanged', updateId)
    }
  }, [])
  
  return id
}

// Hook with loading state - use this in pages to avoid showing EmptyState during hydration
export function useGuildIdWithLoading(): { guildId: string | null; loading: boolean } {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const updateGuildId = () => {
      const id = getGuildId()
      console.log('[useGuildIdWithLoading] Updated guildId:', id)
      setGuildId(id)
      setLoading(false)
    }
    
    updateGuildId()
    
    // Listener para mudanças no guildId
    const handleGuildChange = () => {
      console.log('[useGuildIdWithLoading] guildIdChanged event received')
      updateGuildId()
    }
    window.addEventListener('guildIdChanged', handleGuildChange)
    
    return () => {
      window.removeEventListener('guildIdChanged', handleGuildChange)
    }
  }, [])

  return { guildId, loading }
}
