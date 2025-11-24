'use client'

import { useRoles } from '@/hooks/useGuildData'

interface OptimizedRoleSelectProps {
  guildId: string | null | undefined
  value: string | string[]
  onChange: (roleId: string | string[]) => void
  multiple?: boolean
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  showRefresh?: boolean
  excludeManaged?: boolean
}

export default function OptimizedRoleSelect({
  guildId,
  value,
  onChange,
  multiple = false,
  label,
  placeholder = 'Selecione um cargo...',
  required = false,
  disabled = false,
  className = '',
  showRefresh = true,
  excludeManaged = false
}: OptimizedRoleSelectProps) {
  const { roles, loading, error, botMaxPosition, refetch } = useRoles(guildId)

  const filteredRoles = excludeManaged ? roles.filter(r => !r.managed) : roles

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (multiple) {
      const selected = Array.from(e.target.selectedOptions).map(opt => opt.value)
      onChange(selected)
    } else {
      onChange(e.target.value)
    }
  }

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
        onChange={handleChange}
        required={required}
        disabled={disabled || loading}
        multiple={multiple}
        className={`w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          multiple ? 'min-h-[120px]' : ''
        }`}
      >
        {!multiple && <option value="">{loading ? 'Carregando...' : placeholder}</option>}
        {error && <option value="" disabled>❌ {error}</option>}
        {!loading && !error && filteredRoles.length === 0 && (
          <option value="" disabled>Nenhum cargo disponível</option>
        )}
        {filteredRoles.map((role) => {
          const isManaged = role.managed ? ' 🔒' : ''
          const isAboveBot = role.position >= botMaxPosition ? ' ⚠️' : ''
          const colorDot = role.color !== '#000000' ? `●` : '○'
          
          return (
            <option 
              key={role.id} 
              value={role.id}
              style={{ color: role.color !== '#000000' ? role.color : undefined }}
              disabled={!role.manageable && !multiple}
            >
              {colorDot} {role.name}{isManaged}{isAboveBot}
            </option>
          )
        })}
      </select>
      
      {error && !loading && (
        <p className="text-xs text-red-400">
          ⚠️ {error} - <button type="button" onClick={refetch} className="underline hover:text-red-300">Tentar novamente</button>
        </p>
      )}
      
      {multiple && (
        <p className="text-xs text-gray-500">
          💡 Segure Ctrl/Cmd para selecionar múltiplos cargos
        </p>
      )}
    </div>
  )
}
