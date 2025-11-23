"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { useToast } from './Toaster'

interface Webhook {
  _id: string
  name: string
  url: string
  types: string[]
  enabled: boolean
  createdAt: string
  lastTestedAt?: string
  lastTestSuccess?: boolean
}

interface WebhookConfig {
  _id: string
  guildId: string
  logsEnabled: {
    tickets: boolean
    moderation: boolean
    giveaways: boolean
    automod: boolean
    verification: boolean
  }
  webhooks: Webhook[]
}

const LOG_TYPES = [
  { key: 'tickets', label: 'Tickets', emoji: '🎫', desc: 'Criação, atualização e encerramento de tickets' },
  { key: 'moderation', label: 'Moderação', emoji: '🛡️', desc: 'Warns, kicks, bans e timeouts' },
  { key: 'giveaways', label: 'Giveaways', emoji: '🎁', desc: 'Criação e resultados de sorteios' },
  { key: 'automod', label: 'AutoMod', emoji: '🤖', desc: 'Mensagens filtradas automaticamente' },
  { key: 'verification', label: 'Verificação', emoji: '✅', desc: 'Verificações de membros' }
]

export default function WebhookConfigManager() {
  const guildId = useGuildId()
  const { toast } = useToast()
  const [config, setConfig] = useState<WebhookConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    types: [] as string[]
  })

  useEffect(() => {
    loadConfig()
  }, [guildId])

  const loadConfig = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setConfig(data.config)
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const addWebhook = async () => {
    if (!guildId) return

    // Validações
    if (!formData.name.trim()) {
      toast({ type: 'error', title: 'Nome obrigatório' })
      return
    }
    if (!formData.url.trim()) {
      toast({ type: 'error', title: 'URL obrigatória' })
      return
    }
    if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(formData.url)) {
      toast({ type: 'error', title: 'URL inválida', description: 'Use uma URL de webhook do Discord válida' })
      return
    }
    if (formData.types.length === 0) {
      toast({ type: 'error', title: 'Selecione pelo menos um tipo de log' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })
      const data = await res.json()

      if (data.success) {
        setConfig(data.config)
        setFormData({ name: '', url: '', types: [] })
        setShowAddForm(false)
        toast({ type: 'success', title: 'Webhook adicionado com sucesso!' })
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const removeWebhook = async (webhookId: string) => {
    if (!guildId || !confirm('Tem certeza que deseja remover este webhook?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/${webhookId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        setConfig(data.config)
        toast({ type: 'success', title: 'Webhook removido' })
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const editWebhook = (webhook: Webhook) => {
    setEditingWebhook(webhook)
    setFormData({
      name: webhook.name,
      url: webhook.url,
      types: webhook.types
    })
  }

  const saveEditWebhook = async () => {
    if (!guildId || !editingWebhook) return

    // Validações
    if (!formData.name.trim()) {
      toast({ type: 'error', title: 'Nome obrigatório' })
      return
    }
    if (!formData.url.trim()) {
      toast({ type: 'error', title: 'URL obrigatória' })
      return
    }
    if (!/^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(formData.url)) {
      toast({ type: 'error', title: 'URL inválida', description: 'Use uma URL de webhook do Discord válida' })
      return
    }
    if (formData.types.length === 0) {
      toast({ type: 'error', title: 'Selecione pelo menos um tipo de log' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/${editingWebhook._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          url: formData.url,
          events: formData.types,
          enabled: editingWebhook.enabled
        })
      })
      const data = await res.json()

      if (data.success) {
        setConfig(data.config)
        setFormData({ name: '', url: '', types: [] })
        setEditingWebhook(null)
        toast({ type: 'success', title: 'Webhook atualizado com sucesso!' })
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const toggleWebhook = async (webhookId: string, currentEnabled: boolean) => {
    if (!guildId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/${webhookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: !currentEnabled })
      })
      const data = await res.json()

      if (data.success) {
        setConfig(data.config)
        toast({ type: 'success', title: currentEnabled ? 'Webhook desativado' : 'Webhook ativado' })
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const testWebhook = async (webhookId: string) => {
    if (!guildId) return

    setTesting(webhookId)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/${webhookId}/test`, {
        method: 'POST',
        credentials: 'include'
      })
      const data = await res.json()

      if (data.success) {
        toast({ type: 'success', title: '✅ Webhook testado com sucesso!', description: 'Verifique o canal de destino' })
        await loadConfig() // Recarregar para atualizar lastTestedAt
      } else {
        toast({ type: 'error', title: '❌ Falha no teste', description: 'Webhook pode estar inválido' })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setTesting(null)
    }
  }

  const toggleLogType = async (logType: string, currentValue: boolean) => {
    if (!guildId) return

    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhooks-config/logs-enabled`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          logsEnabled: { [logType]: !currentValue }
        })
      })
      const data = await res.json()

      if (data.success) {
        setConfig(data.config)
      } else {
        toast({ type: 'error', title: 'Erro', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const toggleFormType = (type: string) => {
    setFormData(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }))
  }

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="inline-block w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-gray-400 ml-4">A carregar configuração...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔗</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Sistema de Webhooks
              </h2>
              <p className="text-gray-400 text-sm mt-1">Configure webhooks externos para receber logs em outros servidores</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-7 after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
          </label>
        </div>
      </div>

      {/* Tipos de Logs Habilitados */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">⚙️</span>
          <h3 className="text-lg font-semibold text-white">Tipos de Logs Habilitados</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOG_TYPES.map(logType => (
            <div key={logType.key} className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{logType.emoji}</span>
                  <span className="text-white font-medium">{logType.label}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config?.logsEnabled[logType.key as keyof typeof config.logsEnabled] || false}
                    onChange={() => toggleLogType(logType.key, config?.logsEnabled[logType.key as keyof typeof config.logsEnabled] || false)}
                    disabled={!enabled}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-600 peer-checked:to-emerald-600 peer-disabled:opacity-50"></div>
                </label>
              </div>
              <p className="text-xs text-gray-400">{logType.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lista de Webhooks */}
      <div className="bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <h3 className="text-lg font-semibold text-white">Webhooks Configurados ({config?.webhooks.length || 0})</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-lg transition-all duration-200 font-medium"
            disabled={!enabled}
          >
            {showAddForm ? '❌ Cancelar' : '➕ Adicionar Webhook'}
          </button>
        </div>

        {/* Formulário de Adicionar */}
        {showAddForm && !editingWebhook && (
          <div className="bg-gray-900/50 border border-purple-600/50 rounded-xl p-6 mb-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">➕</span>
              Novo Webhook
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome do Webhook</label>
                <input
                  type="text"
                  placeholder="Ex: VOGs Servidor Y"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">URL do Webhook</label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Cole a URL completa do webhook do Discord</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-3 font-medium">Receber logs de:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LOG_TYPES.map(logType => (
                    <label key={logType.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.types.includes(logType.key)}
                        onChange={() => toggleFormType(logType.key)}
                        className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-300">{logType.emoji} {logType.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={addWebhook}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? 'A adicionar...' : 'Adicionar Webhook'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Formulário de Editar */}
        {editingWebhook && (
          <div className="bg-gray-900/50 border border-yellow-600/50 rounded-xl p-6 mb-6">
            <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span className="text-xl">✏️</span>
              Editar Webhook
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome do Webhook</label>
                <input
                  type="text"
                  placeholder="Ex: Logs Servidor Y"
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">URL do Webhook</label>
                <input
                  type="text"
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Cole a URL completa do webhook do Discord</p>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-3 font-medium">Receber logs de:</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {LOG_TYPES.map(logType => (
                    <label key={logType.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.types.includes(logType.key)}
                        onChange={() => toggleFormType(logType.key)}
                        className="w-4 h-4 text-yellow-600 bg-gray-700 border-gray-600 rounded focus:ring-yellow-500"
                      />
                      <span className="text-sm text-gray-300">{logType.emoji} {logType.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={saveEditWebhook}
                  className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white rounded-xl font-semibold transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? 'A guardar...' : 'Guardar Alterações'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingWebhook(null)
                    setFormData({ name: '', url: '', types: [] })
                  }}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-all duration-200"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {!config || config.webhooks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <div className="text-gray-400">Nenhum webhook configurado</div>
              <p className="text-sm text-gray-500 mt-2">Clique em "Adicionar Webhook" para começar</p>
            </div>
          ) : (
            config.webhooks.map(webhook => (
              <div key={webhook._id} className="bg-gray-900/50 border border-gray-700 hover:border-purple-600/50 rounded-xl p-5 transition-all duration-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">🔗</span>
                      <h4 className="text-white font-semibold">{webhook.name}</h4>
                      {webhook.enabled ? (
                        <span className="px-2 py-1 bg-green-600/20 text-green-400 rounded-lg text-xs">✓ Ativo</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-600/20 text-gray-400 rounded-lg text-xs">○ Inativo</span>
                      )}
                      {webhook.lastTestSuccess !== undefined && (
                        <span className={`px-2 py-1 rounded-lg text-xs ${webhook.lastTestSuccess ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>
                          {webhook.lastTestSuccess ? '✓ Teste OK' : '✗ Falhou'}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 font-mono truncate mb-2">
                      {webhook.url.substring(0, 60)}...
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {webhook.types.map(type => {
                        const logType = LOG_TYPES.find(lt => lt.key === type)
                        return (
                          <span key={type} className="px-2 py-1 bg-purple-600/20 text-purple-400 rounded-lg text-xs">
                            {logType?.emoji} {logType?.label}
                          </span>
                        )
                      })}
                    </div>
                    {webhook.lastTestedAt && (
                      <div className="text-xs text-gray-500 mt-2">
                        Último teste: {new Date(webhook.lastTestedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => editWebhook(webhook)}
                      className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-all text-sm font-medium"
                      disabled={!enabled}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => testWebhook(webhook._id)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all text-sm font-medium"
                      disabled={testing === webhook._id || !enabled}
                    >
                      {testing === webhook._id ? '⏳' : '🧪'} Testar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWebhook(webhook._id, webhook.enabled)}
                      className={`px-3 py-2 rounded-lg transition-all text-sm font-medium ${webhook.enabled ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'} text-white`}
                      disabled={!enabled}
                    >
                      {webhook.enabled ? '⏸️ Pausar' : '▶️ Ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeWebhook(webhook._id)}
                      className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all text-sm font-medium"
                      disabled={!enabled}
                    >
                      🗑️ Remover
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Informação de Ajuda */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div>
            <h4 className="text-blue-400 font-semibold mb-1">Como funciona?</h4>
            <p className="text-sm text-gray-300 mb-2">
              Os webhooks permitem enviar logs para outros servidores Discord. Cada log gera UMA única mensagem que é atualizada conforme o evento evolui.
            </p>
            <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
              <li>Crie um webhook no servidor de destino (Configurações do Canal → Integrações)</li>
              <li>Cole a URL aqui e selecione os tipos de logs desejados</li>
              <li>Ative os tipos de logs que deseja receber</li>
              <li>Use o botão "Testar" para verificar se está funcionando</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
