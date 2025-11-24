'use client'

import { useChannels } from '@/hooks/useGuildData'

interface OptimizedChannelSelectProps {
  guildId: string | null | undefined
  value: string
  onChange: (channelId: string) => void
  types?: number[] // 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
  includeCategories?: boolean
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  showRefresh?: boolean
}

export default function OptimizedChannelSelect({
  guildId,
  value,
  onChange,
  types = [0], // Default to text channels
  includeCategories = false,
  label,
  placeholder = 'Selecione um canal...',
  required = false,
  disabled = false,
  className = '',
  showRefresh = true
}: OptimizedChannelSelectProps) {
  const { channels, loading, error, refetch } = useChannels(guildId, { types, includeCategories })

  return (
    <div className={`space-y-2 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">{label}</label>
          {showRefresh && (
            <button
              type="button"
              onClick={refetch}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-gray-300 transition-colors disabled:opacity-50"
            >
              {loading ? '🔄 Carregando...' : '🔄 Atualizar'}
            </button>
          )}
        </div>
      )}
      
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled || loading}
        className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">{loading ? 'Carregando...' : placeholder}</option>
        {error && <option value="" disabled>❌ {error}</option>}
        {!loading && !error && channels.length === 0 && (
          <option value="" disabled>Nenhum canal disponível</option>
        )}
        {channels.map((channel: { id: string; name: string; type: number; parentName?: string }) => {
          const emojiMap: Record<number, string> = {
            0: '💬', // text
            2: '🔊', // voice
            4: '📁', // category
            5: '📢', // announcement
            13: '🎤', // stage
            15: '💭' // forum
          }
          const emoji = emojiMap[channel.type] || '📝'
          
          return (
            <option key={channel.id} value={channel.id}>
              {emoji} {channel.parentName ? `${channel.parentName} > ` : ''}{channel.name}
            </option>
          )
        })}
      </select>
      
      {error && !loading && (
        <p className="text-xs text-red-400">
          ⚠️ {error} - <button type="button" onClick={refetch} className="underline hover:text-red-300">Tentar novamente</button>
        </p>
      )}
    </div>
  )
}
