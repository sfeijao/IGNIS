"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'

type Panel = { id: string; name: string; channelId?: string; messageId?: string; categoryId?: string; createdAt?: string }
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
  toast({ type: 'success', title: t('tickets.category.created') })
      setNewCategory({ name: '' })
      await loadAll(guildId)
    } catch (e: any) {
  toast({ type: 'error', title: t('tickets.category.createFail'), description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const panelRows = useMemo(() => {
    return panels.map((p) => {
      const ch = channels.find(c => c.id === p.channelId)
      const cat = categories.find(c => c.id === p.categoryId)
      const channelLabel = ch ? `#${ch.name} (${channelTypeLabel(ch)})` : '-'
      return { ...p, channelName: channelLabel, categoryName: cat?.name || '-' }
    })
  }, [panels, channels, categories])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">{t('tickets.panels.title')}</h2>
        <button onClick={() => guildId && loadAll(guildId)} className="btn btn-secondary" title={t('tickets.reload')}>{t('tickets.reload')}</button>
        <button onClick={onScan} className="btn btn-primary" title={t('tickets.scan')}>{t('tickets.scan')}</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
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
              <button className="btn btn-primary" disabled={loading}>{t('tickets.panel.create')}</button>
            </form>
          </div>
        </section>
        <section className="card">
          <div className="card-header">{t('tickets.category.create')}</div>
          <div className="card-body">
            <form onSubmit={onCreateCategory} className="flex flex-col gap-3">
              <input value={newCategory.name} onChange={e => setNewCategory({ name: e.target.value })} placeholder={t('tickets.panels.categoryName.placeholder')} className="input" required />
              <button className="btn btn-primary" disabled={loading}>{t('tickets.category.create')}</button>
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
                <th className="py-2 pr-4">{t('tickets.table.category')}</th>
                <th className="py-2 pr-4">{t('tickets.table.message')}</th>
                <th className="py-2">{t('tickets.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {panelRows.map(p => (
                <tr key={p.id} className="border-b border-neutral-900/50">
                  <td className="py-2 pr-4">{p.name}</td>
                  <td className="py-2 pr-4">{p.channelName}</td>
                  <td className="py-2 pr-4">{p.categoryName}</td>
                  <td className="py-2 pr-4">{p.messageId || '-'}</td>
                  <td className="py-2 flex gap-2">
                    <button className="btn btn-secondary btn-xs" title={t('tickets.action.sync')} onClick={() => guildId && api.panelAction(guildId, p.id, 'sync').then(() => { toast({ type:'success', title: t('tickets.synced') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>{t('tickets.action.sync')}</button>
                    <button className="btn btn-secondary btn-xs" title={t('tickets.action.messageUpdate')} onClick={() => guildId && api.panelAction(guildId, p.id, 'refresh_message').then(() => { toast({ type:'success', title: t('tickets.action.messageUpdate') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>{t('tickets.action.messageUpdate')}</button>
                    <button className="btn btn-danger btn-xs" title={t('tickets.action.delete')} onClick={() => guildId && api.panelAction(guildId, p.id, 'delete').then(() => { toast({ type:'success', title: t('tickets.removed') }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>{t('tickets.action.delete')}</button>
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
