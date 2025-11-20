"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'

type WelcomeConfig = {
  enabled: boolean
  channelId: string
  message: string
  embedEnabled: boolean
  embedTitle: string
  embedDescription: string
  embedColor: string
  embedImage: string
  embedThumbnail: string
}

type GoodbyeConfig = {
  enabled: boolean
  channelId: string
  message: string
  embedEnabled: boolean
  embedTitle: string
  embedDescription: string
  embedColor: string
}

export default function WelcomeGoodbyeConfig() {
  const params = useParams()
  const guildId = params?.gid as string
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])

  const [welcome, setWelcome] = useState<WelcomeConfig>({
    enabled: false,
    channelId: '',
    message: 'Bem-vindo(a) {user}! 🎉',
    embedEnabled: true,
    embedTitle: 'Novo Membro! 👋',
    embedDescription: '{user} acabou de entrar no servidor!',
    embedColor: '#7C3AED',
    embedImage: '',
    embedThumbnail: '{avatar}'
  })

  const [goodbye, setGoodbye] = useState<GoodbyeConfig>({
    enabled: false,
    channelId: '',
    message: '{user} saiu do servidor. 😢',
    embedEnabled: true,
    embedTitle: 'Membro Saiu 👋',
    embedDescription: '{user} deixou o servidor.',
    embedColor: '#EF4444'
  })

  useEffect(() => {
    if (!guildId) return
    const load = async () => {
      setLoading(true)
      try {
        const [configRes, channelsRes] = await Promise.all([
          api.getWelcomeConfig(guildId),
          api.getChannels(guildId)
        ])
        if (configRes.welcome) setWelcome(configRes.welcome)
        if (configRes.goodbye) setGoodbye(configRes.goodbye)
        setChannels((channelsRes.channels || []).filter((c: any) => c.type === 0 || c.type === '0'))
      } catch (e: any) {
        toast({ type: 'error', title: 'Erro ao carregar', description: e?.message })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [guildId, toast])

  const save = useCallback(async () => {
    if (!guildId) return
    setSaving(true)
    try {
      await api.saveWelcomeConfig(guildId, { welcome, goodbye })
      toast({ type: 'success', title: '✅ Configuração guardada' })
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro ao guardar', description: e?.message })
    } finally {
      setSaving(false)
    }
  }, [guildId, welcome, goodbye, toast])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">👋</span>
            Mensagem de Boas-Vindas
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={welcome.enabled}
              onChange={e => setWelcome(w => ({ ...w, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          </label>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Canal de Boas-Vindas</label>
            <select
              value={welcome.channelId}
              onChange={e => setWelcome(w => ({ ...w, channelId: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              disabled={!welcome.enabled}
            >
              <option value="">Selecione um canal...</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block flex items-center gap-2">
              Mensagem
              <span className="text-xs text-gray-500">({'{user}'} = @membro, {'{server}'} = nome servidor)</span>
            </label>
            <textarea
              value={welcome.message}
              onChange={e => setWelcome(w => ({ ...w, message: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-y min-h-[80px]"
              disabled={!welcome.enabled}
              placeholder="Bem-vindo(a) {user}! 🎉"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={welcome.embedEnabled}
              onChange={e => setWelcome(w => ({ ...w, embedEnabled: e.target.checked }))}
              disabled={!welcome.enabled}
              className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
            />
            <label className="text-sm font-medium text-gray-300">Usar Embed (mensagem rica)</label>
          </div>

          {welcome.embedEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7 border-l-2 border-green-500/30">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Título do Embed</label>
                <input
                  value={welcome.embedTitle}
                  onChange={e => setWelcome(w => ({ ...w, embedTitle: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-green-500 transition-all"
                  disabled={!welcome.enabled}
                  placeholder="Novo Membro!"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Cor do Embed</label>
                <input
                  type="color"
                  value={welcome.embedColor}
                  onChange={e => setWelcome(w => ({ ...w, embedColor: e.target.value }))}
                  className="w-full h-10 bg-gray-900/50 border border-gray-700/50 rounded-lg cursor-pointer"
                  disabled={!welcome.enabled}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Descrição do Embed</label>
                <textarea
                  value={welcome.embedDescription}
                  onChange={e => setWelcome(w => ({ ...w, embedDescription: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-green-500 transition-all resize-y min-h-[60px]"
                  disabled={!welcome.enabled}
                  placeholder="{user} acabou de entrar!"
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Goodbye Section */}
      <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-red-600/20 to-pink-600/20 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">👋</span>
            Mensagem de Despedida
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={goodbye.enabled}
              onChange={e => setGoodbye(g => ({ ...g, enabled: e.target.checked }))}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Canal de Despedida</label>
            <select
              value={goodbye.channelId}
              onChange={e => setGoodbye(g => ({ ...g, channelId: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              disabled={!goodbye.enabled}
            >
              <option value="">Selecione um canal...</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.id}>#{ch.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Mensagem de Despedida</label>
            <textarea
              value={goodbye.message}
              onChange={e => setGoodbye(g => ({ ...g, message: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all resize-y min-h-[80px]"
              disabled={!goodbye.enabled}
              placeholder="{user} saiu do servidor. 😢"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              checked={goodbye.embedEnabled}
              onChange={e => setGoodbye(g => ({ ...g, embedEnabled: e.target.checked }))}
              disabled={!goodbye.enabled}
              className="w-4 h-4 text-red-600 bg-gray-700 border-gray-600 rounded focus:ring-red-500"
            />
            <label className="text-sm font-medium text-gray-300">Usar Embed</label>
          </div>

          {goodbye.embedEnabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7 border-l-2 border-red-500/30">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Título do Embed</label>
                <input
                  value={goodbye.embedTitle}
                  onChange={e => setGoodbye(g => ({ ...g, embedTitle: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-red-500 transition-all"
                  disabled={!goodbye.enabled}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Cor do Embed</label>
                <input
                  type="color"
                  value={goodbye.embedColor}
                  onChange={e => setGoodbye(g => ({ ...g, embedColor: e.target.value }))}
                  className="w-full h-10 bg-gray-900/50 border border-gray-700/50 rounded-lg cursor-pointer"
                  disabled={!goodbye.enabled}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-300 mb-2 block">Descrição</label>
                <textarea
                  value={goodbye.embedDescription}
                  onChange={e => setGoodbye(g => ({ ...g, embedDescription: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-red-500 transition-all resize-y min-h-[60px]"
                  disabled={!goodbye.enabled}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && (
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {saving ? 'A Guardar...' : '💾 Guardar Configuração'}
        </button>
      </div>
    </div>
  )
}
