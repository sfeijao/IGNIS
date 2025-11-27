"use client"

import { useEffect, useRef } from 'react'
const logger = require('../utils/logger');

type ErrorWithMessage = { message?: string };

type DashboardEvent = {
  type: string
  giveawayId?: string
  userId?: string
  winners?: string[]
  seed?: string
}

export default function useGiveawaySocket(guildId: string | null | undefined, onEvent: (evt: DashboardEvent) => void){
  const handlerRef = useRef(onEvent)
  handlerRef.current = onEvent

  useEffect(() => {
    if (!guildId) return
    let socket: any = null
    let disposed = false
    ;(async () => {
      try {
        const mod = await import('socket.io-client')
        if (disposed) return
        const io = mod.io || (mod as any).default
        socket = io({ withCredentials: true })
        socket.on('connect', () => {
          try { socket.emit('joinGuild', guildId) } catch (e) { logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); }
        })
        socket.on('dashboard_event', (payload: DashboardEvent) => {
          try { handlerRef.current && handlerRef.current(payload) } catch (e) { logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); }
        })
      } catch (e) { logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); }
    })()
    return () => {
      disposed = true
      try { socket && socket.disconnect && socket.disconnect() } catch (e) { logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); }
    }
  }, [guildId])
}
