"use client"

import { useEffect, useState } from 'react'
import { useGuildId } from '@/lib/guild'
import { api } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/components/Toaster'

type Tag = { id: string; name: string; prefix: string; color?: string; icon?: string; roleIds?: string[] }

export default function QuickTagsManager() {
  const guildId = useGuildId()
  const { t } = useI18n()
  const { toast } = useToast()
  const [tags, setTags] = useState<Tag[]>([])
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<Partial<Tag>>({ name: '', prefix: '', color: '#5865F2', icon: '🏷️' })

  const load = async () => {
    if (!guildId) return
    setLoading(true)
    try {
      const res = await api.getTags(guildId)
      setTags(res.tags || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [guildId])

  const saveTag = async () => {
    if (!guildId) return
    if (!formData.name || !formData.prefix) {
      toast({ type: 'error', title: 'Nome e prefixo são obrigatórios' })
      return
    }
    setLoading(true)
    try {
      const tag: Tag = {
        id: editingId === 'new' ? `tag_${Date.now()}` : editingId!,
        name: formData.name,
        prefix: formData.prefix,
        color: formData.color,
        icon: formData.icon,
        roleIds: formData.roleIds
      }
      await api.upsertTag(guildId, tag)
      toast({ type: 'success', title: 'Tag guardada!' })
      await load()
      setEditingId(null)
      setFormData({ name: '', prefix: '', color: '#5865F2', icon: '🏷️' })
    } catch (e: any) {
      toast({ type: 'error', title: 'Erro ao guardar', description: (e instanceof Error ? e.message : String(e)) })
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (tag?: Tag) => {
    if (tag) {
      setFormData({ ...tag })
      setEditingId(tag.id)
    } else {
      setFormData({ name: '', prefix: '', color: '#5865F2', icon: '🏷️' })
      setEditingId('new')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setFormData({ name: '', prefix: '', color: '#5865F2', icon: '🏷️' })
  }

  const deleteTag = async (id: string) => {
    if (!guildId || !confirm('Remover esta tag?')) return
    setLoading(true)
    try {
      await api.deleteTag(guildId, id)
      toast({ type: 'success', title: 'Tag removida!' })
      await load()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Toggle */}
      <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-4xl">🏷️</span>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Sistema de Tags
              </h2>
              <p className="text-gray-400 text-sm mt-1">Respostas rápidas e painéis personalizados</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-yellow-600/20 to-orange-600/20 flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total de Tags</p>
              <p className="text-2xl font-bold">{tags.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-600/20 to-emerald-600/20 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Tags Ativas</p>
              <p className="text-2xl font-bold">{tags.filter(t => !t.roleIds?.length).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center">
              <span className="text-2xl">🎭</span>
            </div>
            <div>
              <p className="text-gray-400 text-sm">Com Restrições</p>
              <p className="text-2xl font-bold">{tags.filter(t => t.roleIds?.length).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Tag Button */}
      {!editingId && (
        <button
          onClick={() => startEdit()}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2"
        >
          <span className="text-xl">➕</span>
          <span>Criar Nova Tag</span>
        </button>
      )}

      {/* Edit Form */}
      {editingId && (
        <div className="bg-gray-800/50 backdrop-blur-xl border border-purple-500/50 rounded-2xl p-6 space-y-4">
          <h3 className="text-xl font-bold mb-4">
            {editingId === 'new' ? '➕ Nova Tag' : '✏️ Editar Tag'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Tag</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Regras do Servidor"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prefixo (comando)</label>
              <input
                type="text"
                value={formData.prefix || ''}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                placeholder="Ex: regras"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Emoji/Ícone</label>
              <input
                type="text"
                value={formData.icon || ''}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🏷️"
                className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
              <input
                type="color"
                value={formData.color || '#5865F2'}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="w-full h-11 bg-gray-700/50 border border-gray-600 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveTag}
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl font-medium transition-all duration-200 disabled:opacity-50"
            >
              {loading ? '⏳ Guardando...' : '💾 Guardar Tag'}
            </button>
            <button
              onClick={cancelEdit}
              disabled={loading}
              className="px-6 py-3 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-xl transition-all"
            >
              ❌ Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div className="space-y-4">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="bg-gray-800/30 backdrop-blur-xl border border-gray-700/50 rounded-xl p-5 hover:border-purple-500/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  {tag.icon && <span className="text-2xl">{tag.icon}</span>}
                  <h3 className="text-lg font-semibold">{tag.name}</h3>
                  <span className="px-3 py-1 bg-gray-700/50 rounded-lg text-sm font-mono text-purple-300">
                    {tag.prefix}
                  </span>
                  {tag.color && (
                    <div
                      className="w-6 h-6 rounded-full border-2 border-gray-600"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                </div>
                {tag.roleIds && tag.roleIds.length > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>🎭</span>
                    <span>{tag.roleIds.length} cargo(s) requerido(s)</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(tag)}
                  disabled={!!editingId}
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 rounded-lg transition-all disabled:opacity-50"
                >
                  ✏️ Editar
                </button>
                <button
                  onClick={() => deleteTag(tag.id)}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 rounded-lg transition-all disabled:opacity-50"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {tags.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏷️</div>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhuma tag criada</h3>
          <p className="text-gray-500">Clique em "Criar Nova Tag" para começar</p>
        </div>
      )}
    </div>
  )
}
