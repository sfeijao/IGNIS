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
    let reconnectTimer: NodeJS.Timeout | null = null
    
    const connect = async () => {
      try {
        const mod = await import('socket.io-client')
        if (disposed) return
        const io = mod.io || (mod as any).default
        
        socket = io({
          withCredentials: true,
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
          timeout: 20000
        })
        
        socket.on('connect', () => {
          try { 
            logger.debug('Socket connected, joining guild:', guildId)
            socket.emit('joinGuild', guildId) 
          } catch (e) { 
            logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); 
          }
        })
        
        socket.on('connect_error', (err: any) => {
          logger.debug('Socket connection error:', err?.message || err)
        })
        
        socket.on('disconnect', (reason: string) => {
          logger.debug('Socket disconnected:', reason)
        })
        
        socket.on('dashboard_event', (payload: DashboardEvent) => {
          try { 
            handlerRef.current && handlerRef.current(payload) 
          } catch (e) { 
            logger.debug('Caught error:', (e as ErrorWithMessage)?.message || e); 
          }
        })
      } catch (e) { 
        logger.debug('Socket initialization error:', (e as ErrorWithMessage)?.message || e); 
      }
    }
    
    connect()
    
    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      try { 
        if (socket && socket.disconnect) {
          socket.removeAllListeners()
          socket.disconnect() 
        }
      } catch (e) { 
        logger.debug('Socket cleanup error:', (e as ErrorWithMessage)?.message || e); 
      }
    }
  }, [guildId])
}
