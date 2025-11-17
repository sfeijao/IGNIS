"use client"

import { useState, useEffect } from 'react'

interface Participant {
  user_id: string
  username?: string
  avatar?: string
  joined_at?: string
}

interface ParticipantsListProps {
  guildId: string
  giveawayId: string
}

export default function ParticipantsList({ guildId, giveawayId }: ParticipantsListProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadParticipants()
  }, [guildId, giveawayId, page])

  const loadParticipants = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/guilds/${guildId}/giveaways/${giveawayId}/entries?page=${page}&limit=${pageSize}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao carregar participantes')
      
      setParticipants(json.entries || [])
      setTotalCount(json.total || 0)
      setTotalPages(Math.ceil((json.total || 0) / pageSize))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredParticipants = participants.filter(p => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      p.user_id.toLowerCase().includes(query) ||
      p.username?.toLowerCase().includes(query)
    )
  })

  return (
    <div className="space-y-4">
      {/* Header com pesquisa */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Procurar participante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
          />
        </div>
        <div className="text-sm opacity-70">
          {totalCount} participante{totalCount !== 1 ? 's' : ''}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Lista de participantes */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-neutral-500">
          <svg className="animate-spin h-6 w-6 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          A carregar...
        </div>
      ) : filteredParticipants.length === 0 ? (
        <div className="text-center py-8 text-neutral-500">
          {searchQuery ? 'Nenhum participante encontrado' : 'Ainda não há participantes'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredParticipants.map((participant, idx) => (
            <div
              key={participant.user_id}
              className="flex items-center gap-3 p-3 rounded-lg bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-colors"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold">
                {participant.username?.[0]?.toUpperCase() || '?'}
              </div>
              
              {/* Info */}
              <div className="flex-1">
                <div className="font-medium">
                  {participant.username || `Utilizador ${participant.user_id}`}
                </div>
                <div className="text-xs opacity-60">
                  ID: {participant.user_id}
                </div>
              </div>

              {/* Badge de posição */}
              <div className="text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400">
                #{(page - 1) * pageSize + idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>
          
          <span className="px-4 text-sm">
            Página {page} de {totalPages}
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Seguinte →
          </button>
        </div>
      )}
    </div>
  )
}
