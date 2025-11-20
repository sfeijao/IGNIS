'use client';

import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

/**
 * 🎫 TICKET CATEGORY MANAGER
 *
 * Gestão completa de categorias customizáveis de tickets por servidor.
 * Features: criar, editar, reordenar (drag-and-drop), eliminar, toggle enabled.
 */

interface TicketCategory {
  _id: string;
  guild_id: string;
  name: string;
  emoji: string;
  description?: string;
  color: number;
  order: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  guildId: string;
}

export default function TicketCategoryManager({ guildId }: Props) {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    emoji: '📩',
    description: '',
    color: 0x7C3AED
  });

  // Carregar categorias
  useEffect(() => {
    loadCategories();
  }, [guildId]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/guild/${guildId}/ticket-categories`);
      if (!res.ok) throw new Error('Failed to load categories');
      const data = await res.json();
      setCategories(data.categories || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error('[TicketCategories] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Criar nova categoria
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categories.length >= 25) {
      alert('Máximo de 25 categorias atingido!');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/guild/${guildId}/ticket-categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create category');
      }

      const data = await res.json();
      setCategories([...categories, data.category]);
      setShowCreateModal(false);
      resetForm();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Atualizar categoria
  const handleUpdate = async (id: string, updates: Partial<TicketCategory>) => {
    try {
      const res = await fetch(`/api/guild/${guildId}/ticket-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) throw new Error('Failed to update');

      const data = await res.json();
      setCategories(cats => cats.map(c => c._id === id ? data.category : c));
      setEditingId(null);
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  // Toggle enabled/disabled
  const handleToggle = async (id: string, enabled: boolean) => {
    await handleUpdate(id, { enabled });
  };

  // Eliminar categoria
  const handleDelete = async (id: string) => {
    if (!confirm('Tens a certeza? Isto não pode ser desfeito.')) return;

    try {
      const res = await fetch(`/api/guild/${guildId}/ticket-categories/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete');

      setCategories(cats => cats.filter(c => c._id !== id));
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    }
  };

  // Reordenar (drag-and-drop)
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(categories);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update local state immediately
    setCategories(items);

    // Send to API
    try {
      const orderIds = items.map(item => item._id);
      const res = await fetch(`/api/guild/${guildId}/ticket-categories/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderIds })
      });

      if (!res.ok) {
        // Rollback on error
        loadCategories();
        throw new Error('Failed to reorder');
      }

      const data = await res.json();
      setCategories(data.categories);
    } catch (err: any) {
      alert(`Erro ao reordenar: ${err.message}`);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', emoji: '📩', description: '', color: 0x7C3AED });
  };

  const hexToNumber = (hex: string): number => {
    return parseInt(hex.replace('#', ''), 16);
  };

  const numberToHex = (num: number): string => {
    return '#' + num.toString(16).padStart(6, '0');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">
        ❌ Erro ao carregar categorias: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Categorias de Tickets</h2>
          <p className="text-gray-400 text-sm mt-1">
            Personaliza as categorias disponíveis para tickets ({categories.length}/25)
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={categories.length >= 25}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          ➕ Adicionar Categoria
        </button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-xl font-semibold text-white mb-2">Nenhuma categoria criada</h3>
          <p className="text-gray-400 mb-6">
            Cria categorias personalizadas para organizar melhor os tickets do teu servidor.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
          >
            Criar Primeira Categoria
          </button>
        </div>
      )}

      {/* Categories list with drag-and-drop */}
      {categories.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-2"
              >
                {categories.map((category, index) => (
                  <Draggable key={category._id} draggableId={category._id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`bg-gray-800 border border-gray-700 rounded-lg p-4 transition-all ${
                          snapshot.isDragging ? 'shadow-lg ring-2 ring-purple-500' : ''
                        } ${!category.enabled ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Drag handle */}
                          <div className="text-gray-500 cursor-grab active:cursor-grabbing">
                            ⋮⋮
                          </div>

                          {/* Emoji */}
                          <div className="text-3xl">{category.emoji}</div>

                          {/* Content */}
                          <div className="flex-1">
                            {editingId === category._id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={formData.name}
                                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                  placeholder="Nome da categoria"
                                />
                                <input
                                  type="text"
                                  value={formData.emoji}
                                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                  placeholder="Emoji"
                                  maxLength={10}
                                />
                                <textarea
                                  value={formData.description}
                                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                                  placeholder="Descrição (opcional)"
                                  rows={2}
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleUpdate(category._id, formData)}
                                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
                                  >
                                    ✓ Guardar
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm"
                                  >
                                    ✗ Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-semibold text-white">{category.name}</h3>
                                {category.description && (
                                  <p className="text-sm text-gray-400 mt-1">{category.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <span
                                    className="w-4 h-4 rounded-full border border-gray-600"
                                    style={{ backgroundColor: numberToHex(category.color) }}
                                  />
                                  <span className="text-xs text-gray-500">
                                    {numberToHex(category.color).toUpperCase()}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Actions */}
                          {editingId !== category._id && (
                            <div className="flex items-center gap-2">
                              {/* Toggle enabled */}
                              <button
                                onClick={() => handleToggle(category._id, !category.enabled)}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                                  category.enabled
                                    ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                    : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                                }`}
                                title={category.enabled ? 'Ativa' : 'Desativada'}
                              >
                                {category.enabled ? '● Ativa' : '○ Inativa'}
                              </button>

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingId(category._id);
                                  setFormData({
                                    name: category.name,
                                    emoji: category.emoji,
                                    description: category.description || '',
                                    color: category.color
                                  });
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                              >
                                ✏️ Editar
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(category._id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Nova Categoria</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="ex: Suporte Técnico"
                  required
                  minLength={2}
                  maxLength={50}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Emoji *
                </label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="📩"
                  required
                  maxLength={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use emojis Discord (&lt;:nome:id&gt;) ou emojis Unicode
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="Descrição opcional..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Cor
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={numberToHex(formData.color)}
                    onChange={(e) => setFormData({ ...formData, color: hexToNumber(e.target.value) })}
                    className="h-10 w-20 bg-gray-700 border border-gray-600 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={numberToHex(formData.color).toUpperCase()}
                    onChange={(e) => {
                      const hex = e.target.value;
                      if (/^#[0-9A-F]{6}$/i.test(hex)) {
                        setFormData({ ...formData, color: hexToNumber(hex) });
                      }
                    }}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white font-mono"
                    placeholder="#7C3AED"
                    pattern="^#[0-9A-F]{6}$"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  {saving ? 'A criar...' : '✓ Criar Categoria'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
