const logger = require('../utils/logger');

// Extract guildId from URL path if present (e.g., /guild/123/settings)
function getGuildIdFromPath(): string | null {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(/\/guild\/(\d+)/)
  return match ? match[1] : null
}

export function getGuildId(): string | null {
  if (typeof window === 'undefined') return null
  
  // Priority 1: URL path segment (e.g., /guild/123/settings)
  const pathId = getGuildIdFromPath()
  if (pathId) {
    console.log('[getGuildId] Found in URL path:', pathId)
    return pathId
  }
  
  // Priority 2: URL query param
  const url = new URL(window.location.href)
  const param = url.searchParams.get('guildId')
  if (param) {
    console.log('[getGuildId] Found in URL params:', param)
    return param
  }
  
  // Priority 3: localStorage
  const saved = localStorage.getItem('guildId')
  if (saved) {
    console.log('[getGuildId] Found in localStorage:', saved)
  }
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
      
      // Update URL path if it contains /guild/[gid]/ pattern
      const pathMatch = url.pathname.match(/^(.*\/guild\/)(\d+)(\/.*)$/)
      if (pathMatch && trimmed) {
        // Replace the guild ID in the path
        url.pathname = pathMatch[1] + trimmed + pathMatch[3]
        console.log('[setGuildId] Updated path segment')
      }
      
      // Also update query param for consistency
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
