"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { useToast } from './Toaster'

interface WebhookConfig {
  enabled: boolean
  url: string
  events: {
    ticketCreated: boolean
    ticketAssumed: boolean
    ticketClosed: boolean
    ticketTranscript: boolean
    scheduleReminder: boolean
  }
}

const EVENTS = [
  { key: 'ticketCreated', label: 'Ticket Criado', emoji: '🎫', desc: 'Quando um novo ticket é aberto' },
  { key: 'ticketAssumed', label: 'Ticket Assumido', emoji: '👤', desc: 'Quando alguém assume um ticket' },
  { key: 'ticketClosed', label: 'Ticket Fechado', emoji: '🔒', desc: 'Quando um ticket é encerrado' },
  { key: 'ticketTranscript', label: 'Transcript Gerado', emoji: '📄', desc: 'Quando o histórico é salvo' },
  { key: 'scheduleReminder', label: 'Lembrete de Agenda', emoji: '📅', desc: 'Lembretes de eventos agendados' }
]

export default function WebhookConfigSimple() {
  const guildId = useGuildId()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  
  const [config, setConfig] = useState<WebhookConfig>({
    enabled: false,
    url: '',
    events: {
      ticketCreated: true,
      ticketAssumed: true,
      ticketClosed: true,
      ticketTranscript: true,
      scheduleReminder: false
    }
  })

  useEffect(() => {
    if (guildId) loadConfig()
  }, [guildId])

  const loadConfig = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhook-unified`, { credentials: 'include' })
      const data = await res.json()
      if (data.success && data.config) {
        setConfig(data.config)
      }
    } catch (e: any) {
      console.error('Failed to load webhook config:', e)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!guildId) return
    
    // Validar URL se webhook está habilitado
    if (config.enabled && !config.url.trim()) {
      toast({ type: 'error', title: 'URL obrigatória', description: 'Insira uma URL de webhook do Discord' })
      return
    }
    
    if (config.enabled && !/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(config.url)) {
      toast({ type: 'error', title: 'URL inválida', description: 'Use uma URL de webhook válida do Discord' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhook-unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config)
      })
      const data = await res.json()
      
      if (data.success) {
        toast({ type: 'success', title: 'Configuração salva!' })
        if (data.config) setConfig(data.config)
      } else {
        toast({ type: 'error', title: 'Erro ao salvar', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setSaving(false)
    }
  }

  const testWebhook = async () => {
    if (!guildId || !config.url.trim()) {
      toast({ type: 'error', title: 'URL obrigatória para teste' })
      return
    }

    setTesting(true)
    try {
      const res = await fetch(`/api/guild/${guildId}/webhook-unified/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ url: config.url })
      })
      const data = await res.json()
      
      if (data.success) {
        toast({ type: 'success', title: 'Teste enviado!', description: 'Verifica o canal do webhook' })
      } else {
        toast({ type: 'error', title: 'Falha no teste', description: data.error })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: e.message })
    } finally {
      setTesting(false)
    }
  }

  const toggleEvent = (eventKey: keyof WebhookConfig['events']) => {
    setConfig(c => ({
      ...c,
      events: { ...c.events, [eventKey]: !c.events[eventKey] }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50">
        <div className="flex items-start gap-4">
          <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-4 rounded-xl">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Webhook Unificado
            </h1>
            <p className="text-gray-400 mt-2">
              Configure um único webhook para receber notificações de todos os eventos do bot
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${config.enabled ? 'bg-green-600/20' : 'bg-gray-700/20'}`}>
              {config.enabled ? '✅' : '⚪'}
            </div>
            <div>
              <h3 className="text-lg font-semibold">Webhook Ativado</h3>
              <p className="text-sm text-gray-400">Enviar notificações para o webhook configurado</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              config.enabled ? 'bg-gradient-to-r from-green-600 to-emerald-600' : 'bg-gray-700'
            }`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
              config.enabled ? 'translate-x-7' : 'translate-x-1'
            }`} />
          </button>
        </label>
      </div>

      {/* Webhook URL */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <label className="block mb-2 font-semibold flex items-center gap-2">
          <span>🔗</span> URL do Webhook do Discord
        </label>
        <div className="flex gap-3">
          <input
            type="url"
            value={config.url}
            onChange={e => setConfig(c => ({ ...c, url: e.target.value }))}
            placeholder="https://discord.com/api/webhooks/..."
            className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
          />
          <button
            type="button"
            onClick={testWebhook}
            disabled={testing || !config.url.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {testing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Testando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
                Testar
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          💡 <strong>Como obter:</strong> No Discord → Configurações do canal → Integrações → Webhooks → Novo Webhook → Copiar URL
        </p>
      </div>

      {/* Events Selection */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span>🔔</span> Eventos a Notificar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EVENTS.map(event => (
            <label
              key={event.key}
              className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                config.events[event.key as keyof WebhookConfig['events']]
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <input
                type="checkbox"
                checked={config.events[event.key as keyof WebhookConfig['events']]}
                onChange={() => toggleEvent(event.key as keyof WebhookConfig['events'])}
                className="mt-1 w-5 h-5 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">{event.emoji}</span>
                  <span className="font-semibold">{event.label}</span>
                </div>
                <p className="text-sm text-gray-400">{event.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => guildId && loadConfig()}
          disabled={loading}
          className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 rounded-lg border border-gray-600/50 transition-all duration-200 disabled:opacity-50"
        >
          Cancelar Alterações
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transform hover:scale-[1.02]"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Salvando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Salvar Configuração
            </>
          )}
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <span className="text-3xl">💡</span>
          <div>
            <h4 className="font-semibold text-blue-300 mb-2">Como funciona?</h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Configure <strong>um único webhook</strong> para todos os eventos</li>
              <li>• Escolha quais eventos deseja receber notificações</li>
              <li>• O bot enviará <strong>mensagens bonitas</strong> com embeds coloridos</li>
              <li>• Cada atualização substitui a anterior (sem spam!)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
