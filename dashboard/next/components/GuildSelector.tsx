"use client"

import { useEffect, useState } from 'react'
import { getGuildId, setGuildId } from '@/lib/guild'

export default function GuildSelector() {
  const [value, setValue] = useState('')
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    setSaved(getGuildId())
    setValue(getGuildId() || '')
  }, [])

  const save = () => {
    setGuildId(value, true)
    setSaved(value || null)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="w-44 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
        placeholder="Guild ID"
        value={value}
        onChange={e => setValue(e.target.value)}
      />
      <button onClick={save} className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
        Save
      </button>
      {saved && <span className="text-xs text-neutral-400">Saved</span>}
    </div>
  )
}
