"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

type Webhook = { id: string; name: string; url: string; avatar?: string; channelId?: string }

export default function WebhooksManager() {
  const guildId = useGuildId()
  const { t } = useI18n()
  const { toast } = useToast()
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await api.getWebhooks(guildId)
      setWebhooks(res.webhooks || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [guildId])

  const testWebhook = async (url: string, id: string) => {
    setTesting(id)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '🔔 Teste de webhook do IGNIS Dashboard!',
          embeds: [{
            title: '✅ Webhook Funcionando',
            description: 'Este é um teste automático do sistema de webhooks.',
            color: 0x9333EA,
            timestamp: new Date().toISOString()
          }]
        })
      })
      if (response.ok) {
        toast({ type: 'success', title: 'Webhook testado com sucesso!' })
      } else {
        toast({ type: 'error', title: 'Erro ao testar webhook' })
      }
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro', description: (e instanceof Error ? e.message : String(e)) })
    } finally {
      setTesting(null)
    }
  }

  const deleteWebhook = async (id: string) => {
    if (!guildId || !confirm('Remover este webhook?')) return
    setLoading(true)
    try {
      await api.deleteWebhook(guildId, id)
      toast({ type: 'success', title: 'Webhook removido!' })
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-teal-600/20 to-green-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🔗</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 to-green-400 bg-clip-text text-transparent">
                Gestão de Webhooks
              </h2>
              <p className="text-gray-400 text-sm mt-1">Configure e teste webhooks do Discord</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
          </label>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-600/20 to-green-600/20 flex items-center justify-center">
              <span className="text-2xl">🔗</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total de Webhooks</p>
              <p className="text-2xl font-bold">{webhooks ? webhooks.length : 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-600/20 to-emerald-600/20 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Webhooks Ativos</p>
              <p className="text-2xl font-bold">{webhooks && webhooks.filter(w => w.url).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-600/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h4 className="font-semibold text-blue-300 mb-1">Como usar Webhooks</h4>
            <p className="text-sm text-gray-300 leading-relaxed">
              Webhooks permitem que aplicações externas enviem mensagens automaticamente para canais do Discord.
              Use o botão "Testar" para verificar se o webhook está funcionando corretamente.
            </p>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      <div className="space-y-4">
        {webhooks && webhooks.map((webhook) => (
          <div
            key={webhook.id}
            className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5 hover:border-teal-500/50 transition-all"
          >
            <div className="flex items-start gap-4">
              {webhook.avatar && (
                <img
                  src={webhook.avatar}
                  alt={webhook.name}
                  className="w-12 h-12 rounded-full border-2 border-gray-600"
                />
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">{webhook.name}</h3>
                <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                  <p className="text-sm text-gray-400 font-mono break-all">{webhook.url}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testWebhook(webhook.url, webhook.id)}
                    disabled={testing === webhook.id}
                    className="px-4 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/50 rounded-lg transition-all disabled:opacity-50"
                  >
                    {testing === webhook.id ? '⏳ Testando...' : '🧪 Testar'}
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(webhook.url)}
                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 rounded-lg transition-all"
                  >
                    📋 Copiar URL
                  </button>
                  <button
                    onClick={() => deleteWebhook(webhook.id)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg transition-all ml-auto"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {webhooks.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhum webhook configurado</h3>
          <p className="text-gray-500">Configure webhooks nas configurações do servidor no Discord</p>
        </div>
      )}
    </div>
  )
}
