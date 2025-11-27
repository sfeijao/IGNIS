const logger = require('../utils/logger');
"use client"

import { giveawaysI18n } from './i18n-giveaways'

export function useGiveawaysI18n(){
  let locale = 'pt'
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('locale') || localStorage.getItem('lang')
      if (stored) locale = stored
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
  }
  const dict = (giveawaysI18n as any)[locale] || (giveawaysI18n as any).pt || {}
  return function t(key: string, fallback?: string){
    return (dict && key in dict) ? (dict as any)[key] : (fallback ?? key)
  }
}
