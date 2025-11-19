'use client'

import { useEffect, useMemo, useState } from 'react'
import type React from 'react'
import { api } from '@/lib/apiClient'
import { useGuildId } from '@/lib/guild'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

type Settings = {
  prefix: string
  locale: string
  logsEnabled: boolean
  modlogChannelId: string
}

type BotSettings = {
  nickname?: string
  presenceStatus?: 'online' | 'idle' | 'dnd' | 'invisible'
  statusType?: 'PLAYING' | 'LISTENING' | 'WATCHING' | 'COMPETING' | 'CUSTOM'
  statusText?: string
  bannerUrl?: string
  iconUrl?: string
  staffRoleId?: string
  adminRoleId?: string
  verifiedRoleId?: string
  unverifiedRoleId?: string
  giveawayManagerRoleId?: string
}

type Role = { id: string; name: string }

const defaults: Settings = {
  prefix: '!',
  locale: 'pt',
  logsEnabled: true,
  modlogChannelId: ''
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(defaults)
  const [botSettings, setBotSettings] = useState<BotSettings>({
    nickname: '',
    presenceStatus: 'online',
    statusType: 'CUSTOM',
    statusText: '',
    bannerUrl: '',
    iconUrl: '',
    staffRoleId: '',
    adminRoleId: '',
    verifiedRoleId: '',
    unverifiedRoleId: '',
    giveawayManagerRoleId: ''
  })
  const [uploading, setUploading] = useState(false)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const guildId = useGuildId()
  const { t } = useI18n()
  const { toast } = useToast()
  const [channels, setChannels] = useState<Array<{ id: string; name: string; type?: string }>>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [bannerCropToFill, setBannerCropToFill] = useState(false)

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

  const missingRoles = useMemo(() => {
    const missing: string[] = []
    if (!botSettings.staffRoleId) missing.push(t('settings.bot.systemRoles.staff'))
    if (!botSettings.adminRoleId) missing.push(t('settings.bot.systemRoles.admin'))
    if (!botSettings.verifiedRoleId) missing.push(t('verification.verifiedRole'))
    return missing
  }, [botSettings.staffRoleId, botSettings.adminRoleId, botSettings.verifiedRoleId, t])

  useEffect(() => {
    if (!guildId) return
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
        const b = await api.getBotSettings?.(guildId)
        const s = (b && b.settings) || b || {}
        setBotSettings((prev) => ({
          nickname: typeof s.nickname === 'string' ? s.nickname : '',
          presenceStatus: (s.presenceStatus as any) || 'online',
          statusType: (s.statusType as any) || 'CUSTOM',
          statusText: typeof s.statusText === 'string' ? s.statusText : '',
          bannerUrl: typeof s.bannerUrl === 'string' ? s.bannerUrl : '',
          iconUrl: typeof s.iconUrl === 'string' ? s.iconUrl : '',
          staffRoleId: typeof s.staffRoleId === 'string' ? s.staffRoleId : (s.roles?.staff || ''),
          adminRoleId: typeof s.adminRoleId === 'string' ? s.adminRoleId : (s.roles?.admin || ''),
          verifiedRoleId: typeof s.verifiedRoleId === 'string' ? s.verifiedRoleId : (s.verification?.verifiedRoleId || ''),
          unverifiedRoleId: typeof s.unverifiedRoleId === 'string' ? s.unverifiedRoleId : (s.verification?.unverifiedRoleId || ''),
          giveawayManagerRoleId: typeof s.giveawayManagerRoleId === 'string' ? s.giveawayManagerRoleId : (s.giveaway_manager_role_id || '')
        }))
      } catch {}
      try {
        const ch = await api.getChannels(guildId)
        setChannels(ch.channels || ch || [])
      } catch {}
      try {
        setRolesLoading(true)
        setRolesError(null)
        const rs = await api.getRoles(guildId)
        setRoles(rs.roles || rs || [])
      } catch (e:any) {
        setRoles([])
        setRolesError(e?.message || 'roles_failed')
      } finally {
        setRolesLoading(false)
      }
      setLoaded(true)
    })()
  }, [guildId])

  const retryLoadRoles = async () => {
    if (!guildId) return
    try {
      setRolesLoading(true)
      setRolesError(null)
      const rs = await api.getRoles(guildId)
      setRoles(rs.roles || rs || [])
    } catch (e:any) {
      setRoles([])
      setRolesError(e?.message || 'roles_failed')
    } finally {
      setRolesLoading(false)
    }
  }

  useEffect(() => {
    if (!guildId || typeof window === 'undefined') return
    try {
      const key = `ignis:bannerCropToFill:${guildId}`
      const raw = window.localStorage.getItem(key)
      if (raw != null) setBannerCropToFill(raw === '1')
    } catch {}
  }, [guildId])

  useEffect(() => {
    if (!guildId || typeof window === 'undefined') return
    try {
      const key = `ignis:bannerCropToFill:${guildId}`
      window.localStorage.setItem(key, bannerCropToFill ? '1' : '0')
    } catch {}
  }, [guildId, bannerCropToFill])

  const save = async () => {
    if (!guildId) return
    setSaving(true)
    try {
      await api.postSettings?.(guildId, settings)
      const payload: Record<string, any> = {
        nickname: botSettings.nickname || '',
        presenceStatus: botSettings.presenceStatus || 'online',
        statusType: botSettings.statusType || 'CUSTOM',
        statusText: botSettings.statusText || '',
      }
      payload.bannerUrl = botSettings.bannerUrl || ''
      payload.iconUrl = botSettings.iconUrl || ''
      if (botSettings.staffRoleId) payload.staffRoleId = botSettings.staffRoleId
      if (botSettings.adminRoleId) payload.adminRoleId = botSettings.adminRoleId
      if (botSettings.verifiedRoleId) payload.verifiedRoleId = botSettings.verifiedRoleId
      if (botSettings.unverifiedRoleId) payload.unverifiedRoleId = botSettings.unverifiedRoleId
      if (botSettings.giveawayManagerRoleId) payload.giveawayManagerRoleId = botSettings.giveawayManagerRoleId
      await api.postBotSettings?.(guildId, payload)
      toast({ type: 'success', title: t('settings.saveSuccess') })
    } catch (err) {
      toast({ type: 'error', title: t('settings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const onSelectBannerFile = async (file: File) => {
    if (!guildId || !file) return
    if (!/^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i.test(file.type)) {
      toast({ type: 'error', title: t('settings.bot.banner.typeError') })
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ type: 'error', title: t('settings.bot.banner.sizeError') })
      return
    }
    setUploading(true)
    try {
      const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = reject
        reader.readAsDataURL(f)
      })
      const originalDataUrl = await toDataUrl(file)

      const maybeResize = async (src: string, f: File) => {
        if (/image\/gif/i.test(f.type)) return src
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image()
          im.onload = () => resolve(im)
          im.onerror = reject
          im.src = src
        })
        const targetW = 1600, targetH = 400
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) return src
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return src

        if (bannerCropToFill) {
          if (w < targetW && h < targetH) return src
          const targetRatio = targetW / targetH
          const srcRatio = w / h
          let sx = 0, sy = 0, sw = w, sh = h
          if (srcRatio > targetRatio) {
            sw = Math.floor(h * targetRatio)
            sx = Math.floor((w - sw) / 2)
          } else if (srcRatio < targetRatio) {
            sh = Math.floor(w / targetRatio)
            sy = Math.floor((h - sh) / 2)
          }
          canvas.width = targetW
          canvas.height = targetH
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
        } else {
          const scale = Math.min(1, Math.min(targetW / w, targetH / h))
          if (scale >= 1) return src
          const nw = Math.max(1, Math.floor(w * scale))
          const nh = Math.max(1, Math.floor(h * scale))
          canvas.width = nw
          canvas.height = nh
          ctx.drawImage(img, 0, 0, nw, nh)
        }
        const targetType = 'image/webp'
        const quality = 0.85
        try {
          return canvas.toDataURL(targetType, quality)
        } catch {
          return canvas.toDataURL('image/jpeg', quality)
        }
      }

      const dataUrl = await maybeResize(originalDataUrl, file)
      const resp = await api.uploadGuildImage(guildId, file.name, dataUrl)
      if (resp && resp.success && resp.url) {
        setBotSettings((s) => ({ ...s, bannerUrl: resp.url }))
        toast({ type: 'success', title: t('settings.bot.banner.uploaded') })
      } else {
        toast({ type: 'error', title: t('settings.bot.banner.uploadFail') })
      }
    } catch {
      toast({ type: 'error', title: t('settings.bot.banner.uploadFail') })
    } finally {
      setUploading(false)
    }
  }

  const onSelectIconFile = async (file: File) => {
    if (!guildId || !file) return
  if (!/^image\/(png|jpe?g|webp|gif|avif|svg\+xml)$/i.test(file.type)) { toast({ type: 'error', title: t('settings.bot.icon.typeError') }); return }
  if (file.size > 50 * 1024 * 1024) { toast({ type: 'error', title: t('settings.bot.icon.sizeError') }); return }
    setUploadingIcon(true)
    try {
      const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result||'')); r.onerror = reject; r.readAsDataURL(f) })
      const original = await toDataUrl(file)
      const maybeResize = async (src: string, f: File) => {
        if (/image\/gif/i.test(f.type)) return src
        const img = await new Promise<HTMLImageElement>((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })
        const max = 256
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) return src
        const scale = Math.min(1, Math.min(max / w, max / h))
        if (scale >= 1) return src
        const nw = Math.max(1, Math.floor(w * scale))
        const nh = Math.max(1, Math.floor(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = nw
        canvas.height = nh
        const ctx = canvas.getContext('2d')
        if (!ctx) return src
        ctx.drawImage(img, 0, 0, nw, nh)
        try { return canvas.toDataURL('image/webp', 0.9) } catch { return canvas.toDataURL('image/jpeg', 0.9) }
      }
      const dataUrl = await maybeResize(original, file)
      const resp = await api.uploadGuildImage(guildId, file.name, dataUrl)
      if (resp?.success && resp.url) { setBotSettings((s) => ({ ...s, iconUrl: resp.url })); toast({ type: 'success', title: t('settings.bot.icon.uploaded') }) }
      else toast({ type: 'error', title: t('settings.bot.icon.uploadFail') })
    } catch { toast({ type: 'error', title: t('settings.bot.icon.uploadFail') }) } finally { setUploadingIcon(false) }
  }

  return (
    <form className="space-y-6" onSubmit={(e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); save() }}>
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-gray-600/20 to-slate-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚙️</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-400 to-slate-400 bg-clip-text text-transparent">
                Server Settings
              </h2>
              <p className="text-gray-400 text-sm mt-1">Configure your bot and server preferences</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-gray-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-gray-600 peer-checked:to-slate-600"></div>
          </label>
        </div>
      </div>

      {/* Basic Settings */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🔧</span>
          <h3 className="text-lg font-semibold text-white">Basic Configuration</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="prefix" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.prefix')}</label>
            <input
              id="prefix"
              title={t('settings.prefix')}
              placeholder={t('settings.prefix.placeholder')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={settings.prefix}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, prefix: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="locale" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.locale')}</label>
            <select
              id="locale"
              title={t('settings.locale')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={settings.locale}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings((s: Settings) => ({ ...s, locale: e.target.value }))}
            >
              <option value="pt">{t('settings.locale.pt')}</option>
              <option value="en">{t('settings.locale.en')}</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="modlog" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.modlogChannelId')}</label>
            <select
              id="modlog"
              title={t('settings.modlogChannelId')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={settings.modlogChannelId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSettings((s: Settings) => ({ ...s, modlogChannelId: e.target.value }))}
            >
              <option value="">—</option>
              {channels.filter(isTextChannel).map(ch => (
                <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={settings.logsEnabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings((s: Settings) => ({ ...s, logsEnabled: e.target.checked }))}
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-gray-800 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-600 peer-checked:to-emerald-600"></div>
            </label>
            <span className="text-sm text-gray-300">{t('settings.logsEnabled')}</span>
          </div>
        </div>
      </div>

      {/* Bot Personalization */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🤖</span>
          <h3 className="text-lg font-semibold text-white">{t('settings.bot.title')}</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="nickname" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.nickname')}</label>
            <input
              id="nickname"
              placeholder={t('settings.bot.nickname.placeholder')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={botSettings.nickname || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBotSettings((s) => ({ ...s, nickname: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">{t('settings.bot.nickname.hint')}</p>
          </div>
          <div>
            <label htmlFor="presenceStatus" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.presence')}</label>
            <select
              id="presenceStatus"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={botSettings.presenceStatus || 'online'}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings((s) => ({ ...s, presenceStatus: e.target.value as any }))}
            >
              <option value="online">{t('settings.bot.presence.online')}</option>
              <option value="idle">{t('settings.bot.presence.idle')}</option>
              <option value="dnd">{t('settings.bot.presence.dnd')}</option>
              <option value="invisible">{t('settings.bot.presence.offline')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="statusType" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.activityType')}</label>
            <select
              id="statusType"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={botSettings.statusType || 'CUSTOM'}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings((s) => ({ ...s, statusType: e.target.value as any }))}
            >
              <option value="PLAYING">{t('settings.bot.activityType.playing')}</option>
              <option value="LISTENING">{t('settings.bot.activityType.listening')}</option>
              <option value="WATCHING">{t('settings.bot.activityType.watching')}</option>
              <option value="COMPETING">{t('settings.bot.activityType.competing')}</option>
              <option value="CUSTOM">{t('settings.bot.activityType.custom')}</option>
            </select>
          </div>
          <div>
            <label htmlFor="statusText" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.activityText')}</label>
            <input
              id="statusText"
              placeholder={t('settings.bot.activityText.placeholder')}
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all"
              value={botSettings.statusText || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBotSettings((s) => ({ ...s, statusText: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* System Roles */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🎭</span>
          <h3 className="text-lg font-semibold text-white">{t('settings.bot.systemRoles.title')}</h3>
        </div>

        {missingRoles.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/50 bg-amber-500/10 text-amber-200 text-sm p-4">
            ⚠️ {t('settings.bot.systemRoles.warn.missing')} {missingRoles.join(', ')}
          </div>
        )}

        {rolesError && (
          <div className="mb-4 rounded-xl border border-rose-600 bg-rose-900/40 text-rose-200 text-sm p-4 flex items-center gap-3">
            <span>{t('settings.bot.systemRoles.loadingFailed')}</span>
            <button type="button" onClick={retryLoadRoles} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-rose-100 text-sm transition-all">
              {t('settings.bot.systemRoles.retry')}
            </button>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-4">{t('settings.bot.systemRoles.help')}</p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="staffRoleId" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.systemRoles.staff')}</label>
            <select
              id="staffRoleId"
              className={`w-full bg-gray-900/50 border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all ${!botSettings.staffRoleId ? 'border-rose-600' : 'border-gray-700'}`}
              value={botSettings.staffRoleId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings(s => ({ ...s, staffRoleId: e.target.value }))}
            >
              <option value="">—</option>
              {rolesLoading && <option disabled value="">{t('settings.bot.systemRoles.loading')}</option>}
              {!rolesLoading && roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('settings.bot.systemRoles.staff.hint')}</p>
          </div>
          <div>
            <label htmlFor="adminRoleId" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.systemRoles.admin')}</label>
            <select
              id="adminRoleId"
              className={`w-full bg-gray-900/50 border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all ${!botSettings.adminRoleId ? 'border-rose-600' : 'border-gray-700'}`}
              value={botSettings.adminRoleId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings(s => ({ ...s, adminRoleId: e.target.value }))}
            >
              <option value="">—</option>
              {rolesLoading && <option disabled value="">{t('settings.bot.systemRoles.loading')}</option>}
              {!rolesLoading && roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('settings.bot.systemRoles.admin.hint')}</p>
          </div>
          <div>
            <label htmlFor="verifiedRoleId" className="block text-sm mb-2 text-gray-300 font-medium">{t('verification.verifiedRole')}</label>
            <select
              id="verifiedRoleId"
              className={`w-full bg-gray-900/50 border rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all ${!botSettings.verifiedRoleId ? 'border-rose-600' : 'border-gray-700'}`}
              value={botSettings.verifiedRoleId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings(s => ({ ...s, verifiedRoleId: e.target.value }))}
            >
              <option value="">—</option>
              {rolesLoading && <option disabled value="">{t('settings.bot.systemRoles.loading')}</option>}
              {!rolesLoading && roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('settings.bot.systemRoles.verified.hint')}</p>
          </div>
          <div>
            <label htmlFor="unverifiedRoleId" className="block text-sm mb-2 text-gray-300 font-medium">{t('verification.unverifiedRole')}</label>
            <select
              id="unverifiedRoleId"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all"
              value={botSettings.unverifiedRoleId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings(s => ({ ...s, unverifiedRoleId: e.target.value }))}
            >
              <option value="">—</option>
              {rolesLoading && <option disabled value="">{t('settings.bot.systemRoles.loading')}</option>}
              {!rolesLoading && roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('settings.bot.systemRoles.unverified.hint')}</p>
          </div>
          <div>
            <label htmlFor="giveawayManagerRoleId" className="block text-sm mb-2 text-gray-300 font-medium">{t('settings.bot.systemRoles.giveawayManager')}</label>
            <select
              id="giveawayManagerRoleId"
              className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all"
              value={botSettings.giveawayManagerRoleId || ''}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBotSettings(s => ({ ...s, giveawayManagerRoleId: e.target.value }))}
            >
              <option value="">—</option>
              {rolesLoading && <option disabled value="">{t('settings.bot.systemRoles.loading')}</option>}
              {!rolesLoading && roles.map(r => (<option key={r.id} value={r.id}>{`@${r.name}`}</option>))}
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('settings.bot.systemRoles.giveawayManager.hint')}</p>
          </div>
        </div>
      </div>

      {/* Banner */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🖼️</span>
          <h3 className="text-lg font-semibold text-white">{t('settings.bot.banner')}</h3>
        </div>
        <div className="space-y-4">
          <input
            id="bannerUrl"
            placeholder={t('settings.bot.banner.placeholder')}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all"
            value={botSettings.bannerUrl || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = (e.target.value || '').trim()
              if (/^file:\/\//i.test(v) || /^[a-zA-Z]:\\/.test(v)) {
                toast({ type: 'error', title: t('settings.bot.banner.localPathError') })
                setBotSettings((s) => ({ ...s, bannerUrl: '' }))
              } else {
                setBotSettings((s) => ({ ...s, bannerUrl: v }))
              }
            }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-all text-white text-sm font-medium">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const f = e.target.files && e.target.files[0]
                  if (f) onSelectBannerFile(f)
                  ;(e.target as HTMLInputElement).value = ''
                }}
              />
              {uploading ? t('settings.bot.banner.uploading') : t('settings.bot.banner.upload')}
            </label>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-all text-white text-sm"
              onClick={() => { setBotSettings((s) => ({ ...s, bannerUrl: '' })); toast({ type: 'success', title: t('settings.bot.banner.removed') }) }}
            >
              {t('settings.bot.banner.remove')}
            </button>
            <span className="text-xs text-gray-400">{t('settings.bot.banner.hint')}</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input id="bannerCropToFill" type="checkbox" className="sr-only peer" checked={bannerCropToFill} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBannerCropToFill(e.target.checked)} />
              <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-gray-800 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-cyan-600"></div>
            </label>
            <span className="text-sm text-gray-300">{t('settings.bot.banner.cropToFill')}</span>
          </div>
          <p className="text-xs text-gray-500">{t('settings.bot.banner.cropHint')}</p>
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files?.[0]; if (f) onSelectBannerFile(f) }}
            className="rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 transition-colors p-8 text-center text-sm text-gray-300 cursor-pointer bg-gray-900/30"
            onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (ev: any) => { const f = ev.target?.files?.[0]; if (f) onSelectBannerFile(f); }; input.click(); }}
            aria-label={t('settings.bot.banner.dropHint')}
            title={t('settings.bot.banner.dropHint')}
          >
            <div className="text-4xl mb-2">📤</div>
            <div className="opacity-90">{t('settings.bot.banner.dropHint')}</div>
            <div className="text-xs text-gray-500 mt-2">{t('settings.bot.banner.limit')}</div>
          </div>
          {botSettings.bannerUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={botSettings.bannerUrl} alt={t('settings.bot.banner.previewAlt')} className="w-full h-48 object-cover" />
            </div>
          )}
        </div>
      </div>

      {/* Icon */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🎨</span>
          <h3 className="text-lg font-semibold text-white">{t('settings.bot.icon')}</h3>
        </div>
        <div className="space-y-4">
          <input
            id="iconUrl"
            placeholder={t('settings.bot.icon.placeholder')}
            className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-gray-500 transition-all"
            value={botSettings.iconUrl || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              const v = (e.target.value || '').trim()
              if (/^file:\/\//i.test(v) || /^[a-zA-Z]:\\/.test(v)) {
                toast({ type: 'error', title: t('settings.bot.icon.localPathError') })
                setBotSettings((s) => ({ ...s, iconUrl: '' }))
              } else {
                setBotSettings((s) => ({ ...s, iconUrl: v }))
              }
            }}
          />
          <div className="flex items-center gap-3 flex-wrap">
            <label className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 cursor-pointer transition-all text-white text-sm font-medium">
              <input type="file" accept="image/*" className="hidden" onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) onSelectIconFile(f); (e.target as HTMLInputElement).value = '' }} />
              {uploadingIcon ? t('settings.bot.icon.uploading') : t('settings.bot.icon.upload')}
            </label>
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 transition-all text-white text-sm"
              onClick={() => { setBotSettings((s) => ({ ...s, iconUrl: '' })); toast({ type: 'success', title: t('settings.bot.icon.removed') }) }}
            >
              {t('settings.bot.icon.remove')}
            </button>
            <span className="text-xs text-gray-400">{t('settings.bot.icon.hint')}</span>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer?.files?.[0]; if (f) onSelectIconFile(f) }}
            className="rounded-xl border-2 border-dashed border-gray-700 hover:border-gray-500 transition-colors p-8 text-center text-sm text-gray-300 cursor-pointer bg-gray-900/30"
            onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (ev: any) => { const f = ev.target?.files?.[0]; if (f) onSelectIconFile(f); }; input.click(); }}
            aria-label={t('settings.bot.icon.dropHint')}
            title={t('settings.bot.icon.dropHint')}
          >
            <div className="text-4xl mb-2">📤</div>
            <div className="opacity-90">{t('settings.bot.icon.dropHint')}</div>
            <div className="text-xs text-gray-500 mt-2">{t('settings.bot.icon.limit')}</div>
          </div>
          {botSettings.iconUrl && (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={botSettings.iconUrl} alt={t('settings.bot.icon.previewAlt')} className="w-20 h-20 rounded-lg object-cover border border-gray-700" />
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-3">
        <button type="submit" disabled={saving || !enabled} className="px-6 py-3 rounded-xl bg-gradient-to-r from-gray-600 to-slate-600 hover:from-gray-500 hover:to-slate-500 text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
          {saving ? t('settings.saving') : (loaded ? t('settings.save') : t('settings.loading'))}
        </button>
      </div>
    </form>
  )
}
