"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '@/lib/guild'
import { useI18n } from '@/lib/i18n'
import { api } from '@/lib/apiClient'

type VerifyConfig = { enabled?: boolean; channelId?: string; roleId?: string; method?: string }
type Channel = { id: string; name: string; type?: string }

// Helpers – keep consistent with other components
const isTextChannel = (ch: Channel) => {
  const t = String(ch.type || '').toLowerCase()
  return t.includes('text') || t.includes('announcement')
}
const channelTypeLabel = (ch: Channel | string | undefined) => {
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

export default function VerificationConfig() {
  const guildId = getGuildId()
  const [cfg, setCfg] = useState<VerifyConfig>({ enabled: false, method: 'captcha', channelId: '', roleId: '' })
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState<'idle'|'saving'|'ok'|'err'>('idle')
  const [channels, setChannels] = useState<Channel[]>([])
  const { t } = useI18n()

  useEffect(() => {
    if (!guildId) return
    let aborted = false
    ;(async () => {
      try {
        const res = await fetch(`/api/guild/${guildId}/verification/config`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (!aborted) setCfg({ enabled: !!data.enabled, channelId: data.channelId || '', roleId: data.roleId || '', method: data.method || 'captcha' })
        }
      } catch {}
      try {
        const list = await api.getChannels(guildId)
        if (!aborted) setChannels(list.channels || list || [])
      } catch {}
    })()
    return () => { aborted = true }
  }, [guildId])

  const selectableChannels = useMemo(() => channels.filter(isTextChannel), [channels])

  const save = async () => {
    if (!guildId) return
    setLoading(true); setSaved('saving')
    try {
      const res = await fetch(`/api/guild/${guildId}/verification/config`, { method: 'POST', headers: { 'Content-Type':'application/json' }, credentials: 'include', body: JSON.stringify(cfg) })
      setSaved(res.ok ? 'ok' : 'err')
    } catch { setSaved('err') } finally { setLoading(false); setTimeout(()=> setSaved('idle'), 1500) }
  }

  return (
    <div className="space-y-3">
      {!guildId && <div className="card p-4 text-sm text-neutral-400">{t('verification.selectGuild')}</div>}
      <form className="card p-5 max-w-xl space-y-4" onSubmit={(e)=>{ e.preventDefault(); save() }}>
        <div className="flex items-center gap-2">
          <input id="v-enabled" type="checkbox" checked={!!cfg.enabled} onChange={e=> setCfg(c => ({ ...c, enabled: e.target.checked }))} />
          <label htmlFor="v-enabled">{t('verification.enable')}</label>
        </div>
        <div>
          <label className="block text-sm mb-1">{t('verification.method')}</label>
          <select className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.method} onChange={e=> setCfg(c=> ({ ...c, method: e.target.value }))} title="Método de verificação">
            <option value="captcha">{t('verification.method.captcha')}</option>
            <option value="button">{t('verification.method.button')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">{t('verification.channel')}</label>
          <select className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" value={cfg.channelId || ''} onChange={e=> setCfg(c=> ({ ...c, channelId: e.target.value }))} title={t('verification.channel')}>
            <option value="">—</option>
            {selectableChannels.map(ch => (
              <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">{t('verification.role')}</label>
          <input className="w-full rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2" placeholder="Role ID" value={cfg.roleId || ''} onChange={e=> setCfg(c=> ({ ...c, roleId: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-2">
          <button disabled={loading} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 font-medium disabled:opacity-60">{saved==='saving' ? t('verification.saving') : t('verification.save')}</button>
          {saved==='ok' && <span className="text-emerald-400 text-sm">{t('verification.saved')}</span>}
          {saved==='err' && <span className="text-rose-400 text-sm">{t('verification.saveFailed')}</span>}
        </div>
      </form>
    </div>
  )
}
