"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

type Panel = {
  _id: string
  guild_id: string
  channel_id: string
  message_id?: string
  template?: string
  theme?: 'light' | 'dark'
  channelName?: string
  channelExists?: boolean
  messageExists?: boolean
  detected?: boolean
  name?: string
}
type Category = { id: string; name: string }
type Channel = { id: string; name: string; type?: string }

const isTextChannel = (ch: Channel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  return t === '' || t === '0' || t === 'text' || t === 'guild_text' || t === '5' || t === 'announcement' || t === 'guild_announcement'
}

const channelTypeLabel = (ch: Channel) => {
  const t = (ch?.type ?? '').toString().toLowerCase()
  if (t === '0' || t === 'text' || t === 'guild_text') return 'Text'
  if (t === '2' || t === 'voice' || t === 'guild_voice') return 'Voice'
  if (t === '4' || t === 'category' || t === 'guild_category') return 'Category'
  if (t === '5' || t === 'announcement' || t === 'guild_announcement') return 'Announcement'
  return 'Channel'
}

export default function TicketPanels() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { t } = useI18n()

  const [newPanel, setNewPanel] = useState<{ name: string; channelId: string; categoryId?: string }>({ name: '', channelId: '' })
  const [newCategory, setNewCategory] = useState<{ name: string }>({ name: '' })
  const [filter, setFilter] = useState('')

  useEffect(() => {
    setGuildId(getGuildId())
  }, [])

  const loadAll = async (gid: string) => {
    setLoading(true)
    setError(null)
    try {
      const [p, c, ch] = await Promise.all([
        api.getPanels(gid),
        api.getCategories(gid),
        api.getChannels(gid)
      ])
      setPanels(p?.panels || p || [])
      setCategories(c?.categories || c || [])
      setChannels((ch?.channels || ch || []).filter((x: Channel) => x && x.id && x.name))
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (guildId) loadAll(guildId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId])

  const onScan = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      await api.scanPanels(guildId)
      toast({ type: 'success', title: t('tickets.scan.done') })
    } catch (e: any) {
      toast({ type: 'error', title: t('tickets.scan.fail'), description: e?.message })
    }
    await loadAll(guildId)
  }

  const onCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guildId || !newPanel.name || !newPanel.channelId) return
    setLoading(true)
    try {
      await api.createPanel(guildId, newPanel)
      toast({ type: 'success', title: t('tickets.panel.created') })
      setNewPanel({ name: '', channelId: '' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: t('tickets.panel.createFail'), description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const onCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guildId || !newCategory.name) return
    setLoading(true)
    try {
      await api.createCategory(guildId, newCategory)
      setNewCategory({ name: '' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: t('tickets.category.createFail'), description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const panelRows = useMemo(() => {
    const f = (filter || '').toLowerCase()
    return panels
      .map((p) => {
        // Prefer server-provided channelName, fallback to local lookup
        const ch = channels.find(c => c.id === (p as any).channel_id)
        const channelLabel = (p as any).channelName || (ch ? `#${ch.name} (${channelTypeLabel(ch)})` : '-')
        return { ...p, channelLabel }
      })
      .filter(p => {
        if (!f) return true
        const name = (p as any).name || ''
        const channel = (p as any).channelLabel || ''
        return String(name).toLowerCase().includes(f) || String(channel).toLowerCase().includes(f)
      })
  }, [panels, channels, filter])

  const toggleTheme = async (panelId: string, current?: string) => {
    if (!guildId) return
    const next = current === 'light' ? 'dark' : 'light'
    try {
      await api.panelAction(guildId, panelId, 'theme', { theme: next })
      toast({ type: 'success', title: t('tickets.theme.updated') })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: t('tickets.actionFail'), description: e?.message })
    }
  }

  const setTemplate = async (panelId: string, template: string) => {
    if (!guildId) return
    try {
      await api.panelAction(guildId, panelId, 'template', { template })
      toast({ type: 'success', title: t('tickets.template.updated') })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: t('tickets.actionFail'), description: e?.message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('tickets.panels.title')}</h2>
        <button type="button" onClick={() => guildId && loadAll(guildId)} className="btn btn-secondary" title={t('tickets.reload')}>{t('tickets.reload')}</button>
        <button type="button" onClick={onScan} className="btn btn-primary" title={t('tickets.scan')}>{t('tickets.scan')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <div className="flex items-center gap-2">
        <input className="input" placeholder={t('common.search')} value={filter} onChange={e => setFilter(e.target.value)} />
        <button className="btn btn-secondary" onClick={() => setFilter('')}>{t('common.clear')}</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">{t('tickets.panel.create')}</div>
          <div className="card-body">
            <form onSubmit={onCreatePanel} className="flex flex-col gap-3">
              <input value={newPanel.name} onChange={e => setNewPanel(v => ({ ...v, name: e.target.value }))} placeholder={t('tickets.panels.panelName.placeholder')} className="input" required />
              <select value={newPanel.channelId} onChange={e => setNewPanel(v => ({ ...v, channelId: e.target.value }))} className="input" required title="Canal do painel">
                <option value="">{t('tickets.panels.selectChannel')}</option>
                {channels.filter(isTextChannel).map(ch => <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>)}
              </select>
              <select value={newPanel.categoryId || ''} onChange={e => setNewPanel(v => ({ ...v, categoryId: e.target.value || undefined }))} className="input" title="Categoria opcional">
                <option value="">{t('tickets.panels.noCategory')}</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <button type="submit" className="btn btn-primary" disabled={loading}>{t('tickets.panel.create')}</button>
            </form>
          </div>
        </section>
        <section className="card">
          <div className="card-header">{t('tickets.category.create')}</div>
          <div className="card-body">
            <form onSubmit={onCreateCategory} className="flex flex-col gap-3">
              <input value={newCategory.name} onChange={e => setNewCategory({ name: e.target.value })} placeholder={t('tickets.panels.categoryName.placeholder')} className="input" required />
              <button type="submit" className="btn btn-primary" disabled={loading}>{t('tickets.category.create')}</button>
            </form>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-header">{t('tickets.panels.list')}</div>
        <div className="card-body overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-neutral-800">
                <th className="py-2 pr-4">{t('tickets.table.name')}</th>
                <th className="py-2 pr-4">{t('tickets.table.channel')}</th>
                <th className="py-2 pr-4">{t('tickets.table.message')}</th>
                <th className="py-2">{t('tickets.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {panelRows.map(p => (
                <tr key={(p as any)._id} className="border-b border-neutral-900/50">
                  <td className="py-2 pr-4 align-top">
                    <div className="flex flex-col">
                      <span className="font-medium">{(p as any).name || '-'}</span>
                      {(p as any).detected && <span className="text-xs text-amber-400">{t('tickets.detected')}</span>}
                      {(p as any).template && <span className="text-xs opacity-70">tpl: {(p as any).template}</span>}
                      {(p as any).theme && <span className="text-xs opacity-70">theme: {(p as any).theme}</span>}
                    </div>
                  </td>
                  <td className="py-2 pr-4">{(p as any).channelLabel}</td>
                  <td className="py-2 pr-4">
                    {(p as any).message_id ? (
                      <a className="link" href={`https://discord.com/channels/${guildId}/${(p as any).channel_id}/${(p as any).message_id}`} target="_blank" rel="noreferrer">{(p as any).message_id}</a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {(p as any).detected ? (
                        <button type="button" className="btn btn-primary btn-xs" onClick={() => guildId && api.panelAction(guildId, (p as any)._id, 'save').then(() => { toast({ type:'success', title: t('tickets.saved') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:t('tickets.actionFail'), description:e?.message }))}>{t('tickets.action.save')}</button>
                      ) : (
                        <>
                          <button type="button" className="btn btn-secondary btn-xs" onClick={() => guildId && api.panelAction(guildId, (p as any)._id, 'resend').then(() => { toast({ type:'success', title: t('tickets.action.resend.ok') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:t('tickets.actionFail'), description:e?.message }))}>{t('tickets.action.resend')}</button>
                          <button type="button" className="btn btn-secondary btn-xs" onClick={() => guildId && api.panelAction(guildId, (p as any)._id, 'recreate').then(() => { toast({ type:'success', title: t('tickets.action.recreate.ok') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:t('tickets.actionFail'), description:e?.message }))}>{t('tickets.action.recreate')}</button>
                        </>
                      )}
                      <select className="input input-xs" value={(p as any).template || 'classic'} onChange={e => setTemplate((p as any)._id, e.target.value)} title={t('tickets.template.set')}>
                        {['classic','compact','premium','minimal','gamer'].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      <button type="button" className="btn btn-secondary btn-xs" onClick={() => toggleTheme((p as any)._id, (p as any).theme)}>{t('tickets.theme.toggle')}</button>
                      <button type="button" className="btn btn-danger btn-xs" onClick={() => {
                        if (!guildId) return; if (!confirm(t('tickets.confirmDelete'))) return;
                        api.panelAction(guildId, (p as any)._id, 'delete').then(() => { toast({ type:'success', title: t('tickets.removed') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:t('tickets.actionFail'), description:e?.message }) )
                      }}>{t('tickets.action.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
