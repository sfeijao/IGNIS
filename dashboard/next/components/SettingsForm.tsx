'use client'

import { useEffect, useState } from 'react'
import type React from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'

type Settings = {
  prefix: string
  locale: string
  logsEnabled: boolean
  modlogChannelId: string
}

const defaults: Settings = {
  prefix: '!',
  locale: 'pt',
  logsEnabled: true,
  modlogChannelId: ''
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(defaults)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const guildId = typeof window !== 'undefined' ? getGuildId() : null

  useEffect(() => {
    if (!guildId) return
    // attempt load; if endpoint not ready, keep defaults silently
    ;(async () => {
      try {
        const data = await api.getSettings?.(guildId)
        if (data) {
          setSettings({
            prefix: data.prefix ?? defaults.prefix,
            locale: data.locale ?? defaults.locale,
            logsEnabled: data.logsEnabled ?? defaults.logsEnabled,
            modlogChannelId: data.modlogChannelId ?? defaults.modlogChannelId,
          })
        }
      } catch {}
      setLoaded(true)
    })()
  }, [guildId])

  const save = async () => {
    if (!guildId) return
    setSaving(true)
    try {
      await api.postSettings?.(guildId, settings)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="card p-5 max-w-xl space-y-4" onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); save() }}>
      <div>
        <label htmlFor="prefix" className="block text-sm mb-1">Prefix</label>
        <input
          id="prefix"
          title="Command prefix"
          placeholder="!"
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.prefix}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, prefix: e.target.value }))}
        />
      </div>
      <div>
        <label htmlFor="locale" className="block text-sm mb-1">Locale</label>
        <select
          id="locale"
          title="Preferred language"
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.locale}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings((s: Settings) => ({ ...s, locale: e.target.value }))}
        >
          <option value="pt">Português</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <input
          id="logsEnabled"
          type="checkbox"
          className="h-4 w-4"
          checked={settings.logsEnabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, logsEnabled: e.target.checked }))}
        />
        <label htmlFor="logsEnabled" className="text-sm">Enable moderation logs</label>
      </div>
      <div>
        <label htmlFor="modlog" className="block text-sm mb-1">Mod-log Channel ID</label>
        <input
          id="modlog"
          title="Channel ID for moderation logs"
          placeholder="1234567890"
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.modlogChannelId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, modlogChannelId: e.target.value }))}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">
          {saving ? 'Saving…' : (loaded ? 'Save settings' : 'Loading…')}
        </button>
      </div>
    </form>
  )
}
