'use client'

import { useEffect, useState } from 'react'
const logger = require('../utils/logger');

type User = { id: string; username: string; discriminator: string; avatar: string | null }

export default function UserAvatar() {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    let aborted = false
    ;(async () => {
      try {
        const r = await fetch('/api/user', { credentials: 'include' })
        if (!r.ok) return
        const d = await r.json()
        if (!aborted && d && d.success && d.user) setUser(d.user)
      } catch (e) { logger.debug('Caught error:', e?.message || e); }
    })()
    return () => { aborted = true }
  }, [])

  if (!user) {
    return (
      <div
        className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-500 to-blue-500 flex items-center justify-center text-xs font-bold border border-neutral-700"
        title="Perfil"
      >
        IG
      </div>
    )
  }

  return (
    <img
      src={user.avatar || undefined}
      alt={user.username}
      title={`${user.username}#${user.discriminator}`}
      className="h-9 w-9 rounded-full border border-neutral-700 object-cover"
      referrerPolicy="no-referrer"
    />
  )
}
