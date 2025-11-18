"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useGuildId } from '../lib/guild'
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
  const guildId = useGuildId()
  const [panels, setPanels] = useState<Panel[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const { t } = useI18n()

  const [newPanel, setNewPanel] = useState<{ name: string; channelId: string; categoryId?: string }>({ name: '', channelId: '' })
  const [newCategory, setNewCategory] = useState<{ name: string }>({ name: '' })
  const [filter, setFilter] = useState('')

  const loadAll = useCallback(async (gid: string) => {
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
      toast({ type: 'error', title: 'Erro ao carregar', description: e?.message })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (guildId) loadAll(guildId)
  }, [guildId, loadAll])

  const onScan = useCallback(async () => {
    if (!guildId) return
    setScanning(true)
    try {
      await api.scanPanels(guildId)
      toast({ type: 'success', title: 'Varredura concluída' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha na varredura', description: e?.message })
    } finally {
      setScanning(false)
    }
  }, [guildId, loadAll, toast])

  const onCreatePanel = useCallback(async (e: React.FormEvent) => {
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
  }, [guildId, newPanel, loadAll, toast])

  const onCreateCategory = useCallback(async (e: React.FormEvent) => {
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
  }, [guildId, newCategory, loadAll, toast])

  const panelRows = useMemo(() => {
    const f = (filter || '').toLowerCase()
    return panels
      .map((p) => {
        const ch = channels.find(c => c.id === p.channel_id)
        const channelLabel = p.channelName || (ch ? `#${ch.name} (${channelTypeLabel(ch)})` : '-')
        return { ...p, channelLabel }
      })
      .filter(p => {
        if (!f) return true
        const name = p.name || ''
        const channel = p.channelLabel || ''
        return String(name).toLowerCase().includes(f) || String(channel).toLowerCase().includes(f)
      })
  }, [panels, channels, filter])

  const toggleTheme = useCallback(async (panelId: string, current?: string) => {
    if (!guildId || actionLoading) return
    const next = current === 'light' ? 'dark' : 'light'
    setActionLoading(panelId)
    try {
      await api.panelAction(guildId, panelId, 'theme', { theme: next })
      toast({ type: 'success', title: 'Tema atualizado' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha na ação', description: e?.message })
    } finally {
      setActionLoading(null)
    }
  }, [guildId, actionLoading, loadAll, toast])

  const setTemplate = useCallback(async (panelId: string, template: string) => {
    if (!guildId || actionLoading) return
    setActionLoading(panelId)
    try {
      await api.panelAction(guildId, panelId, 'template', { template })
      toast({ type: 'success', title: 'Template atualizado' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha na ação', description: e?.message })
    } finally {
      setActionLoading(null)
    }
  }, [guildId, actionLoading, loadAll, toast])

  const handlePanelAction = useCallback(async (panelId: string, action: string) => {
    if (!guildId || actionLoading) return
    setActionLoading(panelId)
    try {
      await api.panelAction(guildId, panelId, action)
      const messages: Record<string, string> = {
        save: 'Painel guardado',
        resend: 'Painel reenviado',
        recreate: 'Painel recriado',
        delete: 'Painel removido'
      }
      toast({ type: 'success', title: messages[action] || 'Ação concluída' })
      await loadAll(guildId)
    } catch (e: any) {
      toast({ type: 'error', title: 'Falha na ação', description: e?.message })
    } finally {
      setActionLoading(null)
    }
  }, [guildId, actionLoading, loadAll, toast])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Painéis de Tickets
            </h1>
            <p className="text-gray-400 mt-1">Gerir painéis e categorias de tickets</p>
          </div>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => guildId && loadAll(guildId)} 
              className="px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700/50 transition-all duration-200 flex items-center gap-2"
              disabled={loading}
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {loading ? 'A carregar...' : 'Atualizar'}
            </button>
            <button 
              type="button" 
              onClick={onScan} 
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg transition-all duration-200 flex items-center gap-2 transform hover:scale-[1.02]"
              disabled={scanning || loading}
            >
              <svg className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {scanning ? 'A varrer...' : 'Varrer Painéis'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 flex items-start gap-3">
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
            </svg>
            <div>
              <p className="font-semibold">Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            className="w-full pl-12 pr-12 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            placeholder="🔍 Pesquisar painéis..." 
            value={filter} 
            onChange={e => setFilter(e.target.value)} 
          />
          {filter && (
            <button 
              onClick={() => setFilter('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
            </button>
          )}
        </div>

        {/* Create Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create Panel */}
          <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-gray-700/50 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
                </svg>
                Criar Painel
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={onCreatePanel} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Nome do Painel</label>
                  <input 
                    value={newPanel.name} 
                    onChange={e => setNewPanel(v => ({ ...v, name: e.target.value }))} 
                    placeholder="Ex: Suporte Geral" 
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    required 
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Canal</label>
                  <select 
                    value={newPanel.channelId} 
                    onChange={e => setNewPanel(v => ({ ...v, channelId: e.target.value }))} 
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer"
                    required
                  >
                    <option value="">Selecione um canal...</option>
                    {channels.filter(isTextChannel).map(ch => (
                      <option key={ch.id} value={ch.id}>{`#${ch.name} (${channelTypeLabel(ch)})`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Categoria (Opcional)</label>
                  <select 
                    value={newPanel.categoryId || ''} 
                    onChange={e => setNewPanel(v => ({ ...v, categoryId: e.target.value || undefined }))} 
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="">Sem categoria</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  type="submit" 
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  disabled={loading}
                >
                  + Criar Painel
                </button>
              </form>
            </div>
          </section>

          {/* Create Category */}
          <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-gray-700/50 px-6 py-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                Criar Categoria
              </h3>
            </div>
            <div className="p-6">
              <form onSubmit={onCreateCategory} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-300 mb-2 block">Nome da Categoria</label>
                  <input 
                    value={newCategory.name} 
                    onChange={e => setNewCategory({ name: e.target.value })} 
                    placeholder="Ex: Tickets Técnicos" 
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    required 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
                  disabled={loading}
                >
                  + Criar Categoria
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Panels List */}
        <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-b border-gray-700/50 px-6 py-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" />
              </svg>
              Lista de Painéis ({panelRows.length})
            </h3>
          </div>
          <div className="p-6">
            {loading && panelRows.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : panelRows.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-400 mb-2">Nenhum painel encontrado</p>
                <p className="text-sm text-gray-500">Crie um novo painel ou execute uma varredura</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {panelRows.map(p => (
                  <PanelCard 
                    key={p._id}
                    panel={p}
                    guildId={guildId || ''}
                    isLoading={actionLoading === p._id}
                    onToggleTheme={() => toggleTheme(p._id, p.theme)}
                    onSetTemplate={(template) => setTemplate(p._id, template)}
                    onAction={(action) => handlePanelAction(p._id, action)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

type PanelCardProps = {
  panel: Panel & { channelLabel: string }
  guildId: string
  isLoading: boolean
  onToggleTheme: () => void
  onSetTemplate: (template: string) => void
  onAction: (action: string) => void
}

function PanelCard({ panel, guildId, isLoading, onToggleTheme, onSetTemplate, onAction }: PanelCardProps) {
  const [showActions, setShowActions] = useState(false)
  
  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-5 hover:border-purple-500/30 transition-all duration-200">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h4 className="text-lg font-semibold text-white">{panel.name || 'Sem nome'}</h4>
            {panel.detected && (
              <span className="px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-400 font-medium">
                🔍 Detetado
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="flex items-center gap-1.5 text-gray-400">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" />
              </svg>
              {panel.channelLabel}
            </div>
            {panel.template && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H5V5h10v7H8.771z" />
                </svg>
                {panel.template}
              </div>
            )}
            {panel.theme && (
              <div className="flex items-center gap-1.5 text-gray-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
                {panel.theme}
              </div>
            )}
          </div>
          {panel.message_id && (
            <a 
              className="inline-flex items-center gap-1.5 mt-2 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              href={`https://discord.com/channels/${guildId}/${panel.channel_id}/${panel.message_id}`} 
              target="_blank" 
              rel="noreferrer"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              Ver mensagem
            </a>
          )}
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
        >
          <svg className={`w-5 h-5 transition-transform ${showActions ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>
      </div>

      {showActions && (
        <div className="border-t border-gray-700/50 pt-4 mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {panel.detected ? (
              <button 
                onClick={() => onAction('save')}
                disabled={isLoading}
                className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600/30 rounded-lg text-sm font-medium text-blue-300 transition-all disabled:opacity-50"
              >
                💾 Guardar
              </button>
            ) : (
              <>
                <button 
                  onClick={() => onAction('resend')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  📤 Reenviar
                </button>
                <button 
                  onClick={() => onAction('recreate')}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  🔄 Recriar
                </button>
              </>
            )}
            <button 
              onClick={onToggleTheme}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
            >
              {panel.theme === 'light' ? '🌙' : '☀️'} Tema
            </button>
            <button 
              onClick={() => {
                if (confirm('Tem a certeza que deseja remover este painel?')) {
                  onAction('delete')
                }
              }}
              disabled={isLoading}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-sm font-medium text-red-300 transition-all disabled:opacity-50"
            >
              🗑️ Remover
            </button>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Template</label>
            <select 
              value={panel.template || 'classic'} 
              onChange={e => onSetTemplate(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all cursor-pointer disabled:opacity-50"
            >
              {['classic', 'compact', 'premium', 'minimal', 'gamer'].map(opt => (
                <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm rounded-xl flex items-center justify-center">
          <svg className="animate-spin h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  )
}
