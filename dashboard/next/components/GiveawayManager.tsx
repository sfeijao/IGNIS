"use client"

import { useState } from 'react'

interface GiveawayManagerProps {
  giveaway: any
  guildId: string
  onUpdate?: () => void
}

export default function GiveawayManager({ giveaway, guildId, onUpdate }: GiveawayManagerProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [editForm, setEditForm] = useState({
    title: giveaway?.title || '',
    description: giveaway?.description || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleEdit = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${giveaway._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao editar')
      setShowEditModal(false)
      onUpdate?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEnd = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${giveaway._id}/end`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao terminar')
      setShowEndModal(false)
      onUpdate?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleReroll = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/guilds/${guildId}/giveaways/${giveaway._id}/reroll`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao sortear novamente')
      onUpdate?.()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => {
          setEditForm({ title: giveaway?.title || '', description: giveaway?.description || '' })
          setShowEditModal(true)
        }}
        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors"
      >
        ✏️ Editar
      </button>

      {giveaway?.status === 'active' && (
        <button
          onClick={() => setShowEndModal(true)}
          className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
        >
          🛑 Terminar Antecipadamente
        </button>
      )}

      {giveaway?.status === 'ended' && (
        <button
          onClick={handleReroll}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors disabled:opacity-50"
        >
          🔄 Sortear Novamente
        </button>
      )}

      {error && (
        <div className="w-full p-3 rounded-lg bg-red-900/30 border border-red-700 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Editar Giveaway</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Título</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Descrição</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={handleEdit}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Terminar */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-xl border border-neutral-700 max-w-md w-full p-6">
            <h3 className="text-xl font-semibold mb-4">Terminar Giveaway</h3>
            <p className="text-neutral-300 mb-6">
              Tens a certeza que queres terminar este giveaway antecipadamente? 
              Os vencedores serão escolhidos agora.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleEnd}
                disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Terminando...' : 'Sim, Terminar'}
              </button>
              <button
                onClick={() => setShowEndModal(false)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
