'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { api } from '@/lib/apiClient'
import { getGuildId } from '@/lib/guild'
import { useI18n } from '@/lib/i18n'

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
  const { t } = useI18n()
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])

  const isTextChannel = (ch: { id: string; name: string; type?: string }) => {
    const t = String(ch.type || '').toLowerCase()
    return t.includes('text') || t.includes('announcement')
  }
  const channelTypeLabel = (ch: { type?: string } | string | undefined) => {
    const t = typeof ch === 'string' ? ch : (ch?.type || '')
    switch (String(t).toLowerCase()) {
      case 'guild_text':
      case 'text': return 'Text'
      case 'guild_announcement':
      case 'announcement': return 'Announcement'
      case 'guild_voice':
      case 'voice': return 'Voice'
      case 'guild_category':
      case 'category': return 'Category'
      default: return 'Channel'
    }
  }

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
      try {
        const ch = await api.getChannels(guildId)
        setChannels(ch.channels || ch || [])
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
        <label htmlFor="prefix" className="block text-sm mb-1">{t('settings.prefix')}</label>
        <input
          id="prefix"
          title={t('settings.prefix')}
          placeholder={t('settings.prefix.placeholder')}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.prefix}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, prefix: e.target.value }))}
        />
      </div>
      <div>
        <label htmlFor="locale" className="block text-sm mb-1">{t('settings.locale')}</label>
        <select
          id="locale"
          title={t('settings.locale')}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.locale}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings((s: Settings) => ({ ...s, locale: e.target.value }))}
        >
          <option value="pt">{t('settings.locale.pt')}</option>
          <option value="en">{t('settings.locale.en')}</option>
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
        <label htmlFor="logsEnabled" className="text-sm">{t('settings.logsEnabled')}</label>
      </div>
      <div>
        <label htmlFor="modlog" className="block text-sm mb-1">{t('settings.modlogChannelId')}</label>
        <select
          id="modlog"
          title={t('settings.modlogChannelId')}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
          value={settings.modlogChannelId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings((s: Settings) => ({ ...s, modlogChannelId: e.target.value }))}
        >
          <option value="">—</option>
          {channels.filter(isTextChannel).map(ch => (
            <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-2">
        <button disabled={saving} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">
          {saving ? t('settings.saving') : (loaded ? t('settings.save') : t('settings.loading'))}
        </button>
      </div>
    </form>
  )
}
