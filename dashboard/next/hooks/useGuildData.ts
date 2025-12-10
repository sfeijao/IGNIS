import { useState, useEffect, useCallback, useRef } from 'react'

interface Channel {
  id: string
  name: string
  type: number
  typeName: string
  parentId?: string | null
  parentName?: string | null
  position?: number
}

interface Role {
  id: string
  name: string
  color: string
  position: number
  managed: boolean
  hoist: boolean
  mentionable: boolean
  manageable: boolean
}

interface UseChannelsOptions {
  types?: number[]
  includeCategories?: boolean
  autoFetch?: boolean
}

interface UseRolesOptions {
  autoFetch?: boolean
}

/**
 * Hook para carregar canais de um servidor
 * Evita loops infinitos e gerencia cache automaticamente
 */
export function useChannels(guildId: string | null | undefined, options: UseChannelsOptions = {}) {
  const { types, includeCategories = false, autoFetch = true } = options

  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchedRef = useRef(false)

  const fetchChannels = useCallback(async () => {
    if (!guildId) {
      setChannels([])
      setError('No guild selected')
      return
    }

    // Prevent duplicate fetches
    if (fetchedRef.current && channels.length > 0) {
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (types && types.length > 0) {
        params.set('type', types.join(','))
      }
      if (includeCategories) {
        params.set('includeCategories', 'true')
      }

      const res = await fetch(`/api/guild/${guildId}/channels?${params}`, {
        signal: abortControllerRef.current.signal
      })
      const data = await res.json()

      if (data.success) {
        setChannels(data.channels || [])
        fetchedRef.current = true
        setError(null)
      } else {
        setError(data.error || 'Failed to load channels')
        setChannels([])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Failed to load channels')
        setChannels([])
      }
    } finally {
      setLoading(false)
    }
  }, [guildId, types, includeCategories])

  // Auto-fetch on mount or when guildId changes
  useEffect(() => {
    if (autoFetch && guildId) {
      fetchedRef.current = false // Reset flag when guild changes
      fetchChannels()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [guildId, autoFetch, fetchChannels])

  const refetch = useCallback(() => {
    fetchedRef.current = false
    fetchChannels()
  }, [fetchChannels])

  return { channels, loading, error, refetch }
}

/**
 * Hook para carregar roles de um servidor
 * Evita loops infinitos e gerencia cache automaticamente
 */
export function useRoles(guildId: string | null | undefined, options: UseRolesOptions = {}) {
  const { autoFetch = true } = options

  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [botMaxPosition, setBotMaxPosition] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const fetchedRef = useRef(false)

  const fetchRoles = useCallback(async () => {
    if (!guildId) {
      setRoles([])
      setError('No guild selected')
      return
    }

    // Prevent duplicate fetches
    if (fetchedRef.current && roles.length > 0) {
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/guild/${guildId}/roles`, {
        signal: abortControllerRef.current.signal
      })
      const data = await res.json()

      if (data.success) {
        setRoles(data.roles || [])
        setBotMaxPosition(data.botMax || 0)
        fetchedRef.current = true
        setError(null)
      } else {
        setError(data.error || 'Failed to load roles')
        setRoles([])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Failed to load roles')
        setRoles([])
      }
    } finally {
      setLoading(false)
    }
  }, [guildId])

  // Auto-fetch on mount or when guildId changes
  useEffect(() => {
    if (autoFetch && guildId) {
      fetchedRef.current = false // Reset flag when guild changes
      fetchRoles()
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [guildId, autoFetch, fetchRoles])

  const refetch = useCallback(() => {
    fetchedRef.current = false
    fetchRoles()
  }, [fetchRoles])

  return { roles, loading, error, botMaxPosition, refetch }
}

/**
 * Hook para buscar membros
 */
export function useMembers(guildId: string | null | undefined) {
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const searchMembers = useCallback(async (query: string = '', roleId: string = '', limit: number = 10) => {
    if (!guildId) {
      setMembers([])
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (roleId) params.set('roleId', roleId)
      if (limit) params.set('limit', limit.toString())

      const res = await fetch(`/api/guild/${guildId}/members/search?${params}`, {
        signal: abortControllerRef.current.signal
      })
      const data = await res.json()

      if (data.success) {
        setMembers(data.members || [])
        setError(null)
      } else {
        setError(data.error || 'Failed to search members')
        setMembers([])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError('Failed to search members')
        setMembers([])
      }
    } finally {
      setLoading(false)
    }
  }, [guildId])

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return { members, loading, error, searchMembers }
}
