"use client"

import { useEffect, useMemo, useState } from 'react'
import { getGuildId } from '../lib/guild'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'

type Panel = { id: string; name: string; channelId?: string; messageId?: string; categoryId?: string; createdAt?: string }
type Category = { id: string; name: string }
type Channel = { id: string; name: string; type?: string }

export default function TicketPanels() {
  const [guildId, setGuildId] = useState<string | null>(null)
  const [panels, setPanels] = useState<Panel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

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
      toast({ type: 'success', title: 'Varredura concluída' })
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha ao escanear', description: e?.message })
    }
    await loadAll(guildId)
  }

  const onCreatePanel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guildId || !newPanel.name || !newPanel.channelId) return
    setLoading(true)
    try {
      await api.createPanel(guildId, newPanel)
      toast({ type: 'success', title: 'Painel criado' })
      setNewPanel({ name: '', channelId: '' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha ao criar painel', description: e?.message })
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
      toast({ type: 'success', title: 'Categoria criada' })
      setNewCategory({ name: '' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha ao criar categoria', description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  const panelRows = useMemo(() => {
    return panels.map((p) => {
      const ch = channels.find(c => c.id === p.channelId)
      const cat = categories.find(c => c.id === p.categoryId)
      return { ...p, channelName: ch?.name || '-', categoryName: cat?.name || '-' }
    })
  }, [panels, channels, categories])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Tickets: Painéis e Categorias</h2>
        <button onClick={() => guildId && loadAll(guildId)} className="btn btn-secondary" title="Recarregar">Recarregar</button>
        <button onClick={onScan} className="btn btn-primary" title="Escanear painéis">Escanear</button>
      </div>
      {error && <div className="text-red-400">{error}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card">
          <div className="card-header">Criar Painel</div>
          <div className="card-body">
            <form onSubmit={onCreatePanel} className="flex flex-col gap-3">
              <input value={newPanel.name} onChange={e => setNewPanel(v => ({ ...v, name: e.target.value }))} placeholder="Nome do painel" className="input" required />
              <select value={newPanel.channelId} onChange={e => setNewPanel(v => ({ ...v, channelId: e.target.value }))} className="input" required title="Canal do painel">
                <option value="">Selecione o canal</option>
                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
              </select>
              <select value={newPanel.categoryId || ''} onChange={e => setNewPanel(v => ({ ...v, categoryId: e.target.value || undefined }))} className="input" title="Categoria opcional">
                <option value="">Sem categoria</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              </select>
              <button className="btn btn-primary" disabled={loading}>Criar painel</button>
            </form>
          </div>
        </section>
        <section className="card">
          <div className="card-header">Criar Categoria</div>
          <div className="card-body">
            <form onSubmit={onCreateCategory} className="flex flex-col gap-3">
              <input value={newCategory.name} onChange={e => setNewCategory({ name: e.target.value })} placeholder="Nome da categoria" className="input" required />
              <button className="btn btn-primary" disabled={loading}>Criar categoria</button>
            </form>
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-header">Painéis</div>
        <div className="card-body overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-neutral-800">
                <th className="py-2 pr-4">Nome</th>
                <th className="py-2 pr-4">Canal</th>
                <th className="py-2 pr-4">Categoria</th>
                <th className="py-2 pr-4">Mensagem</th>
                <th className="py-2">Ações</th>
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
                    <button className="btn btn-secondary btn-xs" title="Sincronizar" onClick={() => guildId && api.panelAction(guildId, p.id, 'sync').then(() => { toast({ type:'success', title:'Sincronizado' }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>Sync</button>
                    <button className="btn btn-secondary btn-xs" title="Atualizar mensagem" onClick={() => guildId && api.panelAction(guildId, p.id, 'refresh_message').then(() => { toast({ type:'success', title:'Mensagem atualizada' }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>Msg</button>
                    <button className="btn btn-danger btn-xs" title="Remover" onClick={() => guildId && api.panelAction(guildId, p.id, 'delete').then(() => { toast({ type:'success', title:'Removido' }); loadAll(guildId) }).catch((e:any)=> toast({ type:'error', title:'Falha', description:e?.message }))}>Del</button>
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
