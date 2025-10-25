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
  const clear = () => {
    setGuildId('', true)
    setValue('')
    setSaved(null)
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
      <button onClick={clear} className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs hover:bg-neutral-800">
        Clear
      </button>
      {saved && <span className="text-xs text-neutral-400">Saved: {saved}</span>}
    </div>
  )
}
