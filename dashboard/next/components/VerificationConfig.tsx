"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useToast } from '@/components/Toaster'

type VerificationConfig = {
  enabled: boolean
  channelId?: string
  roleId?: string
  captchaEnabled: boolean
  rulesText?: string
  welcomeMessage?: string
}

export default function VerificationConfig() {
  const guildId = useGuildId()
  const { toast } = useToast()
  const [config, setConfig] = useState<VerificationConfig>({
    enabled: false,
    captchaEnabled: false
  })
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([])

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const [configRes, channelsRes, rolesRes] = await Promise.all([
        api.getVerificationConfig(guildId),
        api.getChannels(guildId),
        api.getRoles(guildId)
      ])
      setConfig(configRes || { enabled: false, captchaEnabled: false })
      setChannels(channelsRes.channels || [])
      setRoles(rolesRes.roles || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [guildId])

  const save = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      await api.saveVerificationConfig(guildId, config)
      toast({ type: 'success', title: 'Configuração guardada!' })
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro ao guardar', description: e?.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">✅</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Sistema de Verificação
              </h2>
              <p className="text-gray-400 text-sm mt-1">Proteja seu servidor contra raids e bots</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-purple-600 peer-checked:to-pink-600"></div>
          </label>
        </div>
      </div>

      {/* Canal de Verificação */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📺</span>
          <h3 className="text-xl font-semibold">Canal de Verificação</h3>
        </div>
        <select
          value={config.channelId || ''}
          onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        >
          <option value="">Selecione um canal...</option>
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              #{ch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cargo de Verificado */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🎭</span>
          <h3 className="text-xl font-semibold">Cargo de Verificado</h3>
        </div>
        <select
          value={config.roleId || ''}
          onChange={(e) => setConfig({ ...config, roleId: e.target.value })}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
        >
          <option value="">Selecione um cargo...</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>

      {/* Captcha */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="text-xl font-semibold">Captcha de Verificação</h3>
              <p className="text-sm text-gray-400 mt-1">Proteção extra contra bots automatizados</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={config.captchaEnabled}
              onChange={(e) => setConfig({ ...config, captchaEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-gray-700 peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-600 peer-checked:to-emerald-600"></div>
          </label>
        </div>
      </div>

      {/* Mensagem de Boas-Vindas */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">💬</span>
          <h3 className="text-xl font-semibold">Mensagem de Boas-Vindas</h3>
        </div>
        <textarea
          value={config.welcomeMessage || ''}
          onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
          placeholder="Bem-vindo(a) {user}! Complete a verificação para ter acesso ao servidor."
          rows={4}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
        />
        <p className="text-xs text-gray-500 mt-2">💡 Use {'{user}'} para mencionar o usuário</p>
      </div>

      {/* Regras do Servidor */}
      <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📜</span>
          <h3 className="text-xl font-semibold">Regras do Servidor</h3>
        </div>
        <textarea
          value={config.rulesText || ''}
          onChange={(e) => setConfig({ ...config, rulesText: e.target.value })}
          placeholder="1. Seja respeitoso com todos&#10;2. Sem spam ou flood&#10;3. Sem conteúdo NSFW..."
          rows={6}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
        />
      </div>

      {/* Save Button */}
      <button
        onClick={save}
        disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Guardando...' : '💾 Guardar Configurações'}
      </button>
    </div>
  )
}
