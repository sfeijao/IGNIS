"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { useToast } from './Toaster'
import { useI18n } from '@/lib/i18n'
import ChannelSelect from './ChannelSelect'

type Panel = {
  id: string
  name: string
  message: string
  channelId: string
  enabled: boolean
  createdAt: string
}

export default function TimeTrackingPanelConfig() {
  const guildId = useGuildId()
  const { toast } = useToast()
  const { t } = useI18n()
  
  const [panels, setPanels] = useState<Panel[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [message, setMessage] = useState('**⏱️ Sistema de Bate-Ponto**\n\nClique no botão abaixo para registar a sua entrada, pausa ou saída.')
  const [channelId, setChannelId] = useState('')

  useEffect(() => {
    if (!guildId) return
    loadPanels()
  }, [guildId])

  const loadPanels = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/time-tracking/panels`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setPanels(data.panels || [])
      }
    } catch (err) {
      console.error('Failed to load panels:', err)
    } finally {
      setLoading(false)
    }
  }

  const createPanel = async () => {
    if (!guildId || !name || !channelId) {
      return toast({ type: 'error', title: 'Preencha todos os campos obrigatórios' })
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/time-tracking/panels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, message, channelId })
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast({ type: 'success', title: 'Painel criado com sucesso!' })
        setName('')
        setMessage('**⏱️ Sistema de Bate-Ponto**\n\nClique no botão abaixo para registar a sua entrada, pausa ou saída.')
        setChannelId('')
        loadPanels()
      } else {
        throw new Error(data.error || 'Falha ao criar painel')
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Erro', description: err.message })
    } finally {
      setCreating(false)
    }
  }

  const togglePanel = async (panelId: string, enabled: boolean) => {
    if (!guildId) return
    try {
      const res = await fetch(`/api/guild/${guildId}/time-tracking/panels/${panelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled })
      })
      
      if (res.ok) {
        toast({ type: 'success', title: enabled ? 'Painel ativado' : 'Painel desativado' })
        loadPanels()
      }
    } catch (err) {
      toast({ type: 'error', title: 'Erro ao atualizar painel' })
    }
  }

  const deletePanel = async (panelId: string) => {
    if (!guildId || !confirm('Tem certeza que deseja eliminar este painel?')) return
    
    try {
      const res = await fetch(`/api/guild/${guildId}/time-tracking/panels/${panelId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (res.ok) {
        toast({ type: 'success', title: 'Painel eliminado' })
        loadPanels()
      }
    } catch (err) {
      toast({ type: 'error', title: 'Erro ao eliminar painel' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Create Panel Form */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⏱️</span>
            <h3 className="text-xl font-semibold text-white">Criar Painel de Bate-Ponto</h3>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Panel Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                📝 Nome do Painel
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
                placeholder="Ex: Ponto - Equipa Suporte"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <p className="text-xs text-gray-500">Nome interno para identificar o painel</p>
            </div>

            {/* Channel Select */}
            {guildId && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  📺 Canal do Discord
                  <span className="text-red-400">*</span>
                </label>
                <ChannelSelect
                  guildId={guildId}
                  value={channelId}
                  onChange={(id) => setChannelId(id)}
                  placeholder="Selecione o canal onde o painel será publicado"
                  types={[0, 5]} // Text and Announcement channels
                />
                <p className="text-xs text-gray-500">Canal onde o painel com botão será enviado</p>
              </div>
            )}
          </div>

          {/* Panel Message */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              💬 Mensagem do Painel
            </label>
            <textarea
              className="w-full min-h-[140px] bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-y"
              placeholder="Mensagem que aparecerá no painel..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <p className="text-xs text-gray-500">💡 Suporta markdown (negrito, itálico, etc.)</p>
          </div>

          {/* Create Button */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={createPanel}
              disabled={creating || !name || !channelId}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Criando...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Criar Painel
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Existing Panels List */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📋</span>
            <h3 className="text-xl font-semibold text-white">Painéis Ativos</h3>
          </div>
          <span className="px-3 py-1 bg-blue-600/30 border border-blue-500/50 rounded-full text-sm font-semibold text-blue-300">
            {panels.length} painel{panels.length !== 1 ? 'éis' : ''}
          </span>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <svg className="animate-spin h-8 w-8 text-orange-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-400">Carregando painéis...</p>
            </div>
          ) : panels.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhum painel criado</h3>
              <p className="text-gray-500">Crie o primeiro painel de bate-ponto acima</p>
            </div>
          ) : (
            <div className="space-y-4">
              {panels.map(panel => (
                <div key={panel.id} className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-5 hover:border-gray-600/50 transition-all">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-semibold text-white truncate">{panel.name}</h4>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          panel.enabled 
                            ? 'bg-green-600/30 border border-green-500/50 text-green-300' 
                            : 'bg-gray-600/30 border border-gray-500/50 text-gray-300'
                        }`}>
                          {panel.enabled ? '✅ Ativo' : '⏸️ Pausado'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-2">
                        📺 Canal: <code className="px-2 py-1 bg-gray-800 rounded text-xs">{panel.channelId}</code>
                      </p>
                      <p className="text-xs text-gray-500">
                        📅 Criado: {new Date(panel.createdAt).toLocaleString('pt-PT')}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => togglePanel(panel.id, !panel.enabled)}
                        className="px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg text-sm font-medium transition-all duration-200 border border-gray-600/50"
                      >
                        {panel.enabled ? '⏸️ Pausar' : '▶️ Ativar'}
                      </button>
                      <button
                        onClick={() => deletePanel(panel.id)}
                        className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 rounded-lg text-sm font-medium text-red-300 transition-all duration-200"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-600/10 backdrop-blur-xl border border-blue-600/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-blue-200">
            <p className="font-semibold mb-2">Como funciona:</p>
            <ul className="space-y-1 text-blue-300/80">
              <li>• O painel será publicado automaticamente no canal selecionado</li>
              <li>• Os utilizadores clicam no botão para registar entrada/pausa/saída</li>
              <li>• Todas as interações são <strong>ephemeral</strong> (apenas visíveis para o utilizador)</li>
              <li>• Os registos ficam disponíveis no dashboard para consulta</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
