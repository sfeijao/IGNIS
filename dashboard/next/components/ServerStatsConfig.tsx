"use client"

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api } from '../lib/apiClient'
import { useToast } from './Toaster'

type StatCounter = {
  enabled: boolean
  channelId: string
  format: string
}

type StatsConfig = {
  enabled: boolean
  updateInterval: number
  totalMembers: StatCounter
  onlineMembers: StatCounter
  botCount: StatCounter
  channelCount: StatCounter
  roleCount: StatCounter
}

export default function ServerStatsConfig() {
  const params = useParams()
  const guildId = params?.gid as string
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [channels, setChannels] = useState<Array<{ id: string; name: string }>>([])
  
  const [config, setConfig] = useState<StatsConfig>({
    enabled: false,
    updateInterval: 5,
    totalMembers: { enabled: true, channelId: '', format: '👥 Membros: {count}' },
    onlineMembers: { enabled: false, channelId: '', format: '🟢 Online: {count}' },
    botCount: { enabled: false, channelId: '', format: '🤖 Bots: {count}' },
    channelCount: { enabled: false, channelId: '', format: '📝 Canais: {count}' },
    roleCount: { enabled: false, channelId: '', format: '🎭 Cargos: {count}' }
  })

  useEffect(() => {
    if (!guildId) return
    const load = async () => {
      setLoading(true)
      try {
        const [configRes, channelsRes] = await Promise.all([
          api.getStatsConfig(guildId),
          api.getChannels(guildId)
        ])
        if (configRes.config) setConfig(configRes.config)
        setChannels((channelsRes.channels || []).filter((c: any) => c.type === 2 || c.type === '2'))
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
      await api.saveStatsConfig(guildId, { config })
      toast({ type: 'success', title: '✅ Configuração guardada' })
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro ao guardar', description: e?.message })
    } finally {
      setSaving(false)
    }
  }, [guildId, config, toast])

  const updateCounter = (key: keyof Omit<StatsConfig, 'enabled' | 'updateInterval'>, field: string, value: any) => {
    setConfig(c => ({ ...c, [key]: { ...c[key], [field]: value } }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    )
  }

  const counters: Array<{ key: keyof Omit<StatsConfig, 'enabled' | 'updateInterval'>; icon: string; label: string }> = [
    { key: 'totalMembers', icon: '👥', label: 'Total de Membros' },
    { key: 'onlineMembers', icon: '🟢', label: 'Membros Online' },
    { key: 'botCount', icon: '🤖', label: 'Bots no Servidor' },
    { key: 'channelCount', icon: '📝', label: 'Total de Canais' },
    { key: 'roleCount', icon: '🎭', label: 'Total de Cargos' }
  ]

  return (
    <div className="space-y-6">
      {/* Global Settings */}
      <section className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-b border-gray-700/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            Configurações Globais
          </h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={config.enabled} 
              onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
        <div className="p-6">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Intervalo de Atualização (minutos)</label>
            <input 
              type="number" 
              min="1" 
              max="60" 
              value={config.updateInterval} 
              onChange={e => setConfig(c => ({ ...c, updateInterval: parseInt(e.target.value) || 5 }))}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              disabled={!config.enabled}
            />
            <p className="text-xs text-gray-500 mt-1">Os contadores serão atualizados automaticamente a cada {config.updateInterval} minutos</p>
          </div>
        </div>
      </section>

      {/* Counters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {counters.map(({ key, icon, label }) => (
          <section key={key} className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-2xl overflow-hidden shadow-xl">
            <div className="bg-gradient-to-r from-blue-600/10 to-cyan-600/10 border-b border-gray-700/50 px-4 py-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <span className="text-xl">{icon}</span>
                {label}
              </h4>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={config[key].enabled} 
                  onChange={e => updateCounter(key, 'enabled', e.target.checked)} 
                  disabled={!config.enabled}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-3 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block">Canal de Voz</label>
                <select 
                  value={config[key].channelId} 
                  onChange={e => updateCounter(key, 'channelId', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={!config.enabled || !config[key].enabled}
                >
                  <option value="">Selecione um canal de voz...</option>
                  {channels.map(ch => (
                    <option key={ch.id} value={ch.id}>🔊 {ch.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400 mb-1.5 block flex items-center gap-1">
                  Formato do Nome
                  <span className="text-[10px] text-gray-600">({'{count}'} = número)</span>
                </label>
                <input 
                  value={config[key].format} 
                  onChange={e => updateCounter(key, 'format', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-gray-900/50 border border-gray-700/50 rounded-lg focus:ring-2 focus:ring-blue-500 transition-all"
                  disabled={!config.enabled || !config[key].enabled}
                  placeholder={`${icon} ${label}: {count}`}
                />
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-300 mb-1">Como Funciona</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Os canais de voz selecionados terão seus nomes atualizados automaticamente</li>
              <li>• Use <code className="px-1 py-0.5 bg-gray-800 rounded text-blue-400">{'{count}'}</code> no formato para mostrar o número</li>
              <li>• Certifique-se de que o bot tem permissão "Gerenciar Canais"</li>
              <li>• Intervalos menores causam mais requisições à API do Discord</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button 
          onClick={save} 
          disabled={saving}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-medium transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
