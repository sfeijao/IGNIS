import { useCallback } from 'react'

// Basic translations structure
const translations: Record<string, any> = {
  invites: {
    title: 'Invite Tracking',
    stats: 'Statistics'
  },
  common: {
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel'
  }
}

/**
 * Hook para internacionalização (i18n)
 * Retorna função de tradução baseada nas translations
 */
export function useI18n() {
  const t = useCallback((key: string): string => {
    const keys = key.split('.')
    let value: any = translations
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        return key // Retorna a key se não encontrar tradução
      }
    }
    
    return typeof value === 'string' ? value : key
  }, [])

  return { t }
}

