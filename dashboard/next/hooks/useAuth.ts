"use client"

import { useEffect, useState } from 'react'

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/user', { credentials: 'include' })
        if (!res.ok) throw new Error('not-authenticated')
  const data = await res.json()
  // API shape: { success: true, user: { id, username, discriminator, avatar } }
  if (mounted) setUser(data?.user ?? null)
      } catch {
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  return { user, loading, logoutUrl: '/logout' }
}
